import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { DEFAULT_COORDINATES } from '@/config/coordinates';

// Dynamic import for react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import('react-globe.gl').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
    </div>
  )
});

const InformationGlobe = ({ 
  locationData = DEFAULT_COORDINATES, 
  data = null, 
  compact = false 
}) => {
  const globeEl = useRef();
  const [globeReady, setGlobeReady] = useState(false);
  const [countries, setCountries] = useState({ features: [] });
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Load world countries data
  useEffect(() => {
    // Load countries GeoJSON data
    fetch('/api/geo/countries')
      .then(res => res.json())
      .then(setCountries)
      .catch(() => {
        // Fallback countries data structure
        setCountries({
          features: [
            {
              type: 'Feature',
              properties: { NAME: 'Zimbabwe', ISO_A2: 'ZW' },
              geometry: {
                type: 'Polygon',
                coordinates: [[[
                  [25.237, -22.271], [33.224, -22.271],
                  [33.224, -15.609], [25.237, -15.609],
                  [25.237, -22.271]
                ]]]
              }
            }
          ]
        });
      });
  }, []);

  const getPointColor = (point) => {
    if (!point.temperature) return '#4CAF50';
    
    const temp = point.temperature;
    if (temp < 10) return '#2196F3'; // Blue for cold
    if (temp < 20) return '#4CAF50'; // Green for mild
    if (temp < 30) return '#FF9800'; // Orange for warm
    return '#F44336'; // Red for hot
  };

  // Process data points for globe visualization
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    return data.slice(0, compact ? 100 : 500).map((point, index) => ({
      id: index,
      lat: point.coordinates?.lat || locationData.lat + (Math.random() - 0.5) * 2,
      lng: point.coordinates?.lng || locationData.lng + (Math.random() - 0.5) * 2,
      altitude: (point.temperature || 20) / 100, // Scale temperature to altitude
      color: getPointColor(point),
      size: Math.max(0.1, (point.humidity || 50) / 100),
      temperature: point.temperature || 20,
      humidity: point.humidity || 50,
      pressure: point.pressure || 1013,
      timestamp: point.timestamp || Date.now()
    }));
  }, [data, locationData, compact]);

  // Generate arc data for showing data connections
  const arcData = useMemo(() => {
    if (!processedData.length || compact) return [];
    
    const centerPoint = {
      lat: locationData.lat,
      lng: locationData.lng
    };

    return processedData.slice(0, 20).map(point => ({
      startLat: centerPoint.lat,
      startLng: centerPoint.lng,
      endLat: point.lat,
      endLng: point.lng,
      color: point.color,
      strength: point.size
    }));
  }, [processedData, locationData, compact]);

  // Globe initialization
  useEffect(() => {
    if (globeEl.current && !globeReady) {
      const globe = globeEl.current;
      
      // Set initial camera position
      globe.pointOfView({
        lat: locationData.lat,
        lng: locationData.lng,
        altitude: compact ? 3 : 2
      });

      // Set controls
      globe.controls().enableZoom = !compact;
      globe.controls().enablePan = !compact;
      globe.controls().autoRotate = compact;
      globe.controls().autoRotateSpeed = 0.5;

      setGlobeReady(true);
    }
  }, [globeEl, globeReady, locationData, compact]);

  // Handle point clicks
  const handlePointClick = (point) => {
    if (compact) return;
    setSelectedPoint(point);
    
    // Focus on clicked point
    if (globeEl.current) {
      globeEl.current.pointOfView({
        lat: point.lat,
        lng: point.lng,
        altitude: 1
      }, 1000);
    }
  };

  return (
    <div className="w-full h-full relative">
      <Globe
        ref={globeEl}
        width={compact ? 300 : undefined}
        height={compact ? 300 : undefined}
        backgroundColor="rgba(0,0,0,0)"
        
        // Countries
        polygonsData={countries.features}
        polygonCapColor={() => 'rgba(255, 255, 255, 0.1)'}
        polygonSideColor={() => 'rgba(255, 255, 255, 0.05)'}
        polygonStrokeColor={() => 'rgba(255, 255, 255, 0.2)'}
        polygonAltitude={0.01}
        
        // Data points
        pointsData={processedData}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude="altitude"
        pointRadius="size"
        pointResolution={compact ? 4 : 8}
        onPointClick={handlePointClick}
        pointLabel={point => `
          <div class="bg-black/80 text-white p-2 rounded text-xs">
            <div><strong>Temperature:</strong> ${point.temperature?.toFixed(1)}°C</div>
            <div><strong>Humidity:</strong> ${point.humidity?.toFixed(1)}%</div>
            <div><strong>Pressure:</strong> ${point.pressure?.toFixed(1)} hPa</div>
            <div><strong>Location:</strong> ${point.lat.toFixed(3)}, ${point.lng.toFixed(3)}</div>
          </div>
        `}
        
        // Arcs for data connections
        arcsData={arcData}
        arcColor="color"
        arcStroke="strength"
        arcDashLength={0.3}
        arcDashGap={0.1}
        arcDashInitialGap={() => Math.random()}
        arcDashAnimateTime={2000}
        
        // Atmosphere
        atmosphereColor={compact ? "rgba(100, 150, 255, 0.1)" : "rgba(100, 150, 255, 0.3)"}
        atmosphereAltitude={0.15}
        
        // Globe styling
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        
        // Controls
        enablePointerInteraction={!compact}
        
        // Lighting
        onGlobeReady={() => {
          if (globeEl.current) {
            // Add custom lighting
            const scene = globeEl.current.scene();
            const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
            scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
            directionalLight.position.set(1, 1, 1);
            scene.add(directionalLight);
          }
        }}
      />

      {/* Overlay information */}
      {!compact && (
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white p-4 rounded-lg border border-white/20">
          <h3 className="text-lg font-semibold mb-2">Global Data Overview</h3>
          <div className="space-y-1 text-sm">
            <div>Data Points: {processedData.length}</div>
            <div>Center: {locationData.lat.toFixed(3)}, {locationData.lng.toFixed(3)}</div>
            {selectedPoint && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <div className="font-medium">Selected Point:</div>
                <div>Temp: {selectedPoint.temperature?.toFixed(1)}°C</div>
                <div>Humidity: {selectedPoint.humidity?.toFixed(1)}%</div>
                <div>Location: {selectedPoint.lat.toFixed(3)}, {selectedPoint.lng.toFixed(3)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white p-4 rounded-lg border border-white/20">
          <h4 className="text-sm font-semibold mb-2">Temperature Scale</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>&lt; 10°C</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>10-20°C</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span>20-30°C</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>&gt; 30°C</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/20 text-xs">
            <div>Point size = Humidity level</div>
            <div>Point height = Temperature</div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {!globeReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
};

export default InformationGlobe; 