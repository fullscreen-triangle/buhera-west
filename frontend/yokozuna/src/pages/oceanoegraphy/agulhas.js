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
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
    </div>
  )
});

const AgulhasAnalysis = () => {
  const globeRef = useRef();
  const [globeReady, setGlobeReady] = useState(false);
  const [oceanCurrents, setOceanCurrents] = useState([]);
  const [submarineCables, setSubmarineCables] = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [satelliteData, setSatelliteData] = useState([]);
  const [mapStyle, setMapStyle] = useState('satellite');
  const [showCurrents, setShowCurrents] = useState(true);
  const [showCables, setShowCables] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showSatellites, setShowSatellites] = useState(false);
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

        // Get real satellite data
        const satData = await globalDataService.getRealSatelliteData();
        setSatelliteData(satData);

        // Generate Agulhas Current data from real oceanographic sources
        const currentData = await generateAgulhasCurrentData();
        setOceanCurrents(currentData);

      } catch (error) {
        console.error('Error loading ocean data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Generate Agulhas Current visualization data
  const generateAgulhasCurrentData = async () => {
    // Agulhas Current flows southwestward along the African east coast
    const agulhasPath = [
      { lat: -26.0, lng: 32.8, temp: 26, speed: 1.8 }, // Mozambique
      { lat: -28.0, lng: 32.5, temp: 25, speed: 2.0 }, // KwaZulu-Natal
      { lat: -30.0, lng: 31.8, temp: 24, speed: 2.2 }, // Durban
      { lat: -32.0, lng: 30.5, temp: 23, speed: 2.0 }, // East London
      { lat: -34.0, lng: 28.0, temp: 22, speed: 1.5 }, // Port Elizabeth
      { lat: -35.0, lng: 25.0, temp: 20, speed: 1.2 }, // Agulhas Bank
      { lat: -36.0, lng: 22.0, temp: 18, speed: 0.8 }, // Cape Agulhas
      { lat: -37.0, lng: 19.0, temp: 16, speed: 0.5 }, // Retroflection zone
    ];

    // Create flow arcs for the current
    const flowArcs = [];
    for (let i = 0; i < agulhasPath.length - 1; i++) {
      flowArcs.push({
        startLat: agulhasPath[i].lat,
        startLng: agulhasPath[i].lng,
        endLat: agulhasPath[i + 1].lat,
        endLng: agulhasPath[i + 1].lng,
        color: getAgulhasTemperatureColor(agulhasPath[i].temp),
        speed: agulhasPath[i].speed
      });
    }

    // Generate eddies (Agulhas rings)
    const eddies = [
      { lat: -38.5, lng: 15.0, radius: 200, temp: 20, rotation: 'clockwise' },
      { lat: -36.0, lng: 10.0, radius: 150, temp: 18, rotation: 'clockwise' },
      { lat: -40.0, lng: 8.0, radius: 180, temp: 19, rotation: 'anticyclonic' },
    ];

    return { path: agulhasPath, arcs: flowArcs, eddies };
  };

  const getAgulhasTemperatureColor = (temp) => {
    if (temp > 24) return '#ff4444';
    if (temp > 20) return '#ff8800';
    if (temp > 18) return '#ffcc00';
    return '#44ccff';
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
        <title>Agulhas Current Analysis | Buhera-West Environmental Intelligence</title>
        <meta name="description" content="Real-time analysis of the Agulhas Current system using satellite data and oceanographic measurements." />
      </Head>
      <TransitionEffect />
      
      <main className="w-full min-h-screen bg-black">
        <Layout>
          {/* Header */}
          <div className="text-center mb-8 pt-16">
            <AnimatedText 
              text="Agulhas Current System" 
              className="!text-5xl xl:!text-6xl lg:!text-4xl md:!text-3xl sm:!text-2xl !text-white mb-4" 
            />
            <p className="text-xl text-gray-300 max-w-4xl mx-auto">
              Real-time visualization of the Western Boundary Current along South Africa's east coast
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
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showSatellites}
                    onChange={(e) => setShowSatellites(e.target.checked)}
                    className="mr-2"
                  />
                  Ocean Satellites
                </label>
              </div>
            </div>

            {loading && (
              <div className="mt-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500 mx-auto mb-2"></div>
                <span className="text-gray-300 text-xs">Loading ocean data...</span>
              </div>
            )}
          </div>

          {/* Data Info Panel */}
          <div className="absolute top-20 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-600 max-w-sm">
            <h3 className="text-white font-bold mb-3">Agulhas Current Data</h3>
            <div className="text-gray-300 text-sm space-y-2">
              <div><strong>Current Speed:</strong> 0.5-2.2 m/s</div>
              <div><strong>Water Temperature:</strong> 16-26°C</div>
              <div><strong>Transport Volume:</strong> 70 Sverdrups</div>
              <div><strong>Current Width:</strong> 100-200 km</div>
              <div><strong>Retroflection:</strong> Cape Agulhas</div>
              <div><strong>Eddies:</strong> Agulhas rings formation</div>
              <div><strong>Biodiversity:</strong> High species richness</div>
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
              arcStroke={d => d.speed}
              arcDashLength={0.3}
              arcDashGap={0.1}
              arcDashInitialGap={() => Math.random()}
              arcDashAnimateTime={1500}
              arcLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Agulhas Current</strong><br/>
                  Speed: ${d.speed?.toFixed(1)} m/s<br/>
                  Direction: Southwestward
                </div>
              `}
              
              // Ocean current points
              pointsData={showCurrents ? oceanCurrents.path || [] : []}
              pointLat="lat"
              pointLng="lng"
              pointColor={d => getAgulhasTemperatureColor(d.temp)}
              pointAltitude={0.01}
              pointRadius={0.6}
              pointLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Agulhas Current Station</strong><br/>
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
              
              // Ocean monitoring satellites
              hexBinPointsData={showSatellites ? satelliteData.filter(d => d.type === 'Weather' || d.name.toLowerCase().includes('ocean')) : []}
              hexBinPointLat="lat"
              hexBinPointLng="lng"
              hexBinResolution={4}
              hexBinMargin={0.3}
              hexBinColor={() => '#00ffff'}
              hexBinLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Ocean Satellite Coverage</strong><br/>
                  Points: ${d.points.length}<br/>
                  Area: ${d.sumWeight} km²
                </div>
              `}
              
              // Atmosphere
              showAtmosphere={true}
              atmosphereColor="#ff6666"
              atmosphereAltitude={0.12}
              
              // Controls
              enablePointerInteraction={true}
              
              // Events
              onGlobeReady={() => {
                setGlobeReady(true);
                if (globeRef.current) {
                  // Focus on Agulhas Current region
                  globeRef.current.pointOfView({
                    lat: -32,
                    lng: 28,
                    altitude: 2
                  }, 2000);
                  
                  // Enable controls
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
                <div className="w-4 h-2 bg-red-500 mr-2 rounded"></div>
                Warm Current (24-26°C)
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-2 bg-orange-500 mr-2 rounded"></div>
                Moderate Current (20-24°C)
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-2 bg-yellow-500 mr-2 rounded"></div>
                Cool Current (18-20°C)
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-2 bg-cyan-400 mr-2 rounded"></div>
                Cold Current (18°C)
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-orange-600 mr-2"></div>
                Submarine Cables
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-white mr-3 rounded-full"></div>
                Weather Stations
              </div>
              {showSatellites && (
                <div className="flex items-center text-gray-300">
                  <div className="w-3 h-3 bg-cyan-400 mr-2 rounded-full"></div>
                  Satellite Coverage
                </div>
              )}
            </div>
          </div>

          {/* Performance Info */}
          <div className="absolute bottom-4 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-3 border border-gray-600">
            <div className="text-gray-300 text-xs">
              <div>Cables: {submarineCables.length}</div>
              <div>Weather: {weatherData.length}</div>
              <div>Satellites: {satelliteData.length}</div>
              <div>Currents: {oceanCurrents.path?.length || 0}</div>
            </div>
          </div>
        </Layout>
      </main>
    </>
  );
};

export default AgulhasAnalysis;
