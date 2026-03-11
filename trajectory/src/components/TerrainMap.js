import React, { useRef, useEffect, useState, useCallback } from 'react';
import SunCalc from 'suncalc';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

/**
 * TerrainMap — Mapbox GL terrain-3D with physically accurate sun position.
 *
 * Uses SunCalc to compute real solar azimuth/altitude for the location and time,
 * then applies it as directional lighting on the 3D terrain.
 */
export default function TerrainMap({
  weatherData,
  isLoading,
  onLocationChange
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [viewMode, setViewMode] = useState('terrain'); // terrain | satellite
  const [mapboxgl, setMapboxgl] = useState(null);

  // Extract coordinates from weather data
  const lat = weatherData?.location?.lat || 0;
  const lon = weatherData?.location?.lon || 0;
  const localTime = weatherData?.location?.localtime
    ? new Date(weatherData.location.localtime)
    : new Date();

  // Compute sun position using SunCalc
  const sunPosition = SunCalc.getPosition(localTime, lat, lon);
  const sunAltitudeDeg = sunPosition.altitude * (180 / Math.PI);
  const sunAzimuthDeg = sunPosition.azimuth * (180 / Math.PI) + 180; // Convert from [-π,π] to [0,360]
  const isNight = sunAltitudeDeg < -6; // Civil twilight threshold

  // Sun times for display
  const sunTimes = SunCalc.getTimes(localTime, lat, lon);

  // Compute light color based on sun altitude
  const getSunColor = useCallback((altitude) => {
    if (altitude < -6) return '#1a1a3e'; // Night
    if (altitude < 0) return '#ff6b35'; // Civil twilight
    if (altitude < 10) return '#ff8c42'; // Golden hour
    if (altitude < 30) return '#ffb347'; // Morning/evening
    return '#ffffff'; // Midday
  }, []);

  const getSunIntensity = useCallback((altitude) => {
    if (altitude < -6) return 0.1;
    if (altitude < 0) return 0.3;
    if (altitude < 10) return 0.5;
    if (altitude < 30) return 0.7;
    return 0.9;
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let cancelled = false;

    async function initMap() {
      // Dynamically import mapbox-gl to avoid SSR issues
      const mapboxglModule = await import('mapbox-gl');
      const mbgl = mapboxglModule.default;

      if (cancelled) return;
      setMapboxgl(mbgl);

      // Import CSS
      await import('mapbox-gl/dist/mapbox-gl.css');

      if (!MAPBOX_TOKEN) {
        console.warn('Mapbox token not set. Add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local');
        return;
      }

      mbgl.accessToken = MAPBOX_TOKEN;

      const map = new mbgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: [lon || 31.5, lat || -19.26],
        zoom: 12,
        pitch: 60,
        bearing: sunAzimuthDeg - 180,
        antialias: true,
      });

      mapRef.current = map;

      map.on('load', () => {
        if (cancelled) return;

        // Add terrain source
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });

        // Enable 3D terrain
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

        // Add sky layer
        map.addLayer({
          id: 'sky',
          type: 'sky',
          paint: {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [sunAzimuthDeg, Math.max(0, sunAltitudeDeg)],
            'sky-atmosphere-sun-intensity': isNight ? 0 : 5,
          },
        });

        // Set directional light based on real sun position
        map.setLight({
          anchor: 'map',
          position: [1.5, sunAzimuthDeg, sunAltitudeDeg > 0 ? sunAltitudeDeg : 0],
          color: getSunColor(sunAltitudeDeg),
          intensity: getSunIntensity(sunAltitudeDeg),
        });

        // Add weather marker at location
        if (weatherData) {
          const el = document.createElement('div');
          el.className = 'weather-marker';
          el.innerHTML = `
            <div style="
              background: rgba(0,0,0,0.7);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255,255,255,0.2);
              border-radius: 12px;
              padding: 8px 12px;
              color: white;
              font-family: Inter, system-ui, sans-serif;
              font-size: 12px;
              white-space: nowrap;
              pointer-events: none;
            ">
              <div style="font-size: 20px; font-weight: 200;">${Math.round(weatherData.current?.temp_c || 0)}°C</div>
              <div style="opacity: 0.7; font-weight: 300;">${weatherData.current?.condition?.text || ''}</div>
            </div>
          `;

          new mbgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([lon, lat])
            .addTo(map);
        }

        setMapLoaded(true);
      });

      // Handle click for location change
      map.on('click', (e) => {
        if (onLocationChange) {
          onLocationChange(`${e.lngLat.lat.toFixed(4)},${e.lngLat.lng.toFixed(4)}`);
        }
      });

      // Add navigation controls
      map.addControl(new mbgl.NavigationControl(), 'bottom-right');
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Only initialize once

  // Update map when weather data changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !weatherData) return;

    const map = mapRef.current;

    // Fly to new location
    map.flyTo({
      center: [lon, lat],
      zoom: 12,
      pitch: 60,
      bearing: sunAzimuthDeg - 180,
      duration: 2000,
    });

    // Update sun position in sky
    if (map.getLayer('sky')) {
      map.setPaintProperty('sky', 'sky-atmosphere-sun', [sunAzimuthDeg, Math.max(0, sunAltitudeDeg)]);
      map.setPaintProperty('sky', 'sky-atmosphere-sun-intensity', isNight ? 0 : 5);
    }

    // Update lighting
    map.setLight({
      anchor: 'map',
      position: [1.5, sunAzimuthDeg, sunAltitudeDeg > 0 ? sunAltitudeDeg : 0],
      color: getSunColor(sunAltitudeDeg),
      intensity: getSunIntensity(sunAltitudeDeg),
    });
  }, [weatherData, lat, lon, sunAzimuthDeg, sunAltitudeDeg, isNight, mapLoaded, getSunColor, getSunIntensity]);

  // Toggle satellite / terrain style
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const style = viewMode === 'satellite'
      ? 'mapbox://styles/mapbox/satellite-streets-v12'
      : 'mapbox://styles/mapbox/outdoors-v12';

    map.setStyle(style);

    // Re-add terrain after style change
    map.once('style.load', () => {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [sunAzimuthDeg, Math.max(0, sunAltitudeDeg)],
          'sky-atmosphere-sun-intensity': isNight ? 0 : 5,
        },
      });
      map.setLight({
        anchor: 'map',
        position: [1.5, sunAzimuthDeg, sunAltitudeDeg > 0 ? sunAltitudeDeg : 0],
        color: getSunColor(sunAltitudeDeg),
        intensity: getSunIntensity(sunAltitudeDeg),
      });
    });
  }, [viewMode, mapLoaded, sunAzimuthDeg, sunAltitudeDeg, isNight, getSunColor, getSunIntensity]);

  // Format time safely
  const formatTime = (date) => {
    try {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* No token warning */}
      {!MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-10">
          <div className="text-center text-white max-w-md px-6">
            <div className="text-4xl mb-4">🗺️</div>
            <h3 className="text-lg font-light mb-2">Mapbox Token Required</h3>
            <p className="text-gray-400 text-sm font-light mb-4">
              Add <code className="bg-white/10 px-2 py-0.5 rounded text-cyan-400">NEXT_PUBLIC_MAPBOX_TOKEN</code> to your <code className="bg-white/10 px-2 py-0.5 rounded">.env.local</code> file.
            </p>
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 text-sm hover:underline"
            >
              Get a free Mapbox token →
            </a>
          </div>
        </div>
      )}

      {/* Sun info overlay — top left */}
      {mapLoaded && weatherData && (
        <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md rounded-xl p-4 border border-white/10 text-white text-sm">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-lg">{isNight ? '🌙' : '☀️'}</span>
            <span className="font-light">{isNight ? 'Night' : 'Day'}</span>
          </div>
          <div className="space-y-1 text-xs font-light text-gray-300">
            <div>Altitude: <span className="text-cyan-400 font-mono">{sunAltitudeDeg.toFixed(1)}°</span></div>
            <div>Azimuth: <span className="text-cyan-400 font-mono">{sunAzimuthDeg.toFixed(1)}°</span></div>
            <div className="pt-1 border-t border-white/10 mt-1">
              <div>Sunrise: <span className="font-mono">{formatTime(sunTimes.sunrise)}</span></div>
              <div>Sunset: <span className="font-mono">{formatTime(sunTimes.sunset)}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Weather overlay — bottom left */}
      {mapLoaded && weatherData && (
        <div className="absolute bottom-20 left-4 z-10 bg-black/60 backdrop-blur-md rounded-xl p-4 border border-white/10 text-white">
          <div className="flex items-end space-x-3">
            <div>
              <span className="text-4xl font-thin">{Math.round(weatherData.current?.temp_c || 0)}</span>
              <span className="text-xl font-thin opacity-75">°C</span>
            </div>
            <div className="pb-1 text-sm font-light">
              <div className="opacity-80">{weatherData.current?.condition?.text}</div>
              <div className="text-xs opacity-60">
                Wind: {Math.round(weatherData.current?.wind_kph || 0)} km/h {weatherData.current?.wind_dir}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View mode toggle — bottom right */}
      {mapLoaded && (
        <div className="absolute bottom-20 right-16 z-10 flex bg-black/60 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden">
          <button
            onClick={() => setViewMode('terrain')}
            className={`px-3 py-2 text-xs font-light transition-all ${
              viewMode === 'terrain' ? 'bg-cyan-500/30 text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            Terrain
          </button>
          <button
            onClick={() => setViewMode('satellite')}
            className={`px-3 py-2 text-xs font-light transition-all ${
              viewMode === 'satellite' ? 'bg-cyan-500/30 text-cyan-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            Satellite
          </button>
        </div>
      )}

      {/* Click hint */}
      {mapLoaded && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/40 backdrop-blur-sm rounded-full px-4 py-1.5 text-white/50 text-xs font-light">
          Click anywhere on the map to load weather for that location
        </div>
      )}
    </div>
  );
}
