// I want you to look at the @globes.md file and use the example with satellites and the one with arcs/lines to draw satellites and their actual orbits.
// I want you to use real data from the apis to show the satellites and their orbits. 

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import AnimatedText from "@/components/AnimatedText";
import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import globalDataService from '@/services/globalDataService';
import * as satellite from 'satellite.js';

// Dynamic import for react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import('react-globe.gl').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
    </div>
  )
});

const SatelliteOrbitVisualization = () => {
  const globeRef = useRef();
  const [globeReady, setGlobeReady] = useState(false);
  const [satellites, setSatellites] = useState([]);
  const [orbitalPaths, setOrbitalPaths] = useState([]);
  const [groundTracks, setGroundTracks] = useState([]);
  const [selectedSatellite, setSelectedSatellite] = useState(null);
  const [mapStyle, setMapStyle] = useState('night');
  const [showOrbits, setShowOrbits] = useState(true);
  const [showTracks, setShowTracks] = useState(true);
  const [showSatellites, setShowSatellites] = useState(true);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [satelliteFilter, setSatelliteFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
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

  // Auto-update satellite positions
  useEffect(() => {
    const interval = setInterval(() => {
      const newTime = new Date(currentTime.getTime() + timeSpeed * 60000); // timeSpeed minutes per second
      setCurrentTime(newTime);
      updateSatellitePositions(newTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [currentTime, timeSpeed]);

  // Load satellite data
  useEffect(() => {
    const loadSatelliteData = async () => {
      setLoading(true);
      try {
        // Get real satellite TLE data
        const satData = await globalDataService.getRealSatelliteData();
        
        // Get TLE data for orbit calculations
        const tleData = await getTLEData();
        
        // Process satellite data with orbital elements
        const processedSats = await processSatelliteData(satData, tleData);
        setSatellites(processedSats);

        // Generate orbital paths
        const orbits = await generateOrbitalPaths(tleData);
        setOrbitalPaths(orbits);

        // Generate ground tracks
        const tracks = await generateGroundTracks(tleData);
        setGroundTracks(tracks);

      } catch (error) {
        console.error('Error loading satellite data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSatelliteData();
  }, [satelliteFilter]);

  // Get TLE data for detailed orbital calculations
  const getTLEData = async () => {
    try {
      // Use Next.js API route to get detailed TLE data
      const response = await fetch('/api/satellites');
      if (!response.ok) throw new Error('Failed to fetch TLE data');
      
      const apiData = await response.json();
      if (!apiData.success) throw new Error(apiData.error);
      
      return apiData.data.map(({ name, line1, line2 }) => ({
        name,
        line1,
        line2,
        satrec: satellite.twoline2satrec(line1, line2)
      })).filter(sat => sat.satrec); // Only valid TLE data
    } catch (error) {
      console.error('TLE data fetch failed:', error);
      return getFallbackTLEData();
    }
  };

  // Process satellite data with orbital calculations
  const processSatelliteData = async (satData, tleData) => {
    const processed = [];
    
    tleData.forEach(tle => {
      const gmst = satellite.gstime(currentTime);
      const eci = satellite.propagate(tle.satrec, currentTime);
      
      if (eci?.position) {
        const gdPos = satellite.eciToGeodetic(eci.position, gmst);
        const lat = satellite.radiansToDegrees(gdPos.latitude);
        const lng = satellite.radiansToDegrees(gdPos.longitude);
        const alt = gdPos.height;
        
        // Calculate orbital elements
        const orbitalElements = calculateOrbitalElements(tle.satrec);
        
        processed.push({
          id: tle.name.replace(/\s+/g, '_'),
          name: tle.name,
          lat,
          lng,
          alt: alt / 6371, // Normalize altitude for globe
          velocity: calculateVelocity(eci.velocity),
          period: orbitalElements.period,
          inclination: orbitalElements.inclination,
          eccentricity: orbitalElements.eccentricity,
          perigee: orbitalElements.perigee,
          apogee: orbitalElements.apogee,
          type: classifySatellite(tle.name),
          tle: tle,
          timestamp: currentTime.getTime()
        });
      }
    });

    return processed;
  };

  // Generate orbital paths for 3D visualization
  const generateOrbitalPaths = async (tleData) => {
    const orbits = [];
    
    tleData.forEach(tle => {
      const orbitPoints = [];
      const startTime = new Date(currentTime);
      
      // Generate points for one complete orbit
      for (let i = 0; i < 100; i++) {
        const time = new Date(startTime.getTime() + i * 90000); // 90 seconds per point
        const gmst = satellite.gstime(time);
        const eci = satellite.propagate(tle.satrec, time);
        
        if (eci?.position) {
          const gdPos = satellite.eciToGeodetic(eci.position, gmst);
          const lat = satellite.radiansToDegrees(gdPos.latitude);
          const lng = satellite.radiansToDegrees(gdPos.longitude);
          const alt = gdPos.height / 6371; // Normalize for globe
          
          orbitPoints.push([lat, lng, alt]);
        }
      }
      
      if (orbitPoints.length > 0) {
        orbits.push({
          id: tle.name.replace(/\s+/g, '_'),
          name: tle.name,
          points: orbitPoints,
          type: classifySatellite(tle.name),
          color: getSatelliteColor(classifySatellite(tle.name)),
          altitude: Math.max(...orbitPoints.map(p => p[2]))
        });
      }
    });

    return orbits;
  };

  // Generate ground tracks (satellite footprints)
  const generateGroundTracks = async (tleData) => {
    const tracks = [];
    
    tleData.forEach(tle => {
      const trackPoints = [];
      const startTime = new Date(currentTime.getTime() - 3600000); // Last hour
      
      // Generate ground track for the last hour
      for (let i = 0; i < 60; i++) {
        const time = new Date(startTime.getTime() + i * 60000); // 1 minute intervals
        const gmst = satellite.gstime(time);
        const eci = satellite.propagate(tle.satrec, time);
        
        if (eci?.position) {
          const gdPos = satellite.eciToGeodetic(eci.position, gmst);
          const lat = satellite.radiansToDegrees(gdPos.latitude);
          const lng = satellite.radiansToDegrees(gdPos.longitude);
          
          trackPoints.push([lat, lng]);
        }
      }
      
      if (trackPoints.length > 0) {
        tracks.push({
          id: `${tle.name.replace(/\s+/g, '_')}_track`,
          name: `${tle.name} Ground Track`,
          coords: trackPoints,
          type: classifySatellite(tle.name),
          color: getSatelliteColor(classifySatellite(tle.name))
        });
      }
    });

    return tracks;
  };

  // Update satellite positions for real-time animation
  const updateSatellitePositions = (time) => {
    setSatellites(prevSats => 
      prevSats.map(sat => {
        const gmst = satellite.gstime(time);
        const eci = satellite.propagate(sat.tle.satrec, time);
        
        if (eci?.position) {
          const gdPos = satellite.eciToGeodetic(eci.position, gmst);
          const lat = satellite.radiansToDegrees(gdPos.latitude);
          const lng = satellite.radiansToDegrees(gdPos.longitude);
          const alt = gdPos.height;
          
          return {
            ...sat,
            lat,
            lng,
            alt: alt / 6371,
            velocity: calculateVelocity(eci.velocity),
            timestamp: time.getTime()
          };
        }
        return sat;
      })
    );
  };

  // Helper functions
  const calculateOrbitalElements = (satrec) => {
    const mu = 398600.4418; // Earth's gravitational parameter
    const a = Math.pow(mu / (satrec.no * satrec.no), 1/3); // Semi-major axis
    const period = 2 * Math.PI * Math.sqrt(a * a * a / mu) / 60; // minutes
    
    return {
      period: period,
      inclination: satellite.radiansToDegrees(satrec.inclo),
      eccentricity: satrec.ecco,
      perigee: a * (1 - satrec.ecco) - 6371, // km above Earth
      apogee: a * (1 + satrec.ecco) - 6371  // km above Earth
    };
  };

  const calculateVelocity = (velocity) => {
    if (!velocity) return 0;
    return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
  };

  const classifySatellite = (name) => {
    if (name.includes('ISS') || name.includes('TIANGONG')) return 'Space Station';
    if (name.includes('STARLINK')) return 'Communication';
    if (name.includes('GPS') || name.includes('GLONASS') || name.includes('GALILEO')) return 'Navigation';
    if (name.includes('NOAA') || name.includes('METEOSAT') || name.includes('GOES')) return 'Weather';
    if (name.includes('LANDSAT') || name.includes('SENTINEL') || name.includes('MODIS')) return 'Earth Observation';
    if (name.includes('HUBBLE') || name.includes('SPITZER') || name.includes('KEPLER')) return 'Research';
    return 'Other';
  };

  const getSatelliteColor = (type) => {
    const colors = {
      'Space Station': '#00ff00',
      'Communication': '#0080ff',
      'Navigation': '#ff8000',
      'Weather': '#ff0080',
      'Earth Observation': '#80ff00',
      'Research': '#8000ff',
      'Other': '#ffffff'
    };
    return colors[type] || '#ffffff';
  };

  const getGlobeTexture = () => {
    const textures = {
      satellite: '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      night: '//unpkg.com/three-globe/example/img/earth-night.jpg',
      dark: '//unpkg.com/three-globe/example/img/earth-dark.jpg'
    };
    return textures[mapStyle] || textures.night;
  };

  const getFallbackTLEData = () => [
    {
      name: 'ISS (ZARYA)',
      line1: '1 25544U 98067A   23001.00000000  .00002182  00000-0  40768-4 0  9990',
      line2: '2 25544  51.6461 339.2971 0002972  68.6102 280.9570 15.48919103123456',
      satrec: null
    }
  ];

  const filteredSatellites = satelliteFilter === 'all' ? satellites : 
                            satellites.filter(sat => sat.type === satelliteFilter);

  const filteredOrbits = satelliteFilter === 'all' ? orbitalPaths : 
                        orbitalPaths.filter(orbit => orbit.type === satelliteFilter);

  const filteredTracks = satelliteFilter === 'all' ? groundTracks : 
                        groundTracks.filter(track => track.type === satelliteFilter);

  return (
    <>
      <Head>
        <title>Satellite Orbit Visualization | Buhera-West Environmental Intelligence</title>
        <meta name="description" content="Real-time satellite tracking and orbital visualization using TLE data." />
      </Head>
      <TransitionEffect />
      
      <main className="w-full min-h-screen bg-black">
        <Layout>
          {/* Header */}
          <div className="text-center mb-8 pt-16">
            <AnimatedText 
              text="Satellite Orbit Tracking" 
              className="!text-5xl xl:!text-6xl lg:!text-4xl md:!text-3xl sm:!text-2xl !text-white mb-4" 
            />
            <p className="text-xl text-gray-300 max-w-4xl mx-auto">
              Real-time satellite tracking with orbital paths and ground tracks using TLE data
            </p>
          </div>

          {/* Control Panel */}
          <div className="absolute top-20 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600 max-w-xs">
            <h3 className="text-white font-bold mb-3">Orbital Controls</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Map Style</label>
                <select 
                  value={mapStyle} 
                  onChange={(e) => setMapStyle(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="night">Night Lights</option>
                  <option value="satellite">Satellite</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Satellite Type</label>
                <select 
                  value={satelliteFilter} 
                  onChange={(e) => setSatelliteFilter(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="all">All Satellites</option>
                  <option value="Space Station">Space Stations</option>
                  <option value="Communication">Communication</option>
                  <option value="Navigation">Navigation (GPS)</option>
                  <option value="Weather">Weather</option>
                  <option value="Earth Observation">Earth Observation</option>
                  <option value="Research">Research</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Time Speed: {timeSpeed}x</label>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={timeSpeed}
                  onChange={(e) => setTimeSpeed(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showSatellites}
                    onChange={(e) => setShowSatellites(e.target.checked)}
                    className="mr-2"
                  />
                  Show Satellites
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showOrbits}
                    onChange={(e) => setShowOrbits(e.target.checked)}
                    className="mr-2"
                  />
                  Show Orbits
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showTracks}
                    onChange={(e) => setShowTracks(e.target.checked)}
                    className="mr-2"
                  />
                  Ground Tracks
                </label>
              </div>
            </div>

            {loading && (
              <div className="mt-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mx-auto mb-2"></div>
                <span className="text-gray-300 text-xs">Loading satellite data...</span>
              </div>
            )}
          </div>

          {/* Satellite Info Panel */}
          <div className="absolute top-20 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600 max-w-sm">
            <h3 className="text-white font-bold mb-3">Satellite Data</h3>
            <div className="text-gray-300 text-sm space-y-2">
              <div><strong>Active Satellites:</strong> {filteredSatellites.length}</div>
              <div><strong>Visible Orbits:</strong> {filteredOrbits.length}</div>
              <div><strong>Ground Tracks:</strong> {filteredTracks.length}</div>
              <div><strong>Time Speed:</strong> {timeSpeed}x real-time</div>
              <div><strong>Current Time:</strong> {currentTime.toLocaleTimeString()}</div>
            </div>
            
            {selectedSatellite && (
              <div className="mt-4 border-t border-gray-600 pt-3">
                <h4 className="text-white font-semibold mb-2">Selected: {selectedSatellite.name}</h4>
                <div className="text-xs space-y-1">
                  <div>Type: {selectedSatellite.type}</div>
                  <div>Altitude: {(selectedSatellite.alt * 6371).toFixed(0)} km</div>
                  <div>Velocity: {selectedSatellite.velocity.toFixed(2)} km/s</div>
                  <div>Period: {selectedSatellite.period.toFixed(1)} min</div>
                  <div>Inclination: {selectedSatellite.inclination.toFixed(1)}°</div>
                  <div>Eccentricity: {selectedSatellite.eccentricity.toFixed(4)}</div>
                </div>
              </div>
            )}
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
              backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
              
              // Satellites as points
              pointsData={showSatellites ? filteredSatellites : []}
              pointLat="lat"
              pointLng="lng"
              pointAltitude="alt"
              pointRadius={0.8}
              pointColor={d => getSatelliteColor(d.type)}
              pointLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>${d.name}</strong><br/>
                  Type: ${d.type}<br/>
                  Altitude: ${(d.alt * 6371).toFixed(0)} km<br/>
                  Velocity: ${d.velocity.toFixed(2)} km/s<br/>
                  Period: ${d.period.toFixed(1)} minutes<br/>
                  Inclination: ${d.inclination.toFixed(1)}°<br/>
                  Eccentricity: ${d.eccentricity.toFixed(4)}
                </div>
              `}
              onPointClick={setSelectedSatellite}
              
              // Orbital paths
              pathsData={showOrbits ? filteredOrbits : []}
              pathPoints="points"
              pathPointLat={p => p[0]}
              pathPointLng={p => p[1]}
              pathPointAlt={p => p[2]}
              pathColor="color"
              pathStroke={0.5}
              pathDashLength={0.1}
              pathDashGap={0.05}
              pathDashAnimateTime={10000}
              pathLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>${d.name} Orbit</strong><br/>
                  Type: ${d.type}<br/>
                  Max Altitude: ${(d.altitude * 6371).toFixed(0)} km<br/>
                  Orbit Points: ${d.points.length}
                </div>
              `}
              
              // Ground tracks as arcs
              arcsData={showTracks ? filteredTracks : []}
              arcStartLat={d => d.coords[0]?.[0]}
              arcStartLng={d => d.coords[0]?.[1]}
              arcEndLat={d => d.coords[d.coords.length - 1]?.[0]}
              arcEndLng={d => d.coords[d.coords.length - 1]?.[1]}
              arcColor={d => d.color}
              arcStroke={0.3}
              arcDashLength={0.2}
              arcDashGap={0.1}
              arcDashAnimateTime={5000}
              arcLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>${d.name}</strong><br/>
                  Type: ${d.type}<br/>
                  Track Points: ${d.coords.length}
                </div>
              `}
              
              // Atmosphere
              showAtmosphere={true}
              atmosphereColor="#0080ff"
              atmosphereAltitude={0.1}
              
              // Controls
              enablePointerInteraction={true}
              
              // Events
              onGlobeReady={() => {
                setGlobeReady(true);
                if (globeRef.current) {
                  // Default view
                  globeRef.current.pointOfView({
                    lat: 0,
                    lng: 0,
                    altitude: 3
                  }, 2000);
                  
                  // Enable controls
                  globeRef.current.controls().autoRotate = true;
                  globeRef.current.controls().autoRotateSpeed = 0.5;
                  globeRef.current.controls().enableZoom = true;
                  globeRef.current.controls().enablePan = true;
                }
              }}
            />
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600">
            <h4 className="text-white font-bold mb-2">Legend</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-green-500 mr-3 rounded-full"></div>
                Space Stations
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-blue-500 mr-3 rounded-full"></div>
                Communication
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-orange-500 mr-3 rounded-full"></div>
                Navigation (GPS)
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-pink-500 mr-3 rounded-full"></div>
                Weather
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-yellow-500 mr-2"></div>
                Orbital Paths
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-0.5 bg-cyan-400 mr-2"></div>
                Ground Tracks
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="absolute bottom-4 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-3 border border-green-600">
            <div className="text-gray-300 text-xs">
              <div>Satellites: {satellites.length}</div>
              <div>Orbits: {orbitalPaths.length}</div>
              <div>Tracks: {groundTracks.length}</div>
              <div>Speed: {timeSpeed}x</div>
              <div>Time: {currentTime.toLocaleTimeString()}</div>
            </div>
          </div>
        </Layout>
      </main>
    </>
  );
};

export default SatelliteOrbitVisualization; 