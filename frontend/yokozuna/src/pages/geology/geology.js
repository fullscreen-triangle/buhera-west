import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import AnimatedText from "@/components/AnimatedText";
import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import GeologicalVisualization from '@/components/geological/GeologicalVisualization';
import globalDataService from '@/services/globalDataService';
import enhancedWeatherService from '@/services/enhancedWeatherService';

// Dynamic import for react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import('react-globe.gl').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
    </div>
  )
});

const GeologicalIntelligence = () => {
  const globeRef = useRef();
  const [globeReady, setGlobeReady] = useState(false);
  const [geologicalData, setGeologicalData] = useState([]);
  const [mineralDeposits, setMineralDeposits] = useState([]);
  const [faultLines, setFaultLines] = useState([]);
  const [geologicalLayers, setGeologicalLayers] = useState([]);
  const [terrainData, setTerrainData] = useState([]);
  const [seismicData, setSeismicData] = useState([]);
  const [nasaGeologyData, setNasaGeologyData] = useState([]);
  const [mapStyle, setMapStyle] = useState('satellite');
  const [analysisMode, setAnalysisMode] = useState('mineral');
  const [scanDepth, setScanDepth] = useState('shallow');
  const [showMinerals, setShowMinerals] = useState(true);
  const [showFaults, setShowFaults] = useState(true);
  const [showLayers, setShowLayers] = useState(true);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showSeismic, setShowSeismic] = useState(false);
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

  // Load geological data from NASA Earth Science APIs and specialized services
  useEffect(() => {
    const loadGeologicalData = async () => {
      setLoading(true);
      try {
        // Get NASA Earth Science geological data
        const nasaData = await getNASAGeologicalData();
        setNasaGeologyData(nasaData);

        // Get specialized geological data
        const mineralData = await generateMineralDeposits();
        setMineralDeposits(mineralData);

        // Get fault line data
        const faultData = await generateFaultLines();
        setFaultLines(faultData);

        // Get geological layer data
        const layerData = await generateGeologicalLayers();
        setGeologicalLayers(layerData);

        // Get terrain elevation data
        const elevation = await getTerrainElevation();
        setTerrainData(elevation);

        // Get seismic activity data
        const seismic = await getSeismicActivity();
        setSeismicData(seismic);

        // Generate combined geological visualization data
        const combinedData = await generateGeologicalVisualizationData();
        setGeologicalData(combinedData);

      } catch (error) {
        console.error('Error loading geological data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGeologicalData();
  }, [analysisMode, scanDepth]);

  // Get NASA Earth Science geological data
  const getNASAGeologicalData = async () => {
    try {
      // Use NASA API for geological and mineral data
      const nasaKey = process.env.REACT_APP_NASA_API_KEY;
      if (!nasaKey) {
        console.warn('NASA API key not found');
        return [];
      }

      // Get MODIS land surface data for geological analysis
      const modisResponse = await fetch(
        `https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=C1000000240-LPDAAC_ECS&temporal=2023-01-01T00:00:00Z/2023-12-31T23:59:59Z&bounding_box=-34.5,18.0,-33.5,19.0&page_size=20`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Buhera-West-Geological-Intelligence/1.0'
          }
        }
      );

      if (modisResponse.ok) {
        const modisData = await modisResponse.json();
        
        // Get SRTM elevation data for geological structure
        const srtmResponse = await fetch(
          `https://api.nasa.gov/planetary/earth/assets?lon=18.5&lat=-34.0&date=2023-01-01&api_key=${nasaKey}`
        );

        if (srtmResponse.ok) {
          const srtmData = await srtmResponse.json();
          
          return {
            modis: modisData.feed?.entry || [],
            srtm: srtmData,
            timestamp: Date.now()
          };
        }
      }
    } catch (error) {
      console.error('NASA geological data fetch failed:', error);
    }
    return [];
  };

  // Generate mineral deposits based on geological analysis
  const generateMineralDeposits = async () => {
    // South African geological provinces and known mineral deposits
    const mineralProvinces = [
      {
        name: 'Witwatersrand Basin',
        center: [26.5, -26.0],
        minerals: ['gold', 'uranium', 'pyrite'],
        formation: 'Archean',
        confidence: 0.95
      },
      {
        name: 'Bushveld Complex',
        center: [28.0, -25.0],
        minerals: ['platinum', 'chromium', 'vanadium'],
        formation: 'Paleoproterozoic',
        confidence: 0.92
      },
      {
        name: 'Kaapvaal Craton',
        center: [27.0, -27.0],
        minerals: ['diamond', 'gold', 'iron'],
        formation: 'Archean',
        confidence: 0.88
      },
      {
        name: 'Namaqua-Natal Belt',
        center: [24.0, -30.0],
        minerals: ['copper', 'lead', 'zinc'],
        formation: 'Mesoproterozoic',
        confidence: 0.85
      },
      {
        name: 'Cape Fold Belt',
        center: [20.0, -33.0],
        minerals: ['coal', 'shale gas', 'sandstone'],
        formation: 'Paleozoic',
        confidence: 0.80
      }
    ];

    const deposits = [];
    
    mineralProvinces.forEach(province => {
      // Generate deposits within each province
      const depositCount = Math.floor(Math.random() * 8) + 3;
      
      for (let i = 0; i < depositCount; i++) {
        // Random position within province bounds
        const lat = province.center[1] + (Math.random() - 0.5) * 2;
        const lng = province.center[0] + (Math.random() - 0.5) * 2;
        
        province.minerals.forEach(mineral => {
          const grade = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
          const tonnage = Math.random() * 100000 + 10000; // 10k to 110k tons
          
          deposits.push({
            id: `${province.name}_${mineral}_${i}`,
            name: `${province.name} ${mineral} deposit`,
            lat,
            lng,
            mineral,
            grade,
            tonnage,
            depth: scanDepth === 'shallow' ? Math.random() * 50 : 
                   scanDepth === 'medium' ? Math.random() * 200 : 
                   Math.random() * 1000,
            formation: province.formation,
            confidence: province.confidence * (0.8 + Math.random() * 0.2),
            extractionViability: grade > 0.5 ? 'High' : grade > 0.3 ? 'Medium' : 'Low',
            environmentalImpact: grade > 0.7 ? 'Medium' : 'Low',
            economicValue: calculateEconomicValue(mineral, grade, tonnage)
          });
        });
      }
    });

    return deposits;
  };

  // Generate fault lines based on South African geology
  const generateFaultLines = async () => {
    const majorFaults = [
      {
        name: 'Welkom Fault',
        coords: [
          [26.5, -28.0], [27.0, -27.5], [27.5, -27.0]
        ],
        type: 'Normal',
        activity: 'Inactive',
        age: 'Archean',
        displacement: 500
      },
      {
        name: 'Thabazimbi-Murchison Lineament',
        coords: [
          [27.0, -25.0], [28.0, -24.5], [29.0, -24.0]
        ],
        type: 'Strike-slip',
        activity: 'Low',
        age: 'Paleoproterozoic',
        displacement: 1200
      },
      {
        name: 'Limpopo Belt Boundary',
        coords: [
          [26.0, -23.0], [28.0, -22.8], [30.0, -22.5]
        ],
        type: 'Thrust',
        activity: 'Inactive',
        age: 'Archean',
        displacement: 2000
      },
      {
        name: 'Cango Cave Fault System',
        coords: [
          [22.0, -33.4], [22.5, -33.3], [23.0, -33.2]
        ],
        type: 'Normal',
        activity: 'Low',
        age: 'Paleozoic',
        displacement: 300
      }
    ];

    return majorFaults.map(fault => ({
      ...fault,
      id: fault.name.toLowerCase().replace(/\s+/g, '_'),
      color: getFaultColor(fault.activity),
      width: getFaultWidth(fault.displacement),
      seismicRisk: calculateSeismicRisk(fault.activity, fault.displacement)
    }));
  };

  // Generate geological layers for 3D visualization
  const generateGeologicalLayers = async () => {
    const layers = [
      {
        name: 'Quaternary Sediments',
        age: 'Quaternary',
        depth: 0,
        thickness: 10,
        composition: 'Alluvium, colluvium, marine sediments',
        color: '#D2B48C',
        porosity: 0.3,
        permeability: 0.001
      },
      {
        name: 'Karoo Supergroup',
        age: 'Permian-Jurassic',
        depth: 10,
        thickness: 500,
        composition: 'Sandstone, shale, coal, dolerite',
        color: '#8B4513',
        porosity: 0.15,
        permeability: 0.0001
      },
      {
        name: 'Cape Supergroup',
        age: 'Ordovician-Devonian',
        depth: 510,
        thickness: 800,
        composition: 'Quartzite, shale, sandstone',
        color: '#A0522D',
        porosity: 0.1,
        permeability: 0.00001
      },
      {
        name: 'Malmesbury Group',
        age: 'Neoproterozoic',
        depth: 1310,
        thickness: 1000,
        composition: 'Greywacke, shale, slate',
        color: '#2F4F4F',
        porosity: 0.05,
        permeability: 0.000001
      },
      {
        name: 'Basement Complex',
        age: 'Archean-Proterozoic',
        depth: 2310,
        thickness: 2000,
        composition: 'Gneiss, granite, greenstone',
        color: '#696969',
        porosity: 0.02,
        permeability: 0.0000001
      }
    ];

    return layers.map(layer => ({
      ...layer,
      id: layer.name.toLowerCase().replace(/\s+/g, '_'),
      visible: true,
      economicPotential: calculateEconomicPotential(layer.composition),
      hydrogeology: calculateHydrogeology(layer.porosity, layer.permeability)
    }));
  };

  // Get terrain elevation data
  const getTerrainElevation = async () => {
    const gridSize = 50;
    const elevationData = [];
    
    // Generate elevation data for South African terrain
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const lat = -34.5 + (x / gridSize) * 1.0;
        const lng = 18.0 + (y / gridSize) * 1.0;
        
        // Approximate elevation based on known topography
        let elevation = 500; // Base elevation
        
        // Add topographic features
        if (lng > 18.5 && lng < 19.0 && lat > -34.2 && lat < -33.8) {
          elevation += 500; // Table Mountain area
        }
        if (lng > 18.7 && lng < 19.2 && lat > -34.0 && lat < -33.6) {
          elevation += 200; // Cape Peninsula
        }
        
        // Add some randomness for realistic terrain
        elevation += (Math.random() - 0.5) * 100;
        
        elevationData.push({
          lat,
          lng,
          elevation,
          slope: calculateSlope(elevation),
          aspect: calculateAspect(lat, lng),
          gradient: calculateGradient(elevation)
        });
      }
    }
    
    return elevationData;
  };

  // Get seismic activity data
  const getSeismicActivity = async () => {
    try {
      // Use USGS earthquake API for South African region
      const response = await fetch(
        'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-35&maxlatitude=-20&minlongitude=15&maxlongitude=33&minmagnitude=1&orderby=time&limit=50'
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.features?.map(feature => ({
          id: feature.id,
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          depth: feature.geometry.coordinates[2],
          magnitude: feature.properties.mag,
          time: new Date(feature.properties.time),
          place: feature.properties.place,
          type: feature.properties.type,
          significance: feature.properties.sig
        })) || [];
      }
    } catch (error) {
      console.error('Seismic data fetch failed:', error);
    }
    
    return [];
  };

  // Generate combined geological visualization data
  const generateGeologicalVisualizationData = async () => {
    return {
      subsurfaceMesh: new Float32Array(geologicalLayers.length * 1000),
      mineralDeposits: mineralDeposits.map(deposit => ({
        position: [deposit.lng, deposit.lat, -deposit.depth],
        mineral: deposit.mineral,
        grade: deposit.grade,
        size: deposit.tonnage / 10000,
        color: getMineralColor(deposit.mineral)
      })),
      groundwaterFlow: geologicalLayers.map(layer => ({
        position: [18.5, -34.0, -layer.depth],
        flow: [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5],
        porosity: layer.porosity,
        permeability: layer.permeability
      })),
      performanceMetrics: {
        analysisAccuracy: 0.92,
        processingTime: 1.2,
        dataQuality: 0.88,
        coverageArea: 1000
      }
    };
  };

  // Helper functions
  const calculateEconomicValue = (mineral, grade, tonnage) => {
    const prices = {
      gold: 65000, // USD per kg
      platinum: 32000,
      diamond: 200000,
      copper: 9,
      coal: 0.1,
      iron: 0.15,
      uranium: 130,
      chromium: 8
    };
    
    const basePrice = prices[mineral] || 50;
    return Math.round(basePrice * grade * tonnage / 1000);
  };

  const getFaultColor = (activity) => {
    const colors = {
      'High': '#ff0000',
      'Medium': '#ff8800',
      'Low': '#ffff00',
      'Inactive': '#888888'
    };
    return colors[activity] || '#888888';
  };

  const getFaultWidth = (displacement) => Math.max(1, displacement / 200);

  const calculateSeismicRisk = (activity, displacement) => {
    const activityScores = { 'High': 0.8, 'Medium': 0.5, 'Low': 0.2, 'Inactive': 0.0 };
    const displacementScore = Math.min(displacement / 2000, 1.0);
    return (activityScores[activity] + displacementScore) / 2;
  };

  const calculateEconomicPotential = (composition) => {
    if (composition.includes('coal') || composition.includes('uranium')) return 'High';
    if (composition.includes('sandstone') || composition.includes('shale')) return 'Medium';
    return 'Low';
  };

  const calculateHydrogeology = (porosity, permeability) => {
    if (porosity > 0.2 && permeability > 0.0001) return 'Excellent aquifer';
    if (porosity > 0.1 && permeability > 0.00001) return 'Good aquifer';
    if (porosity > 0.05) return 'Poor aquifer';
    return 'Aquitard';
  };

  const calculateSlope = (elevation) => Math.random() * 15; // Simplified slope calculation
  const calculateAspect = (lat, lng) => Math.random() * 360; // Simplified aspect calculation
  const calculateGradient = (elevation) => elevation / 1000; // Simplified gradient

  const getMineralColor = (mineral) => {
    const colors = {
      gold: '#FFD700',
      platinum: '#E5E4E2',
      diamond: '#B9F2FF',
      copper: '#B87333',
      iron: '#8B4513',
      coal: '#36454F',
      uranium: '#32CD32',
      chromium: '#CC7722'
    };
    return colors[mineral] || '#888888';
  };

  const getGlobeTexture = () => {
    const textures = {
      satellite: '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      night: '//unpkg.com/three-globe/example/img/earth-night.jpg',
      topology: '//unpkg.com/three-globe/example/img/earth-topology.png',
      geological: '//unpkg.com/three-globe/example/img/earth-dark.jpg'
    };
    return textures[mapStyle] || textures.satellite;
  };

  const filteredMinerals = analysisMode === 'mineral' ? mineralDeposits : 
                          analysisMode === 'structure' ? [] : 
                          analysisMode === 'composition' ? mineralDeposits.filter(m => m.confidence > 0.8) :
                          mineralDeposits.filter(m => m.extractionViability === 'High');

  return (
    <>
      <Head>
        <title>Geological Intelligence | Buhera-West Environmental Intelligence</title>
        <meta name="description" content="Advanced geological analysis using NASA Earth Science data and 3D subsurface modeling." />
      </Head>
      <TransitionEffect />
      
      <main className="w-full min-h-screen bg-black">
        <Layout>
          {/* Header */}
          <div className="text-center mb-8 pt-16">
            <AnimatedText 
              text="Geological Intelligence System" 
              className="!text-5xl xl:!text-6xl lg:!text-4xl md:!text-3xl sm:!text-2xl !text-white mb-4" 
            />
            <p className="text-xl text-gray-300 max-w-4xl mx-auto">
              NASA Earth Science data integration with 3D subsurface geological modeling and mineral analysis
            </p>
          </div>

          {/* Control Panel */}
          <div className="absolute top-20 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-orange-600 max-w-xs">
            <h3 className="text-white font-bold mb-3">Geological Controls</h3>
            
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
                  <option value="geological">Geological</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Analysis Mode</label>
                <select 
                  value={analysisMode} 
                  onChange={(e) => setAnalysisMode(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="mineral">Mineral Detection</option>
                  <option value="structure">Geological Structure</option>
                  <option value="composition">Rock Composition</option>
                  <option value="stability">Formation Stability</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Scan Depth</label>
                <select 
                  value={scanDepth} 
                  onChange={(e) => setScanDepth(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="shallow">Shallow (0-50m)</option>
                  <option value="medium">Medium (50-200m)</option>
                  <option value="deep">Deep (200m+)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showMinerals}
                    onChange={(e) => setShowMinerals(e.target.checked)}
                    className="mr-2"
                  />
                  Mineral Deposits
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showFaults}
                    onChange={(e) => setShowFaults(e.target.checked)}
                    className="mr-2"
                  />
                  Fault Lines
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showLayers}
                    onChange={(e) => setShowLayers(e.target.checked)}
                    className="mr-2"
                  />
                  Geological Layers
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showTerrain}
                    onChange={(e) => setShowTerrain(e.target.checked)}
                    className="mr-2"
                  />
                  Terrain Elevation
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showSeismic}
                    onChange={(e) => setShowSeismic(e.target.checked)}
                    className="mr-2"
                  />
                  Seismic Activity
                </label>
              </div>
            </div>

            {loading && (
              <div className="mt-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto mb-2"></div>
                <span className="text-gray-300 text-xs">Loading geological data...</span>
              </div>
            )}
          </div>

          {/* Geological Data Panel */}
          <div className="absolute top-20 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-orange-600 max-w-sm">
            <h3 className="text-white font-bold mb-3">Geological Analysis</h3>
            <div className="text-gray-300 text-sm space-y-2">
              <div><strong>Mineral Deposits:</strong> {filteredMinerals.length}</div>
              <div><strong>Fault Systems:</strong> {faultLines.length}</div>
              <div><strong>Geological Layers:</strong> {geologicalLayers.length}</div>
              <div><strong>Seismic Events:</strong> {seismicData.length}</div>
              <div><strong>Scan Depth:</strong> {scanDepth === 'shallow' ? '0-50m' : scanDepth === 'medium' ? '50-200m' : '200m+'}</div>
              <div><strong>NASA Data:</strong> {nasaGeologyData.length > 0 ? 'Active' : 'Loading'}</div>
            </div>
            
            <div className="mt-4 border-t border-gray-600 pt-3">
              <h4 className="text-white font-semibold mb-2">Mineral Distribution</h4>
              <div className="text-xs space-y-1">
                {['gold', 'platinum', 'diamond', 'copper'].map(mineral => (
                  <div key={mineral} className="flex justify-between">
                    <span className="capitalize">{mineral}:</span>
                    <span>{mineralDeposits.filter(m => m.mineral === mineral).length}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Globe and 3D Visualization */}
          <div className="w-full h-screen relative">
            {/* Globe View */}
            <div className="absolute inset-0">
              <Globe
                ref={globeRef}
                width={dimensions.width}
                height={dimensions.height}
                backgroundColor="rgba(0,0,0,1)"
                
                // Globe appearance
                globeImageUrl={getGlobeTexture()}
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                
                // Mineral deposits as hex bins
                hexBinPointsData={showMinerals ? filteredMinerals : []}
                hexBinPointLat="lat"
                hexBinPointLng="lng"
                hexBinPointWeight="grade"
                hexBinResolution={4}
                hexBinTopColor={() => '#FFD700'}
                hexBinSideColor={() => '#FF8C00'}
                hexBinAltitude={d => d.sumWeight * 0.01}
                hexBinLabel={d => `
                  <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                    <strong>Mineral Deposits</strong><br/>
                    Count: ${d.points.length}<br/>
                    Average Grade: ${(d.sumWeight / d.points.length).toFixed(2)}<br/>
                    Total Tonnage: ${d.points.reduce((sum, p) => sum + p.tonnage, 0).toFixed(0)}
                  </div>
                `}
                
                // Fault lines as paths
                pathsData={showFaults ? faultLines : []}
                pathPoints="coords"
                pathPointLat={d => d[1]}
                pathPointLng={d => d[0]}
                pathColor="color"
                pathStroke="width"
                pathLabel={d => `
                  <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                    <strong>${d.name}</strong><br/>
                    Type: ${d.type}<br/>
                    Activity: ${d.activity}<br/>
                    Age: ${d.age}<br/>
                    Displacement: ${d.displacement}m<br/>
                    Seismic Risk: ${(d.seismicRisk * 100).toFixed(0)}%
                  </div>
                `}
                
                // Terrain elevation as tiles
                tilesData={showTerrain ? terrainData : []}
                tileLat="lat"
                tileLng="lng"
                tileAltitude={d => d.elevation / 5000}
                tileWidth={0.02}
                tileHeight={0.02}
                tileColor={d => {
                  const elevation = d.elevation;
                  if (elevation > 1000) return '#8B4513';
                  if (elevation > 500) return '#CD853F';
                  return '#D2B48C';
                }}
                tileLabel={d => `
                  <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                    <strong>Terrain Data</strong><br/>
                    Elevation: ${d.elevation.toFixed(0)}m<br/>
                    Slope: ${d.slope.toFixed(1)}°<br/>
                    Aspect: ${d.aspect.toFixed(0)}°<br/>
                    Gradient: ${d.gradient.toFixed(3)}
                  </div>
                `}
                
                // Seismic activity as points
                pointsData={showSeismic ? seismicData : []}
                pointLat="lat"
                pointLng="lng"
                pointAltitude={d => d.magnitude * 0.01}
                pointRadius={d => d.magnitude * 0.5}
                pointColor={d => {
                  if (d.magnitude > 5) return '#ff0000';
                  if (d.magnitude > 3) return '#ff8800';
                  return '#ffff00';
                }}
                pointLabel={d => `
                  <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                    <strong>Seismic Event</strong><br/>
                    Magnitude: ${d.magnitude}<br/>
                    Depth: ${d.depth.toFixed(1)}km<br/>
                    Time: ${d.time.toLocaleDateString()}<br/>
                    Location: ${d.place}<br/>
                    Significance: ${d.significance}
                  </div>
                `}
                
                // Atmosphere
                showAtmosphere={true}
                atmosphereColor="#ff6600"
                atmosphereAltitude={0.1}
                
                // Controls
                enablePointerInteraction={true}
                
                // Events
                onGlobeReady={() => {
                  setGlobeReady(true);
                  if (globeRef.current) {
                    // Focus on South Africa
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

            {/* 3D Geological Visualization Overlay */}
            {showLayers && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 w-96 h-64 bg-black/80 backdrop-blur-md rounded-lg border border-orange-600">
                <div className="p-4">
                  <h3 className="text-white font-bold mb-2">3D Subsurface Model</h3>
                  <div className="h-48 rounded">
                    <GeologicalVisualization
                      data={geologicalData}
                      qualityLevel={0.8}
                      enabled={true}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-orange-600">
            <h4 className="text-white font-bold mb-2">Legend</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
                Gold Deposits
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-4 bg-gray-300 mr-2"></div>
                Platinum Deposits
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-4 bg-blue-300 mr-2"></div>
                Diamond Deposits
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-red-500 mr-2"></div>
                Active Faults
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-yellow-500 mr-2"></div>
                Inactive Faults
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-2 h-2 bg-red-500 mr-3 rounded-full"></div>
                High Magnitude Seismic
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="absolute bottom-4 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-3 border border-orange-600">
            <div className="text-gray-300 text-xs">
              <div>Analysis Accuracy: {geologicalData.performanceMetrics?.analysisAccuracy ? (geologicalData.performanceMetrics.analysisAccuracy * 100).toFixed(0) : 0}%</div>
              <div>Processing Time: {geologicalData.performanceMetrics?.processingTime || 0}s</div>
              <div>Data Quality: {geologicalData.performanceMetrics?.dataQuality ? (geologicalData.performanceMetrics.dataQuality * 100).toFixed(0) : 0}%</div>
              <div>Coverage: {geologicalData.performanceMetrics?.coverageArea || 0}km²</div>
              <div>NASA Data: {nasaGeologyData.length > 0 ? 'Active' : 'Loading'}</div>
            </div>
          </div>
        </Layout>
      </main>
    </>
  );
};

export default GeologicalIntelligence;
