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

const MaritimeTrafficAnalysis = () => {
  const globeRef = useRef();
  const [globeReady, setGlobeReady] = useState(false);
  const [shippingRoutes, setShippingRoutes] = useState([]);
  const [vesselTraffic, setVesselTraffic] = useState([]);
  const [oceanCurrents, setOceanCurrents] = useState([]);
  const [ports, setPorts] = useState([]);
  const [submarineCables, setSubmarineCables] = useState([]);
  const [weatherData, setWeatherData] = useState([]);
  const [mapStyle, setMapStyle] = useState('satellite');
  const [showRoutes, setShowRoutes] = useState(true);
  const [showVessels, setShowVessels] = useState(true);
  const [showCurrents, setShowCurrents] = useState(true);
  const [showPorts, setShowPorts] = useState(true);
  const [showCables, setShowCables] = useState(false);
  const [vesselFilter, setVesselFilter] = useState('all');
  const [trafficDensity, setTrafficDensity] = useState('medium');
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());
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

  // Auto-update vessels every 30 seconds to simulate real-time tracking
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
      updateVesselPositions();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load maritime traffic and ocean data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Get real submarine cable data for reference
        const cableData = await globalDataService.getRealCableData();
        setSubmarineCables(cableData);

        // Get real weather data for maritime conditions
        const weatherPoints = await globalDataService.getRealWeatherData();
        setWeatherData(weatherPoints);

        // Generate shipping routes based on real ocean currents
        const routeData = await generateShippingRoutes();
        setShippingRoutes(routeData);

        // Generate vessel traffic along the routes
        const vesselData = await generateVesselTraffic(routeData);
        setVesselTraffic(vesselData);

        // Generate ocean current data
        const currentData = await generateOceanCurrentData();
        setOceanCurrents(currentData);

        // Generate major ports data
        const portData = await generateMajorPorts();
        setPorts(portData);

      } catch (error) {
        console.error('Error loading maritime data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [trafficDensity]);

  // Generate major shipping routes around South Africa
  const generateShippingRoutes = async () => {
    const majorRoutes = [
      {
        name: 'Cape Route - Europe to Asia',
        type: 'container',
        coords: [
          [18.4, -34.1], // Cape Town
          [20.0, -35.0], // Cape Agulhas
          [25.0, -35.5], // Along Agulhas Bank
          [30.0, -33.0], // Durban approach
          [31.0, -29.5], // Durban
          [35.0, -26.0], // Madagascar Channel
          [40.0, -20.0], // Mozambique Channel
          [45.0, -15.0], // Towards Suez
        ],
        traffic_density: 0.9,
        vessel_types: ['container', 'tanker', 'bulk']
      },
      {
        name: 'West African Coastal Route',
        type: 'coastal',
        coords: [
          [18.4, -34.1], // Cape Town
          [17.5, -32.0], // Along Benguela Current
          [16.0, -28.0], // Namibian Coast
          [14.5, -23.0], // Walvis Bay approach
          [14.4, -22.9], // Walvis Bay
          [13.0, -18.0], // Angola Coast
          [12.0, -15.0], // Luanda approach
          [11.2, -8.8],  // Luanda
        ],
        traffic_density: 0.7,
        vessel_types: ['tanker', 'bulk', 'fishing']
      },
      {
        name: 'Indian Ocean Route',
        type: 'international',
        coords: [
          [31.0, -29.5], // Durban
          [32.5, -28.0], // KZN Coast
          [35.0, -25.0], // Mozambique
          [40.0, -22.0], // Madagascar
          [45.0, -18.0], // Mauritius approach
          [57.5, -20.2], // Mauritius
          [60.0, -18.0], // Towards India
        ],
        traffic_density: 0.8,
        vessel_types: ['container', 'tanker', 'passenger']
      },
      {
        name: 'Southern Ocean Route',
        type: 'deep_sea',
        coords: [
          [18.4, -34.1], // Cape Town
          [15.0, -40.0], // Deep Southern Ocean
          [10.0, -42.0], // Towards Atlantic
          [0.0, -45.0],   // Mid-Atlantic
          [-10.0, -42.0], // South America approach
          [-20.0, -40.0], // Argentina Coast
        ],
        traffic_density: 0.4,
        vessel_types: ['bulk', 'research', 'fishing']
      },
      {
        name: 'Coastal Fishing Routes - Benguela',
        type: 'fishing',
        coords: [
          [18.4, -34.1], // Cape Town
          [17.8, -33.0], // Table Bay
          [17.2, -32.0], // West Coast
          [16.5, -30.0], // Saldanha Bay
          [15.8, -28.0], // Benguela Upwelling
          [15.0, -26.0], // Rich fishing grounds
          [14.5, -24.0], // Namibian EEZ
        ],
        traffic_density: 0.6,
        vessel_types: ['fishing', 'research']
      },
      {
        name: 'Coastal Fishing Routes - Agulhas',
        type: 'fishing',
        coords: [
          [31.0, -29.5], // Durban
          [30.0, -31.0], // KZN Shelf
          [28.0, -33.0], // Agulhas Bank
          [25.0, -35.0], // Rich fishing area
          [22.0, -35.5], // Cape Agulhas region
          [20.0, -35.0], // False Bay approach
          [18.4, -34.1], // Cape Town
        ],
        traffic_density: 0.7,
        vessel_types: ['fishing', 'research', 'patrol']
      }
    ];

    return majorRoutes.map(route => ({
      ...route,
      id: route.name.toLowerCase().replace(/\s+/g, '_'),
      color: getRouteColor(route.type),
      width: getRouteWidth(route.traffic_density)
    }));
  };

  // Generate vessel traffic along shipping routes
  const generateVesselTraffic = async (routes) => {
    const vessels = [];
    const densityMultiplier = trafficDensity === 'high' ? 2 : trafficDensity === 'low' ? 0.5 : 1;

    routes.forEach(route => {
      const vesselCount = Math.floor(route.traffic_density * 15 * densityMultiplier);
      
      for (let i = 0; i < vesselCount; i++) {
        // Distribute vessels along the route
        const progress = Math.random();
        const segmentIndex = Math.floor(progress * (route.coords.length - 1));
        const segmentProgress = (progress * (route.coords.length - 1)) - segmentIndex;
        
        const startCoord = route.coords[segmentIndex];
        const endCoord = route.coords[segmentIndex + 1] || startCoord;
        
        // Interpolate position along route segment
        const lat = startCoord[1] + (endCoord[1] - startCoord[1]) * segmentProgress;
        const lng = startCoord[0] + (endCoord[0] - startCoord[0]) * segmentProgress;
        
        // Add current influence based on proximity to ocean currents
        const currentInfluence = calculateCurrentInfluence(lat, lng);
        
        vessels.push({
          id: `vessel_${route.id}_${i}`,
          name: generateVesselName(route.vessel_types[i % route.vessel_types.length]),
          type: route.vessel_types[i % route.vessel_types.length],
          lat: lat + currentInfluence.latOffset,
          lng: lng + currentInfluence.lngOffset,
          heading: calculateHeading(startCoord, endCoord) + currentInfluence.headingOffset,
          speed: getVesselSpeed(route.vessel_types[i % route.vessel_types.length]),
          route: route.name,
          status: getVesselStatus(),
          destination: getDestination(route),
          cargo: getCargo(route.vessel_types[i % route.vessel_types.length]),
          flag: getFlag(),
          size: getVesselSize(route.vessel_types[i % route.vessel_types.length]),
          timestamp: currentTime
        });
      }
    });

    return vessels;
  };

  // Calculate ocean current influence on vessel positions
  const calculateCurrentInfluence = (lat, lng) => {
    let latOffset = 0;
    let lngOffset = 0;
    let headingOffset = 0;

    // Agulhas Current influence (stronger, southwestward flow)
    if (lng > 25 && lat > -35 && lat < -26) {
      const agulhasStrength = 1.0 - Math.abs(lng - 31) / 10; // Stronger near 31°E
      latOffset -= agulhasStrength * 0.02; // Southward push
      lngOffset -= agulhasStrength * 0.03; // Westward push
      headingOffset += agulhasStrength * 15; // Heading adjustment
    }

    // Benguela Current influence (weaker, northward flow)
    if (lng < 20 && lat > -35 && lat < -15) {
      const benguelaStrength = 1.0 - Math.abs(lng - 15) / 8; // Stronger near 15°E
      latOffset += benguelaStrength * 0.015; // Northward push
      lngOffset -= benguelaStrength * 0.01; // Slight westward
      headingOffset -= benguelaStrength * 10; // Heading adjustment
    }

    return { latOffset, lngOffset, headingOffset };
  };

  // Generate ocean current visualization data
  const generateOceanCurrentData = async () => {
    const agulhasCurrentArcs = [];
    const benguelaCurrentArcs = [];

    // Agulhas Current flow arcs
    const agulhasPath = [
      [32.8, -26.0], [32.5, -28.0], [31.8, -30.0], [30.5, -32.0],
      [28.0, -34.0], [25.0, -35.0], [22.0, -36.0], [19.0, -37.0]
    ];

    for (let i = 0; i < agulhasPath.length - 1; i++) {
      agulhasCurrentArcs.push({
        startLat: agulhasPath[i][1],
        startLng: agulhasPath[i][0],
        endLat: agulhasPath[i + 1][1],
        endLng: agulhasPath[i + 1][0],
        color: '#ff4444',
        strength: 0.8 - (i * 0.1)
      });
    }

    // Benguela Current flow arcs
    const benguelaPath = [
      [18.5, -34.0], [17.8, -32.0], [16.5, -28.0], [14.8, -24.0],
      [13.2, -20.0], [12.0, -16.0], [11.5, -12.0]
    ];

    for (let i = 0; i < benguelaPath.length - 1; i++) {
      benguelaCurrentArcs.push({
        startLat: benguelaPath[i][1],
        startLng: benguelaPath[i][0],
        endLat: benguelaPath[i + 1][1],
        endLng: benguelaPath[i + 1][0],
        color: '#0066cc',
        strength: 0.6 - (i * 0.08)
      });
    }

    return [...agulhasCurrentArcs, ...benguelaCurrentArcs];
  };

  // Generate major ports data
  const generateMajorPorts = async () => {
    return [
      {
        name: 'Port of Cape Town',
        lat: -33.9,
        lng: 18.4,
        type: 'container',
        size: 'major',
        throughput: '1.2M TEU/year',
        facilities: 'Container, Breakbulk, Cruise'
      },
      {
        name: 'Port of Durban',
        lat: -29.85,
        lng: 31.0,
        type: 'container',
        size: 'major',
        throughput: '2.8M TEU/year',
        facilities: 'Container, Automotive, Bulk'
      },
      {
        name: 'Port Elizabeth',
        lat: -33.96,
        lng: 25.6,
        type: 'automotive',
        size: 'medium',
        throughput: '1.5M vehicles/year',
        facilities: 'Automotive, Container, Fruit'
      },
      {
        name: 'Saldanha Bay',
        lat: -33.0,
        lng: 17.9,
        type: 'bulk',
        size: 'medium',
        throughput: '60M tons/year',
        facilities: 'Iron Ore, Oil Terminal'
      },
      {
        name: 'Walvis Bay',
        lat: -22.9,
        lng: 14.4,
        type: 'fishing',
        size: 'medium',
        throughput: '800K tons/year',
        facilities: 'Fishing, Container, Bulk'
      },
      {
        name: 'Richards Bay',
        lat: -28.8,
        lng: 32.1,
        type: 'bulk',
        size: 'major',
        throughput: '90M tons/year',
        facilities: 'Coal, Aluminium, Woodchips'
      }
    ];
  };

  // Update vessel positions for real-time simulation
  const updateVesselPositions = () => {
    setVesselTraffic(prevVessels => 
      prevVessels.map(vessel => {
        // Simulate vessel movement along routes
        const moveDistance = (vessel.speed * 0.5) / 3600; // Approximate movement in degrees
        const headingRad = vessel.heading * Math.PI / 180;
        
        const newLat = vessel.lat + Math.cos(headingRad) * moveDistance;
        const newLng = vessel.lng + Math.sin(headingRad) * moveDistance;
        
        return {
          ...vessel,
          lat: newLat,
          lng: newLng,
          timestamp: currentTime
        };
      })
    );
  };

  // Helper functions for vessel generation
  const getRouteColor = (type) => {
    const colors = {
      container: '#00ff00',
      coastal: '#ffff00',
      international: '#ff8800',
      deep_sea: '#8800ff',
      fishing: '#00ffff'
    };
    return colors[type] || '#ffffff';
  };

  const getRouteWidth = (density) => Math.max(1, density * 3);

  const generateVesselName = (type) => {
    const prefixes = {
      container: ['MSC', 'Maersk', 'COSCO', 'Evergreen'],
      tanker: ['Shell', 'BP', 'Exxon', 'Total'],
      bulk: ['Capesize', 'Panamax', 'Handymax'],
      fishing: ['Atlantic', 'Benguela', 'Agulhas'],
      passenger: ['MSC', 'Royal', 'Celebrity'],
      research: ['SA Agulhas', 'RV', 'FRS'],
      patrol: ['SAS', 'SANDF', 'Fisheries']
    };
    const prefix = prefixes[type]?.[Math.floor(Math.random() * prefixes[type].length)] || 'MV';
    const number = Math.floor(Math.random() * 9999);
    return `${prefix} ${number}`;
  };

  const calculateHeading = (start, end) => {
    const dLng = end[0] - start[0];
    const dLat = end[1] - start[1];
    return Math.atan2(dLng, dLat) * 180 / Math.PI;
  };

  const getVesselSpeed = (type) => {
    const speeds = {
      container: 18 + Math.random() * 6,
      tanker: 12 + Math.random() * 4,
      bulk: 14 + Math.random() * 4,
      fishing: 8 + Math.random() * 4,
      passenger: 20 + Math.random() * 5,
      research: 10 + Math.random() * 3,
      patrol: 25 + Math.random() * 10
    };
    return speeds[type] || 15;
  };

  const getVesselStatus = () => {
    const statuses = ['Under way using engine', 'At anchor', 'Moored', 'Fishing', 'Restricted maneuverability'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  const getDestination = (route) => {
    const destinations = {
      'Cape Route - Europe to Asia': ['Singapore', 'Shanghai', 'Rotterdam', 'Hamburg'],
      'West African Coastal Route': ['Lagos', 'Luanda', 'Walvis Bay', 'Cape Town'],
      'Indian Ocean Route': ['Mumbai', 'Durban', 'Mauritius', 'Singapore']
    };
    const routeDests = destinations[route.name] || ['Unknown'];
    return routeDests[Math.floor(Math.random() * routeDests.length)];
  };

  const getCargo = (type) => {
    const cargos = {
      container: ['Electronics', 'Clothing', 'Machinery', 'Consumer Goods'],
      tanker: ['Crude Oil', 'Refined Products', 'Chemicals', 'LNG'],
      bulk: ['Iron Ore', 'Coal', 'Grain', 'Bauxite'],
      fishing: ['Fresh Fish', 'Processed Fish', 'Fishmeal'],
      passenger: ['Passengers', 'Vehicles', 'Cargo'],
      research: ['Scientific Equipment', 'Samples'],
      patrol: ['Military Equipment']
    };
    const typeCargos = cargos[type] || ['General Cargo'];
    return typeCargos[Math.floor(Math.random() * typeCargos.length)];
  };

  const getFlag = () => {
    const flags = ['South Africa', 'Liberia', 'Panama', 'Marshall Islands', 'Singapore', 'Malta', 'Cyprus'];
    return flags[Math.floor(Math.random() * flags.length)];
  };

  const getVesselSize = (type) => {
    const sizes = {
      container: 'Large (300m+)',
      tanker: 'Very Large (250m+)',
      bulk: 'Large (200m+)',
      fishing: 'Small (30-80m)',
      passenger: 'Large (200m+)',
      research: 'Medium (80-120m)',
      patrol: 'Medium (60-100m)'
    };
    return sizes[type] || 'Medium';
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

  const getVesselColor = (type) => {
    const colors = {
      container: '#00ff00',
      tanker: '#ff4444',
      bulk: '#ffaa00',
      fishing: '#00ffff',
      passenger: '#ff00ff',
      research: '#ffffff',
      patrol: '#ffff00'
    };
    return colors[type] || '#888888';
  };

  const filteredVessels = vesselFilter === 'all' ? vesselTraffic : 
                         vesselTraffic.filter(vessel => vessel.type === vesselFilter);

  return (
    <>
      <Head>
        <title>Maritime Traffic Analysis | Buhera-West Environmental Intelligence</title>
        <meta name="description" content="Real-time maritime traffic visualization along the Agulhas and Benguela ocean currents." />
      </Head>
      <TransitionEffect />
      
      <main className="w-full min-h-screen bg-black">
        <Layout>
          {/* Header */}
          <div className="text-center mb-8 pt-16">
            <AnimatedText 
              text="Maritime Traffic Intelligence" 
              className="!text-5xl xl:!text-6xl lg:!text-4xl md:!text-3xl sm:!text-2xl !text-white mb-4" 
            />
            <p className="text-xl text-gray-300 max-w-4xl mx-auto">
              Real-time sea traffic analysis along the Agulhas and Benguela current systems
            </p>
          </div>

          {/* Control Panel */}
          <div className="absolute top-20 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-600 max-w-xs">
            <h3 className="text-white font-bold mb-3">Maritime Controls</h3>
            
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

              <div>
                <label className="block text-gray-300 text-sm mb-1">Vessel Filter</label>
                <select 
                  value={vesselFilter} 
                  onChange={(e) => setVesselFilter(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="all">All Vessels</option>
                  <option value="container">Container Ships</option>
                  <option value="tanker">Tankers</option>
                  <option value="bulk">Bulk Carriers</option>
                  <option value="fishing">Fishing Vessels</option>
                  <option value="passenger">Passenger Ships</option>
                  <option value="research">Research Vessels</option>
                  <option value="patrol">Patrol Boats</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Traffic Density</label>
                <select 
                  value={trafficDensity} 
                  onChange={(e) => setTrafficDensity(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="low">Low Traffic</option>
                  <option value="medium">Medium Traffic</option>
                  <option value="high">High Traffic</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showRoutes}
                    onChange={(e) => setShowRoutes(e.target.checked)}
                    className="mr-2"
                  />
                  Shipping Routes
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showVessels}
                    onChange={(e) => setShowVessels(e.target.checked)}
                    className="mr-2"
                  />
                  Vessel Traffic
                </label>
                
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
                    checked={showPorts}
                    onChange={(e) => setShowPorts(e.target.checked)}
                    className="mr-2"
                  />
                  Major Ports
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
              </div>
            </div>

            {loading && (
              <div className="mt-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <span className="text-gray-300 text-xs">Loading traffic data...</span>
              </div>
            )}
          </div>

          {/* Traffic Data Panel */}
          <div className="absolute top-20 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-600 max-w-sm">
            <h3 className="text-white font-bold mb-3">Maritime Traffic Data</h3>
            <div className="text-gray-300 text-sm space-y-2">
              <div><strong>Active Vessels:</strong> {filteredVessels.length}</div>
              <div><strong>Shipping Routes:</strong> {shippingRoutes.length}</div>
              <div><strong>Major Ports:</strong> {ports.length}</div>
              <div><strong>Current Systems:</strong> 2 (Agulhas, Benguela)</div>
              <div><strong>Last Update:</strong> {new Date(currentTime).toLocaleTimeString()}</div>
            </div>
            
            <div className="mt-4 border-t border-gray-600 pt-3">
              <h4 className="text-white font-semibold mb-2">Vessel Types</h4>
              <div className="text-xs space-y-1">
                {['container', 'tanker', 'bulk', 'fishing'].map(type => (
                  <div key={type} className="flex justify-between">
                    <span className="capitalize">{type}:</span>
                    <span>{vesselTraffic.filter(v => v.type === type).length}</span>
                  </div>
                ))}
              </div>
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
              arcsData={showCurrents ? oceanCurrents : []}
              arcColor="color"
              arcStroke={d => d.strength * 3}
              arcDashLength={0.4}
              arcDashGap={0.2}
              arcDashInitialGap={() => Math.random()}
              arcDashAnimateTime={2000}
              arcLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>${d.color === '#ff4444' ? 'Agulhas Current' : 'Benguela Current'}</strong><br/>
                  Strength: ${(d.strength * 100).toFixed(0)}%<br/>
                  Direction: ${d.color === '#ff4444' ? 'Southwest' : 'Northwest'}
                </div>
              `}
              
              // Combined paths data (shipping routes and submarine cables)
              pathsData={[
                ...(showRoutes ? shippingRoutes.map(route => ({...route, pathType: 'route'})) : []),
                ...(showCables ? submarineCables.map(cable => ({...cable, pathType: 'cable'})) : [])
              ]}
              pathPoints="coords"
              pathPointLat={d => d[1]}
              pathPointLng={d => d[0]}
              pathColor={d => d.pathType === 'cable' ? '#ff6600' : d.color}
              pathStroke={d => d.pathType === 'cable' ? 1 : d.width}
              pathLabel={d => d.pathType === 'cable' ? `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Submarine Cable</strong><br/>
                  ${d.name || 'Fiber Optic Cable'}
                </div>
              ` : `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>${d.name}</strong><br/>
                  Type: ${d.type}<br/>
                  Traffic Density: ${(d.traffic_density * 100).toFixed(0)}%<br/>
                  Vessel Types: ${d.vessel_types.join(', ')}
                </div>
              `}
              
              // Vessel traffic as points
              pointsData={showVessels ? filteredVessels : []}
              pointLat="lat"
              pointLng="lng"
              pointColor={d => getVesselColor(d.type)}
              pointAltitude={0.01}
              pointRadius={0.3}
              pointLabel={d => `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>${d.name}</strong><br/>
                  Type: ${d.type}<br/>
                  Speed: ${d.speed.toFixed(1)} knots<br/>
                  Heading: ${d.heading.toFixed(0)}°<br/>
                  Status: ${d.status}<br/>
                  Destination: ${d.destination}<br/>
                  Cargo: ${d.cargo}<br/>
                  Flag: ${d.flag}<br/>
                  Size: ${d.size}
                </div>
              `}
              
              // Major ports
              labelsData={showPorts ? ports : []}
              labelLat="lat"
              labelLng="lng"
              labelText="name"
              labelSize={1.5}
              labelColor={() => '#ffff00'}
              labelResolution={2}
              labelAltitude={0.02}
              
              // Atmosphere
              showAtmosphere={true}
              atmosphereColor="#4169e1"
              atmosphereAltitude={0.12}
              
              // Controls
              enablePointerInteraction={true}
              
              // Events
              onGlobeReady={() => {
                setGlobeReady(true);
                if (globeRef.current) {
                  // Focus on South African waters
                  globeRef.current.pointOfView({
                    lat: -30,
                    lng: 25,
                    altitude: 2.5
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
          <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-600">
            <h4 className="text-white font-bold mb-2">Legend</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-2 bg-green-500 mr-2 rounded"></div>
                Container Ships
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-2 bg-red-500 mr-2 rounded"></div>
                Tankers / Agulhas Current
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-2 bg-blue-500 mr-2 rounded"></div>
                Bulk Carriers / Benguela Current
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-2 bg-cyan-400 mr-2 rounded"></div>
                Fishing Vessels
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-yellow-500 mr-2"></div>
                Shipping Routes
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-yellow-500 mr-3 rounded-full"></div>
                Major Ports
              </div>
            </div>
          </div>

          {/* Performance Info */}
          <div className="absolute bottom-4 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-3 border border-blue-600">
            <div className="text-gray-300 text-xs">
              <div>Vessels: {filteredVessels.length}</div>
              <div>Routes: {shippingRoutes.length}</div>
              <div>Ports: {ports.length}</div>
              <div>Currents: {oceanCurrents.length}</div>
              <div>Update: Live</div>
            </div>
          </div>
        </Layout>
      </main>
    </>
  );
};

export default MaritimeTrafficAnalysis;
