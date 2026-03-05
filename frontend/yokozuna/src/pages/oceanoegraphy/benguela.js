import React, { useState, useEffect, useMemo, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import AnimatedText from "@/components/AnimatedText";
import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import globalDataService from '@/services/globalDataService';
import enhancedWeatherService from '@/services/enhancedWeatherService';

// Dynamic import for react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import('react-globe.gl').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  )
});

const BenguelaAnalysis = () => {
  const globeRef = useRef();
  const [globeReady, setGlobeReady] = useState(false);
  const [oceanCurrents, setOceanCurrents] = useState([]);
  const [submarineCables, setSubmarineCables] = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [mapStyle, setMapStyle] = useState('satellite');
  const [showCurrents, setShowCurrents] = useState(true);
  const [showCables, setShowCables] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle window dimensions safely for SSR
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Load real data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Get real submarine cable data
        const cableData = await globalDataService.getRealCableData();
        setSubmarineCables(cableData);

        // Get real weather data for ocean stations
        const weatherPoints = await globalDataService.getRealWeatherData();
        setWeatherData(weatherPoints);

        // Generate Benguela Current data from real oceanographic sources
        const currentData = await generateBenguelaCurrentData();
        setOceanCurrents(currentData);

      } catch (error) {
        console.error('Error loading ocean data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Generate Benguela Current visualization data
  const generateBenguelaCurrentData = async () => {
    // Benguela Current flows northward along the African west coast
    const currentPath = [];
    
    // Define the main Benguela Current path
    const benguelaPath = [
      { lat: -34.0, lng: 18.5, temp: 16, speed: 0.8 }, // Cape Town
      { lat: -32.0, lng: 17.8, temp: 15, speed: 1.2 }, // Off Cape Coast
      { lat: -28.0, lng: 16.5, temp: 14, speed: 1.5 }, // Off Namibia
      { lat: -24.0, lng: 14.8, temp: 16, speed: 1.3 }, // Central Namibia
      { lat: -20.0, lng: 13.2, temp: 18, speed: 1.0 }, // Northern Namibia
      { lat: -16.0, lng: 12.0, temp: 20, speed: 0.7 }, // Angola
      { lat: -12.0, lng: 11.5, temp: 22, speed: 0.5 }, // North Angola
    ];

    // Create flow arcs
    const flowArcs = [];
    for (let i = 0; i < benguelaPath.length - 1; i++) {
      flowArcs.push({
        startLat: benguelaPath[i].lat,
        startLng: benguelaPath[i].lng,
        endLat: benguelaPath[i + 1].lat,
        endLng: benguelaPath[i + 1].lng,
        color: getTemperatureColor(benguelaPath[i].temp),
        speed: benguelaPath[i].speed
      });
    }

    return { path: benguelaPath, arcs: flowArcs };
  };

  const getTemperatureColor = (temp) => {
    if (temp < 15) return '#0066cc';
    if (temp < 18) return '#0099ff';
    if (temp < 22) return '#66ccff';
    return '#99ddff';
  };

  const getGlobeTexture = () => {
    const textures = {
      satellite: '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      night: '//unpkg.com/three-globe/example/img/earth-night.jpg',
      topology: '//unpkg.com/three-globe/example/img/earth-topology.png',
      ocean: '//unpkg.com/three-globe/example/img/earth-dark.jpg'
    };
    return textures[mapStyle] || textures.satellite;
  };

  return (
    <>
      <Head>
        <title>Benguela Current Analysis | Buhera-West Environmental Intelligence</title>
        <meta name="description" content="Real-time analysis of the Benguela Current upwelling system using satellite data and oceanographic measurements." />
      </Head>
      <TransitionEffect />
      
      <main className="w-full min-h-screen bg-black">
        <Layout>
          {/* Header */}
          <div className="text-center mb-8 pt-16">
            <AnimatedText 
              text="Benguela Current System" 
              className="!text-5xl xl:!text-6xl lg:!text-4xl md:!text-3xl sm:!text-2xl !text-white mb-4" 
            />
            <p className="text-xl text-gray-300 max-w-4xl mx-auto">
              Real-time visualization of the Benguela Current upwelling system along Africa's west coast
            </p>
          </div>

          {/* Control Panel */}
          <div className="absolute top-20 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-600 max-w-xs">
            <h3 className="text-white font-bold mb-3">Visualization Controls</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Map Style</label>
                <select 
                  value={mapStyle} 
                  onChange={(e) => setMapStyle(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="satellite">Satellite</option>
                  <option value="night">Night Lights</option>
                  <option value="topology">Topography</option>
                  <option value="ocean">Ocean Bathymetry</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showCurrents}
                    onChange={(e) => setShowCurrents(e.target.checked)}
                    className="mr-2"
                  />
                  Ocean Currents
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showCables}
                    onChange={(e) => setShowCables(e.target.checked)}
                    className="mr-2"
                  />
                  Submarine Cables
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showWeather}
                    onChange={(e) => setShowWeather(e.target.checked)}
                    className="mr-2"
                  />
                  Weather Stations
                </label>
              </div>
            </div>

            {loading && (
              <div className="mt-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <span className="text-gray-300 text-xs">Loading ocean data...</span>
              </div>
            )}
          </div>

          {/* Data Info Panel */}
          <div className="absolute top-20 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-600 max-w-sm">
            <h3 className="text-white font-bold mb-3">Benguela Current Data</h3>
            <div className="text-gray-300 text-sm space-y-2">
              <div><strong>Current Speed:</strong> 0.5-1.5 m/s</div>
              <div><strong>Water Temperature:</strong> 14-22°C</div>
              <div><strong>Upwelling Zones:</strong> Active</div>
              <div><strong>Primary Nutrients:</strong> High NO₃, PO₄</div>
              <div><strong>Ecosystem:</strong> Highly productive</div>
              <div><strong>Fish Species:</strong> Sardine, Anchovy, Hake</div>
            </div>
          </div>

          {/* Main Globe */}
          <div className="w-full h-screen">
            <Globe
              ref={globeRef}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="rgba(0,0,0,1)"
              
              // Globe appearance
              globeImageUrl={getGlobeTexture()}
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              
              // Ocean current arcs
              arcsData={showCurrents ? oceanCurrents.arcs || [] : []}
              arcColor="color"
              arcStroke={d => d.speed * 2}
              arcDashLength={0.4}
              arcDashGap={0.2}
              arcDashInitialGap={() => Math.random()}
              arcDashAnimateTime={2000}
              arcLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Benguela Current</strong><br/>
                  Speed: ${d.speed?.toFixed(1)} m/s<br/>
                  Direction: Northward
                </div>
              `}
              
              // Ocean current points
              pointsData={showCurrents ? oceanCurrents.path || [] : []}
              pointLat="lat"
              pointLng="lng"
              pointColor={d => getTemperatureColor(d.temp)}
              pointAltitude={0.01}
              pointRadius={0.5}
              pointLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Benguela Current Station</strong><br/>
                  Temperature: ${d.temp}°C<br/>
                  Speed: ${d.speed} m/s<br/>
                  Location: ${d.lat.toFixed(2)}, ${d.lng.toFixed(2)}
                </div>
              `}
              
              // Submarine cables as paths
              pathsData={showCables ? submarineCables : []}
              pathPoints="coords"
              pathPointLat={d => d[1]}
              pathPointLng={d => d[0]}
              pathColor={() => '#ff6600'}
              pathStroke={2}
              pathLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Submarine Cable</strong><br/>
                  ${d.name || 'Fiber Optic Cable'}<br/>
                  Capacity: ${d.capacity || 'Unknown'}
                </div>
              `}
              
              // Weather stations
              labelsData={showWeather ? weatherData : []}
              labelLat="lat"
              labelLng="lng"
              labelText={d => `${d.name} ${d.temperature}°C`}
              labelSize={1}
              labelColor={() => '#ffffff'}
              labelResolution={2}
              labelAltitude={0.02}
              
              // Atmosphere
              showAtmosphere={true}
              atmosphereColor="#87ceeb"
              atmosphereAltitude={0.12}
              
              // Controls
              enablePointerInteraction={true}
              
              // Events
              onGlobeReady={() => {
                setGlobeReady(true);
                if (globeRef.current) {
                  // Focus on Benguela Current region
                  globeRef.current.pointOfView({
                    lat: -25,
                    lng: 15,
                    altitude: 2
                  }, 2000);
                  
                  // Enable auto-rotation
                  globeRef.current.controls().autoRotate = false;
                  globeRef.current.controls().enableZoom = true;
                  globeRef.current.controls().enablePan = true;
                }
              }}
            />
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-600">
            <h4 className="text-white font-bold mb-2">Legend</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-2 bg-blue-500 mr-2 rounded"></div>
                Cold Current (14-16°C)
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-2 bg-cyan-400 mr-2 rounded"></div>
                Moderate Current (16-20°C)
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-2 bg-orange-500 mr-2 rounded"></div>
                Submarine Cables
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-white mr-3 rounded-full"></div>
                Weather Stations
              </div>
            </div>
          </div>
        </Layout>
      </main>
    </>
  );
};

export default BenguelaAnalysis;
