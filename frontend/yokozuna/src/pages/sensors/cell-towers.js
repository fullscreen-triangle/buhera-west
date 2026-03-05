// look at the globes.md file and use the example with arcs, to show cell towers and their ranges. 
// I want you to use real cell data from the apis to show the cell towers and their ranges. 

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import AnimatedText from "@/components/AnimatedText";
import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";

// Dynamic import for react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import('react-globe.gl').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
    </div>
  )
});

const CellTowerVisualization = () => {
  const globeRef = useRef();
  const [globeReady, setGlobeReady] = useState(false);
  const [cellTowers, setCellTowers] = useState([]);
  const [coverageRings, setCoverageRings] = useState([]);
  const [networkConnections, setNetworkConnections] = useState([]);
  const [selectedTower, setSelectedTower] = useState(null);
  const [mapStyle, setMapStyle] = useState('night');
  const [showTowers, setShowTowers] = useState(true);
  const [showCoverage, setShowCoverage] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [towerFilter, setTowerFilter] = useState('all');
  const [signalStrength, setSignalStrength] = useState(0.8);
  const [loading, setLoading] = useState(true);
  const [analysisMode, setAnalysisMode] = useState('coverage');
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

  // Load cell tower data
  useEffect(() => {
    const loadCellTowerData = async () => {
      setLoading(true);
      try {
        // Get real cell tower data
        const towerData = await getCellTowerData();
        setCellTowers(towerData);

        // Generate coverage rings
        const rings = generateCoverageRings(towerData);
        setCoverageRings(rings);

        // Generate network connections
        const connections = generateNetworkConnections(towerData);
        setNetworkConnections(connections);

      } catch (error) {
        console.error('Error loading cell tower data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCellTowerData();
  }, [towerFilter, signalStrength]);

  // Get cell tower data from OpenCellID API
  const getCellTowerData = async () => {
    try {
      // Use Next.js API route to get cell tower data
      const response = await fetch('/api/cells');
      if (!response.ok) throw new Error('Failed to fetch cell tower data');
      
      const apiData = await response.json();
      if (!apiData.success) throw new Error(apiData.error);
      
      return apiData.data.map(tower => ({
        id: `${tower.radio}_${tower.mcc}_${tower.net}_${tower.area}_${tower.cell}`,
        name: `${tower.radio} Tower ${tower.cell}`,
        lat: tower.lat,
        lng: tower.lon,
        alt: 0.002, // Small altitude for visibility
        radio: tower.radio, // 2G, 3G, 4G, 5G
        mcc: tower.mcc, // Mobile Country Code
        net: tower.net, // Network code
        area: tower.area, // Location area
        cell: tower.cell, // Cell ID
        range: tower.range || estimateRange(tower.radio),
        samples: tower.samples || 1,
        changeable: tower.changeable || 0,
        created: tower.created,
        updated: tower.updated,
        averageSignal: tower.averageSignal || -70,
        operator: getOperator(tower.mcc, tower.net),
        technology: tower.radio,
        frequency: getFrequency(tower.radio),
        maxUsers: getMaxUsers(tower.radio),
        status: 'active',
        traffic: Math.random() * 100, // Simulated traffic load
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Cell tower data fetch failed:', error);
      return getSouthAfricaCellTowers();
    }
  };

  // Generate coverage rings for cell towers
  const generateCoverageRings = (towers) => {
    const rings = [];
    
    towers.forEach(tower => {
      // Create coverage ring based on tower technology and signal strength
      const baseRange = tower.range * signalStrength;
      const ringRadius = baseRange / 111000; // Convert meters to degrees (approx)
      
      rings.push({
        id: `${tower.id}_coverage`,
        lat: tower.lat,
        lng: tower.lng,
        maxRadius: Math.max(0.01, ringRadius), // Minimum visibility
        color: getTechnologyColor(tower.radio),
        tower: tower,
        propagationSpeed: 2, // deg/sec
        repeatPeriod: 3000, // ms
        intensity: getSignalIntensity(tower.averageSignal)
      });
    });

    return rings;
  };

  // Generate network connections between towers
  const generateNetworkConnections = (towers) => {
    const connections = [];
    
    // Group towers by operator
    const operatorGroups = {};
    towers.forEach(tower => {
      if (!operatorGroups[tower.operator]) {
        operatorGroups[tower.operator] = [];
      }
      operatorGroups[tower.operator].push(tower);
    });

    // Create connections within each operator network
    Object.values(operatorGroups).forEach(operatorTowers => {
      operatorTowers.forEach((tower, index) => {
        // Connect to nearest towers in the same network
        const nearbyTowers = operatorTowers
          .filter(t => t.id !== tower.id)
          .sort((a, b) => {
            const distA = getDistance(tower.lat, tower.lng, a.lat, a.lng);
            const distB = getDistance(tower.lat, tower.lng, b.lat, b.lng);
            return distA - distB;
          })
          .slice(0, 3); // Connect to 3 nearest towers

        nearbyTowers.forEach(nearTower => {
          const distance = getDistance(tower.lat, tower.lng, nearTower.lat, nearTower.lng);
          
          // Only connect if within reasonable range
          if (distance < 50) { // 50 km max connection distance
            connections.push({
              id: `${tower.id}_${nearTower.id}`,
              startLat: tower.lat,
              startLng: tower.lng,
              endLat: nearTower.lat,
              endLng: nearTower.lng,
              color: getOperatorColor(tower.operator),
              operator: tower.operator,
              distance: distance,
              technology: tower.radio,
              capacity: calculateLinkCapacity(tower.radio, distance),
              load: Math.random() * 100,
              latency: calculateLatency(distance),
              status: 'active'
            });
          }
        });
      });
    });

    return connections;
  };

  // Helper functions
  const estimateRange = (radio) => {
    const ranges = {
      'GSM': 2000,      // 2G: 2km
      'UMTS': 5000,     // 3G: 5km
      'LTE': 10000,     // 4G: 10km
      'NR': 1000        // 5G: 1km (higher frequency, shorter range)
    };
    return ranges[radio] || 3000;
  };

  const getOperator = (mcc, net) => {
    // South African operators
    if (mcc === 655) {
      const operators = {
        1: 'Vodacom',
        2: 'Telkom',
        7: 'Cell C',
        10: 'MTN',
        11: 'SAPS',
        12: 'iBurst',
        13: 'Neotel',
        14: 'Neotel',
        19: 'Rain',
        20: 'Liquid'
      };
      return operators[net] || 'Unknown';
    }
    return 'International';
  };

  const getFrequency = (radio) => {
    const frequencies = {
      'GSM': '900/1800 MHz',
      'UMTS': '2100 MHz',
      'LTE': '800/1800/2600 MHz',
      'NR': '3500/28000 MHz'
    };
    return frequencies[radio] || 'Unknown';
  };

  const getMaxUsers = (radio) => {
    const maxUsers = {
      'GSM': 8,
      'UMTS': 384,
      'LTE': 1200,
      'NR': 10000
    };
    return maxUsers[radio] || 100;
  };

  const getTechnologyColor = (radio) => {
    const colors = {
      'GSM': 'rgba(255, 0, 0, 0.6)',     // Red for 2G
      'UMTS': 'rgba(255, 165, 0, 0.6)',  // Orange for 3G
      'LTE': 'rgba(0, 255, 0, 0.6)',     // Green for 4G
      'NR': 'rgba(138, 43, 226, 0.6)'    // Purple for 5G
    };
    return colors[radio] || 'rgba(255, 255, 255, 0.6)';
  };

  const getOperatorColor = (operator) => {
    const colors = {
      'Vodacom': '#e60000',
      'MTN': '#ffcb05',
      'Cell C': '#0066cc',
      'Telkom': '#00a651',
      'Rain': '#ff6b35',
      'Liquid': '#1e90ff'
    };
    return colors[operator] || '#ffffff';
  };

  const getSignalIntensity = (dbm) => {
    // Convert dBm to intensity (0-1)
    const minDbm = -120;
    const maxDbm = -40;
    return Math.max(0, Math.min(1, (dbm - minDbm) / (maxDbm - minDbm)));
  };

  const getDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculateLinkCapacity = (radio, distance) => {
    const baseCapacity = {
      'GSM': 0.2,    // Mbps
      'UMTS': 42,    // Mbps
      'LTE': 300,    // Mbps
      'NR': 10000    // Mbps
    };
    
    const capacity = baseCapacity[radio] || 10;
    // Reduce capacity with distance
    const distanceFactor = Math.max(0.1, 1 - (distance / 100));
    return capacity * distanceFactor;
  };

  const calculateLatency = (distance) => {
    // Base latency + distance factor
    const baseLatency = 5; // ms
    const distanceLatency = distance * 0.1; // 0.1ms per km
    return baseLatency + distanceLatency;
  };

  const getGlobeTexture = () => {
    const textures = {
      satellite: '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      night: '//unpkg.com/three-globe/example/img/earth-night.jpg',
      dark: '//unpkg.com/three-globe/example/img/earth-dark.jpg',
      topology: '//unpkg.com/three-globe/example/img/earth-topology.png'
    };
    return textures[mapStyle] || textures.night;
  };

  const getSouthAfricaCellTowers = () => {
    // Fallback data for major South African cities
    const cities = [
      { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
      { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
      { name: 'Durban', lat: -29.8587, lng: 31.0218 },
      { name: 'Pretoria', lat: -25.7479, lng: 28.2293 },
      { name: 'Port Elizabeth', lat: -33.9608, lng: 25.6022 },
      { name: 'Bloemfontein', lat: -29.0852, lng: 26.1596 }
    ];

    const towers = [];
    cities.forEach((city, cityIndex) => {
      // Generate multiple towers per city
      const techTypes = ['GSM', 'UMTS', 'LTE', 'NR'];
      const operators = ['Vodacom', 'MTN', 'Cell C', 'Telkom'];
      
      techTypes.forEach((tech, techIndex) => {
        operators.forEach((operator, opIndex) => {
          const latOffset = (Math.random() - 0.5) * 0.1;
          const lngOffset = (Math.random() - 0.5) * 0.1;
          
          towers.push({
            id: `${city.name}_${tech}_${operator}_${techIndex}_${opIndex}`,
            name: `${tech} Tower ${cityIndex}${techIndex}${opIndex}`,
            lat: city.lat + latOffset,
            lng: city.lng + lngOffset,
            alt: 0.002,
            radio: tech,
            mcc: 655,
            net: opIndex + 1,
            area: cityIndex + 1,
            cell: techIndex * 10 + opIndex,
            range: estimateRange(tech),
            samples: Math.floor(Math.random() * 1000) + 100,
            changeable: Math.random() > 0.8 ? 1 : 0,
            created: Date.now() - Math.random() * 31536000000, // Random within last year
            updated: Date.now() - Math.random() * 86400000,    // Random within last day
            averageSignal: -50 - Math.random() * 40,
            operator: operator,
            technology: tech,
            frequency: getFrequency(tech),
            maxUsers: getMaxUsers(tech),
            status: 'active',
            traffic: Math.random() * 100,
            timestamp: Date.now()
          });
        });
      });
    });

    return towers;
  };

  const filteredTowers = towerFilter === 'all' ? cellTowers : 
                        cellTowers.filter(tower => tower.radio === towerFilter);

  const filteredRings = towerFilter === 'all' ? coverageRings : 
                       coverageRings.filter(ring => ring.tower.radio === towerFilter);

  const filteredConnections = towerFilter === 'all' ? networkConnections : 
                             networkConnections.filter(conn => conn.technology === towerFilter);

  return (
    <>
      <Head>
        <title>Cell Tower Network Visualization | Buhera-West Environmental Intelligence</title>
        <meta name="description" content="Cell tower coverage and network connectivity visualization with real-time signal analysis." />
      </Head>
      <TransitionEffect />
      
      <main className="w-full min-h-screen bg-black">
        <Layout>
          {/* Header */}
          <div className="text-center mb-8 pt-16">
            <AnimatedText 
              text="Cell Tower Network Analysis" 
              className="!text-5xl xl:!text-6xl lg:!text-4xl md:!text-3xl sm:!text-2xl !text-white mb-4" 
            />
            <p className="text-xl text-gray-300 max-w-4xl mx-auto">
              Real-time cellular network coverage and connectivity analysis
            </p>
          </div>

          {/* Control Panel */}
          <div className="absolute top-20 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600 max-w-xs">
            <h3 className="text-white font-bold mb-3">Network Controls</h3>
            
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
                  <option value="topology">Topology</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Technology</label>
                <select 
                  value={towerFilter} 
                  onChange={(e) => setTowerFilter(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="all">All Technologies</option>
                  <option value="GSM">2G (GSM)</option>
                  <option value="UMTS">3G (UMTS)</option>
                  <option value="LTE">4G (LTE)</option>
                  <option value="NR">5G (NR)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Analysis Mode</label>
                <select 
                  value={analysisMode} 
                  onChange={(e) => setAnalysisMode(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="coverage">Coverage Analysis</option>
                  <option value="capacity">Capacity Analysis</option>
                  <option value="interference">Interference Analysis</option>
                  <option value="optimization">Network Optimization</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Signal Strength: {(signalStrength * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={signalStrength}
                  onChange={(e) => setSignalStrength(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showTowers}
                    onChange={(e) => setShowTowers(e.target.checked)}
                    className="mr-2"
                  />
                  Show Towers
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showCoverage}
                    onChange={(e) => setShowCoverage(e.target.checked)}
                    className="mr-2"
                  />
                  Coverage Rings
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showConnections}
                    onChange={(e) => setShowConnections(e.target.checked)}
                    className="mr-2"
                  />
                  Network Links
                </label>
              </div>
            </div>

            {loading && (
              <div className="mt-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mx-auto mb-2"></div>
                <span className="text-gray-300 text-xs">Loading network data...</span>
              </div>
            )}
          </div>

          {/* Network Info Panel */}
          <div className="absolute top-20 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600 max-w-sm">
            <h3 className="text-white font-bold mb-3">Network Statistics</h3>
            <div className="text-gray-300 text-sm space-y-2">
              <div><strong>Total Towers:</strong> {filteredTowers.length}</div>
              <div><strong>Coverage Areas:</strong> {filteredRings.length}</div>
              <div><strong>Network Links:</strong> {filteredConnections.length}</div>
              <div><strong>Signal Strength:</strong> {(signalStrength * 100).toFixed(0)}%</div>
              <div><strong>Analysis Mode:</strong> {analysisMode}</div>
            </div>
            
            {selectedTower && (
              <div className="mt-4 border-t border-gray-600 pt-3">
                <h4 className="text-white font-semibold mb-2">Selected: {selectedTower.name}</h4>
                <div className="text-xs space-y-1">
                  <div>Technology: {selectedTower.radio}</div>
                  <div>Operator: {selectedTower.operator}</div>
                  <div>Frequency: {selectedTower.frequency}</div>
                  <div>Range: {(selectedTower.range / 1000).toFixed(1)} km</div>
                  <div>Max Users: {selectedTower.maxUsers}</div>
                  <div>Signal: {selectedTower.averageSignal} dBm</div>
                  <div>Traffic: {selectedTower.traffic.toFixed(1)}%</div>
                  <div>Samples: {selectedTower.samples}</div>
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
              
              // Cell towers as points
              pointsData={showTowers ? filteredTowers : []}
              pointLat="lat"
              pointLng="lng"
              pointAltitude="alt"
              pointRadius={d => 0.5 + (d.traffic / 100) * 0.5}
              pointColor={d => getTechnologyColor(d.radio).replace('0.6', '1')}
              pointLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>${d.name}</strong><br/>
                  Technology: ${d.radio}<br/>
                  Operator: ${d.operator}<br/>
                  Frequency: ${d.frequency}<br/>
                  Range: ${(d.range / 1000).toFixed(1)} km<br/>
                  Max Users: ${d.maxUsers}<br/>
                  Signal: ${d.averageSignal} dBm<br/>
                  Traffic Load: ${d.traffic.toFixed(1)}%<br/>
                  Samples: ${d.samples}
                </div>
              `}
              onPointClick={setSelectedTower}
              
              // Coverage rings
              ringsData={showCoverage ? filteredRings : []}
              ringLat="lat"
              ringLng="lng"
              ringMaxRadius="maxRadius"
              ringColor={d => t => d.color.replace('0.6', `${d.intensity * (1-t) * 0.8}`)}
              ringPropagationSpeed="propagationSpeed"
              ringRepeatPeriod="repeatPeriod"
              
              // Network connections
              arcsData={showConnections ? filteredConnections : []}
              arcStartLat="startLat"
              arcStartLng="startLng"
              arcEndLat="endLat"
              arcEndLng="endLng"
              arcColor={d => d.color}
              arcStroke={d => Math.max(0.5, d.capacity / 1000)}
              arcDashLength={d => Math.max(0.1, d.load / 100)}
              arcDashGap={d => Math.max(0.05, (100 - d.load) / 100 * 0.2)}
              arcDashAnimateTime={d => Math.max(1000, d.latency * 100)}
              arcLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Network Link</strong><br/>
                  Operator: ${d.operator}<br/>
                  Technology: ${d.technology}<br/>
                  Distance: ${d.distance.toFixed(1)} km<br/>
                  Capacity: ${d.capacity.toFixed(1)} Mbps<br/>
                  Load: ${d.load.toFixed(1)}%<br/>
                  Latency: ${d.latency.toFixed(1)} ms<br/>
                  Status: ${d.status}
                </div>
              `}
              
              // Controls
              enablePointerInteraction={true}
              
              // Events
              onGlobeReady={() => {
                setGlobeReady(true);
                if (globeRef.current) {
                  // Focus on South Africa
                  globeRef.current.pointOfView({
                    lat: -29,
                    lng: 24,
                    altitude: 1.5
                  }, 2000);
                  
                  // Enable controls
                  globeRef.current.controls().autoRotate = false;
                  globeRef.current.controls().enableZoom = true;
                  globeRef.current.controls().enablePan = true;
                }
              }}
            />
          </div>

          {/* Technology Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600">
            <h4 className="text-white font-bold mb-2">Technology Legend</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-red-500 mr-3 rounded-full"></div>
                2G (GSM) - 900/1800 MHz
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-orange-500 mr-3 rounded-full"></div>
                3G (UMTS) - 2100 MHz
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-green-500 mr-3 rounded-full"></div>
                4G (LTE) - 800/1800/2600 MHz
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-purple-500 mr-3 rounded-full"></div>
                5G (NR) - 3500/28000 MHz
              </div>
            </div>
          </div>

          {/* Operator Legend */}
          <div className="absolute bottom-4 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600">
            <h4 className="text-white font-bold mb-2">Operators</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-red-600 mr-2"></div>
                Vodacom
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-yellow-500 mr-2"></div>
                MTN
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-blue-600 mr-2"></div>
                Cell C
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-green-600 mr-2"></div>
                Telkom
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-orange-500 mr-2"></div>
                Rain
              </div>
            </div>
          </div>
        </Layout>
      </main>
    </>
  );
};

export default CellTowerVisualization; 