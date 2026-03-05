// in the public/folder, there is @globes.md, it has an implementation of 3d globe in multiple environments 
// I want you to use any example from the file to create a page that has a 3d globe of the earth, and components (lines etc) to depict space weather using real data from the apis. 

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import AnimatedText from "@/components/AnimatedText";
import Layout from "@/components/Layout";
import TransitionEffect from "@/components/TransitionEffect";
import { TextureLoader, ShaderMaterial, Vector2 } from 'three';
import * as solar from 'solar-calculator';

// Dynamic import for react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import('react-globe.gl').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
    </div>
  )
});

const SpaceWeatherVisualization = () => {
  const globeRef = useRef();
  const [globeReady, setGlobeReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [globeMaterial, setGlobeMaterial] = useState(null);
  const [spaceWeatherData, setSpaceWeatherData] = useState(null);
  const [solarWindPaths, setSolarWindPaths] = useState([]);
  const [magneticFieldLines, setMagneticFieldLines] = useState([]);
  const [auroraPaths, setAuroraPaths] = useState([]);
  const [solarFlareArcs, setSolarFlareArcs] = useState([]);
  const [mapStyle, setMapStyle] = useState('night');
  const [showSolarWind, setShowSolarWind] = useState(true);
  const [showMagneticField, setShowMagneticField] = useState(true);
  const [showAurora, setShowAurora] = useState(true);
  const [showSolarFlares, setShowSolarFlares] = useState(true);
  const [weatherMode, setWeatherMode] = useState('realtime');
  const [loading, setLoading] = useState(true);
  const [alertLevel, setAlertLevel] = useState('green');
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

  // Custom shader for day/night cycle with aurora effects
  const spaceWeatherShader = {
    vertexShader: `
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #define PI 3.141592653589793
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      uniform vec2 sunPosition;
      uniform vec2 globeRotation;
      uniform float auroraIntensity;
      uniform float solarActivity;
      uniform float magneticFieldStrength;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying vec3 vPosition;

      float toRad(in float a) {
        return a * PI / 180.0;
      }

      vec3 Polar2Cartesian(in vec2 c) {
        float theta = toRad(90.0 - c.x);
        float phi = toRad(90.0 - c.y);
        return vec3(
          sin(phi) * cos(theta),
          cos(phi),
          sin(phi) * sin(theta)
        );
      }

      void main() {
        float invLon = toRad(globeRotation.x);
        float invLat = -toRad(globeRotation.y);
        mat3 rotX = mat3(
          1, 0, 0,
          0, cos(invLat), -sin(invLat),
          0, sin(invLat), cos(invLat)
        );
        mat3 rotY = mat3(
          cos(invLon), 0, sin(invLon),
          0, 1, 0,
          -sin(invLon), 0, cos(invLon)
        );
        vec3 rotatedSunDirection = rotX * rotY * Polar2Cartesian(sunPosition);
        float sunIntensity = dot(normalize(vNormal), normalize(rotatedSunDirection));
        
        vec4 dayColor = texture2D(dayTexture, vUv);
        vec4 nightColor = texture2D(nightTexture, vUv);
        
        // Aurora effect at high latitudes
        float lat = asin(vPosition.y / length(vPosition)) * 180.0 / PI;
        float auroraZone = smoothstep(60.0, 70.0, abs(lat)) * smoothstep(85.0, 75.0, abs(lat));
        vec3 auroraColor = mix(vec3(0.0, 1.0, 0.5), vec3(1.0, 0.2, 0.8), sin(vUv.x * 20.0) * 0.5 + 0.5);
        
        // Solar activity effects
        float solarGlow = solarActivity * 0.3 * (1.0 + sin(vUv.x * 10.0 + vUv.y * 8.0));
        
        // Magnetic field visualization
        float magneticGlow = magneticFieldStrength * 0.2 * smoothstep(0.3, 0.7, abs(cos(vUv.x * PI * 8.0)));
        
        float blendFactor = smoothstep(-0.1, 0.1, sunIntensity);
        vec4 baseColor = mix(nightColor, dayColor, blendFactor);
        
        // Apply space weather effects
        vec3 finalColor = baseColor.rgb;
        finalColor += auroraColor * auroraZone * auroraIntensity;
        finalColor += vec3(1.0, 0.8, 0.0) * solarGlow;
        finalColor += vec3(0.0, 0.5, 1.0) * magneticGlow;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `
  };

  // Time progression
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(prev => new Date(prev.getTime() + timeSpeed * 60000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeSpeed]);

  // Initialize globe material
  useEffect(() => {
    Promise.all([
      new TextureLoader().loadAsync('//unpkg.com/three-globe/example/img/earth-day.jpg'),
      new TextureLoader().loadAsync('//unpkg.com/three-globe/example/img/earth-night.jpg')
    ]).then(([dayTexture, nightTexture]) => {
      setGlobeMaterial(new ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayTexture },
          nightTexture: { value: nightTexture },
          sunPosition: { value: new Vector2() },
          globeRotation: { value: new Vector2() },
          auroraIntensity: { value: 0.5 },
          solarActivity: { value: 0.3 },
          magneticFieldStrength: { value: 0.4 }
        },
        vertexShader: spaceWeatherShader.vertexShader,
        fragmentShader: spaceWeatherShader.fragmentShader
      }));
    });
  }, []);

  // Load space weather data
  useEffect(() => {
    const loadSpaceWeatherData = async () => {
      setLoading(true);
      try {
        const weatherData = await getSpaceWeatherData();
        setSpaceWeatherData(weatherData);

        // Generate solar wind paths
        const windPaths = generateSolarWindPaths(weatherData);
        setSolarWindPaths(windPaths);

        // Generate magnetic field lines
        const fieldLines = generateMagneticFieldLines(weatherData);
        setMagneticFieldLines(fieldLines);

        // Generate aurora paths
        const aurora = generateAuroraPaths(weatherData);
        setAuroraPaths(aurora);

        // Generate solar flare arcs
        const flares = generateSolarFlareArcs(weatherData);
        setSolarFlareArcs(flares);

        // Update shader uniforms
        if (globeMaterial) {
          globeMaterial.uniforms.auroraIntensity.value = weatherData.auroraIntensity;
          globeMaterial.uniforms.solarActivity.value = weatherData.solarActivity;
          globeMaterial.uniforms.magneticFieldStrength.value = weatherData.magneticFieldStrength;
        }

        // Set alert level
        setAlertLevel(determineAlertLevel(weatherData));

      } catch (error) {
        console.error('Error loading space weather data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSpaceWeatherData();
  }, [weatherMode, globeMaterial]);

  // Update sun position
  useEffect(() => {
    if (globeMaterial) {
      const sunPos = getSunPosition(currentTime);
      globeMaterial.uniforms.sunPosition.value.set(sunPos[0], sunPos[1]);
    }
  }, [currentTime, globeMaterial]);

  // Get space weather data from NOAA Space Weather API
  const getSpaceWeatherData = async () => {
    try {
      const response = await fetch('/api/space-weather');
      if (!response.ok) throw new Error('Failed to fetch space weather data');
      
      const apiData = await response.json();
      if (!apiData.success) throw new Error(apiData.error);
      
      return {
        timestamp: apiData.timestamp,
        solarWindSpeed: apiData.solarWindSpeed || 400, // km/s
        solarWindDensity: apiData.solarWindDensity || 5, // protons/cm³
        magneticFieldStrength: apiData.magneticFieldStrength || 5, // nT
        magneticFieldDirection: apiData.magneticFieldDirection || { x: 0, y: 0, z: -5 },
        kpIndex: apiData.kpIndex || 2, // 0-9 scale
        dstIndex: apiData.dstIndex || -20, // nT
        solarFluxIndex: apiData.solarFluxIndex || 120, // SFU
        xrayFluxLevel: apiData.xrayFluxLevel || 'A1',
        protonFluxLevel: apiData.protonFluxLevel || 1,
        electronFluxLevel: apiData.electronFluxLevel || 1000,
        auroraIntensity: calculateAuroraIntensity(apiData.kpIndex || 2),
        solarActivity: calculateSolarActivity(apiData.solarFluxIndex || 120),
        geomagneticActivity: apiData.kpIndex || 2,
        alerts: apiData.alerts || [],
        forecast: apiData.forecast || {}
      };
    } catch (error) {
      console.error('Space weather data fetch failed:', error);
      return getFallbackSpaceWeatherData();
    }
  };

  // Generate solar wind paths
  const generateSolarWindPaths = (weatherData) => {
    const paths = [];
    const windSpeed = weatherData.solarWindSpeed;
    const density = weatherData.solarWindDensity;
    
    // Create solar wind flow lines from sun direction
    for (let i = 0; i < 20; i++) {
      const pathPoints = [];
      const startLat = (Math.random() - 0.5) * 180;
      const startLng = (Math.random() - 0.5) * 360;
      
      // Solar wind flows from day side to night side
      const sunPos = getSunPosition(currentTime);
      const flowDirection = calculateFlowDirection(startLat, startLng, sunPos);
      
      let lat = startLat;
      let lng = startLng;
      let alt = 0.5; // Start at magnetosphere
      
      for (let j = 0; j < 50; j++) {
        pathPoints.push([lat, lng, alt]);
        
        // Follow solar wind flow
        lat += flowDirection.lat * 0.5;
        lng += flowDirection.lng * 0.5;
        alt = Math.max(0.1, alt - 0.01); // Descend toward atmosphere
        
        // Wrap longitude
        if (lng > 180) lng -= 360;
        if (lng < -180) lng += 360;
      }
      
      paths.push({
        id: `solar_wind_${i}`,
        points: pathPoints,
        speed: windSpeed,
        density: density,
        color: getSolarWindColor(windSpeed),
        intensity: Math.min(1, windSpeed / 800)
      });
    }
    
    return paths;
  };

  // Generate magnetic field lines
  const generateMagneticFieldLines = (weatherData) => {
    const fieldLines = [];
    const fieldStrength = weatherData.magneticFieldStrength;
    
    // Earth's magnetic field lines (dipole approximation)
    for (let i = 0; i < 15; i++) {
      const fieldPoints = [];
      const magneticLat = (i - 7.5) * 20; // -150 to 150 degrees
      
      // Generate field line from north to south magnetic pole
      for (let j = 0; j < 100; j++) {
        const t = j / 99;
        const lat = magneticLat * Math.cos(t * Math.PI);
        const lng = 0; // Simplified to meridional field lines
        const alt = 0.1 + Math.sin(t * Math.PI) * 0.8; // Altitude varies
        
        fieldPoints.push([lat, lng, alt]);
      }
      
      fieldLines.push({
        id: `magnetic_field_${i}`,
        points: fieldPoints,
        strength: fieldStrength,
        color: getMagneticFieldColor(fieldStrength),
        distortion: weatherData.dstIndex / 100 // Dst index affects field shape
      });
    }
    
    return fieldLines;
  };

  // Generate aurora paths
  const generateAuroraPaths = (weatherData) => {
    const auroraPaths = [];
    const kpIndex = weatherData.kpIndex;
    const auroraIntensity = weatherData.auroraIntensity;
    
    // Aurora ovals around magnetic poles
    const auroraLatitudes = [67 - kpIndex * 2, -(67 - kpIndex * 2)]; // Expands with Kp
    
    auroraLatitudes.forEach((lat, poleIndex) => {
      const auroraPoints = [];
      
      // Create aurora oval
      for (let lng = -180; lng <= 180; lng += 5) {
        const latVariation = Math.sin(lng * Math.PI / 180) * 3; // Oval shape
        const auroraLat = lat + latVariation;
        const alt = 0.02 + Math.random() * 0.01; // 100-110 km altitude
        
        auroraPoints.push([auroraLat, lng, alt]);
      }
      
      auroraPaths.push({
        id: `aurora_${poleIndex}`,
        points: auroraPoints,
        intensity: auroraIntensity,
        kpIndex: kpIndex,
        color: getAuroraColor(auroraIntensity),
        type: poleIndex === 0 ? 'northern' : 'southern'
      });
    });
    
    return auroraPaths;
  };

  // Generate solar flare arcs
  const generateSolarFlareArcs = (weatherData) => {
    const flareArcs = [];
    const xrayLevel = weatherData.xrayFluxLevel;
    const protonLevel = weatherData.protonFluxLevel;
    
    // Create arcs representing solar particle events
    if (xrayLevel !== 'A1' || protonLevel > 1) {
      const sunPos = getSunPosition(currentTime);
      
      // Flare particles follow interplanetary magnetic field
      for (let i = 0; i < 10; i++) {
        const startLat = sunPos[1] + (Math.random() - 0.5) * 30;
        const startLng = sunPos[0] + (Math.random() - 0.5) * 30;
        const endLat = (Math.random() - 0.5) * 180;
        const endLng = (Math.random() - 0.5) * 360;
        
        flareArcs.push({
          id: `solar_flare_${i}`,
          startLat,
          startLng,
          endLat,
          endLng,
          xrayLevel,
          protonLevel,
          color: getSolarFlareColor(xrayLevel),
          intensity: getSolarFlareIntensity(xrayLevel),
          speed: 1000 + Math.random() * 2000 // km/s
        });
      }
    }
    
    return flareArcs;
  };

  // Helper functions
  const getSunPosition = (date) => {
    const day = new Date(+date).setUTCHours(0, 0, 0, 0);
    const t = solar.century(date);
    const longitude = (day - date) / 864e5 * 360 - 180;
    return [longitude - solar.equationOfTime(t) / 4, solar.declination(t)];
  };

  const calculateFlowDirection = (lat, lng, sunPos) => {
    // Simplified solar wind flow from sun-facing side
    const sunLat = sunPos[1];
    const sunLng = sunPos[0];
    
    return {
      lat: (lat - sunLat) * 0.01,
      lng: (lng - sunLng) * 0.01
    };
  };

  const calculateAuroraIntensity = (kpIndex) => {
    return Math.min(1, kpIndex / 9);
  };

  const calculateSolarActivity = (solarFlux) => {
    return Math.min(1, (solarFlux - 70) / 300);
  };

  const determineAlertLevel = (weatherData) => {
    const kp = weatherData.kpIndex;
    const xray = weatherData.xrayFluxLevel;
    const proton = weatherData.protonFluxLevel;
    
    if (kp >= 7 || xray.startsWith('X') || proton >= 100) return 'red';
    if (kp >= 5 || xray.startsWith('M') || proton >= 10) return 'orange';
    if (kp >= 3 || xray.startsWith('C') || proton >= 1) return 'yellow';
    return 'green';
  };

  const getSolarWindColor = (speed) => {
    if (speed > 600) return 'rgba(255, 0, 0, 0.8)'; // Fast wind - red
    if (speed > 500) return 'rgba(255, 165, 0, 0.8)'; // Medium wind - orange
    return 'rgba(255, 255, 0, 0.8)'; // Slow wind - yellow
  };

  const getMagneticFieldColor = (strength) => {
    return `rgba(0, 150, 255, ${Math.min(1, strength / 20)})`;
  };

  const getAuroraColor = (intensity) => {
    return `rgba(0, 255, 150, ${intensity})`;
  };

  const getSolarFlareColor = (xrayLevel) => {
    if (xrayLevel.startsWith('X')) return 'rgba(255, 0, 255, 0.9)'; // X-class - magenta
    if (xrayLevel.startsWith('M')) return 'rgba(255, 100, 0, 0.8)'; // M-class - orange
    if (xrayLevel.startsWith('C')) return 'rgba(255, 255, 0, 0.7)'; // C-class - yellow
    return 'rgba(255, 255, 255, 0.5)'; // A/B-class - white
  };

  const getSolarFlareIntensity = (xrayLevel) => {
    if (xrayLevel.startsWith('X')) return 1.0;
    if (xrayLevel.startsWith('M')) return 0.8;
    if (xrayLevel.startsWith('C')) return 0.6;
    return 0.3;
  };

  const getFallbackSpaceWeatherData = () => ({
    timestamp: Date.now(),
    solarWindSpeed: 400,
    solarWindDensity: 5,
    magneticFieldStrength: 5,
    magneticFieldDirection: { x: 0, y: 0, z: -5 },
    kpIndex: 2,
    dstIndex: -20,
    solarFluxIndex: 120,
    xrayFluxLevel: 'A1',
    protonFluxLevel: 1,
    electronFluxLevel: 1000,
    auroraIntensity: 0.3,
    solarActivity: 0.2,
    geomagneticActivity: 2,
    alerts: [],
    forecast: {}
  });

  const getAlertColor = (level) => {
    const colors = {
      green: '#00ff00',
      yellow: '#ffff00',
      orange: '#ff8000',
      red: '#ff0000'
    };
    return colors[level] || '#ffffff';
  };

  return (
    <>
      <Head>
        <title>Space Weather Dynamics | Buhera-West Environmental Intelligence</title>
        <meta name="description" content="Real-time space weather monitoring with solar wind, magnetic field, and aurora visualization." />
      </Head>
      <TransitionEffect />
      
      <main className="w-full min-h-screen bg-black">
        <Layout>
          {/* Header */}
          <div className="text-center mb-8 pt-16">
            <AnimatedText 
              text="Space Weather Dynamics" 
              className="!text-5xl xl:!text-6xl lg:!text-4xl md:!text-3xl sm:!text-2xl !text-white mb-4" 
            />
            <p className="text-xl text-gray-300 max-w-4xl mx-auto">
              Real-time space weather monitoring and Earth's magnetosphere visualization
            </p>
          </div>

          {/* Control Panel */}
          <div className="absolute top-20 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600 max-w-xs">
            <h3 className="text-white font-bold mb-3">Space Weather Controls</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Weather Mode</label>
                <select 
                  value={weatherMode} 
                  onChange={(e) => setWeatherMode(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
                >
                  <option value="realtime">Real-time</option>
                  <option value="forecast">27-day Forecast</option>
                  <option value="historical">Historical</option>
                  <option value="simulation">Simulation</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Time Speed: {timeSpeed}x</label>
                <input
                  type="range"
                  min="0.1"
                  max="100"
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
                    checked={showSolarWind}
                    onChange={(e) => setShowSolarWind(e.target.checked)}
                    className="mr-2"
                  />
                  Solar Wind
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showMagneticField}
                    onChange={(e) => setShowMagneticField(e.target.checked)}
                    className="mr-2"
                  />
                  Magnetic Field
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showAurora}
                    onChange={(e) => setShowAurora(e.target.checked)}
                    className="mr-2"
                  />
                  Aurora
                </label>
                
                <label className="flex items-center text-gray-300 text-sm">
                  <input
                    type="checkbox"
                    checked={showSolarFlares}
                    onChange={(e) => setShowSolarFlares(e.target.checked)}
                    className="mr-2"
                  />
                  Solar Flares
                </label>
              </div>
            </div>

            {loading && (
              <div className="mt-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mx-auto mb-2"></div>
                <span className="text-gray-300 text-xs">Loading space weather data...</span>
              </div>
            )}
          </div>

          {/* Space Weather Data Panel */}
          <div className="absolute top-20 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600 max-w-sm">
            <h3 className="text-white font-bold mb-3">Current Conditions</h3>
            {spaceWeatherData && (
              <div className="text-gray-300 text-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span>Alert Level:</span>
                  <span 
                    className="px-2 py-1 rounded text-xs font-bold"
                    style={{ backgroundColor: getAlertColor(alertLevel), color: 'black' }}
                  >
                    {alertLevel.toUpperCase()}
                  </span>
                </div>
                <div><strong>Solar Wind Speed:</strong> {spaceWeatherData.solarWindSpeed} km/s</div>
                <div><strong>Solar Wind Density:</strong> {spaceWeatherData.solarWindDensity} protons/cm³</div>
                <div><strong>Magnetic Field:</strong> {spaceWeatherData.magneticFieldStrength} nT</div>
                <div><strong>Kp Index:</strong> {spaceWeatherData.kpIndex}/9</div>
                <div><strong>Dst Index:</strong> {spaceWeatherData.dstIndex} nT</div>
                <div><strong>Solar Flux:</strong> {spaceWeatherData.solarFluxIndex} SFU</div>
                <div><strong>X-ray Level:</strong> {spaceWeatherData.xrayFluxLevel}</div>
                <div><strong>Proton Flux:</strong> {spaceWeatherData.protonFluxLevel} pfu</div>
                <div><strong>Time:</strong> {currentTime.toLocaleTimeString()}</div>
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
              
              // Globe appearance with custom material
              globeMaterial={globeMaterial}
              backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
              
              // Solar wind paths and magnetic field lines
              pathsData={[
                ...(showSolarWind ? solarWindPaths : []),
                ...(showMagneticField ? magneticFieldLines : [])
              ]}
              pathPoints="points"
              pathPointLat={p => p[0]}
              pathPointLng={p => p[1]}
              pathPointAlt={p => p[2]}
              pathColor="color"
              pathStroke={d => d.intensity ? d.intensity * 2 : d.strength / 10}
              pathDashLength={d => d.speed ? 0.05 : 0.1}
              pathDashGap={d => d.speed ? 0.02 : 0.05}
              pathDashAnimateTime={d => d.speed ? 10000 / d.speed * 1000 : 5000}
              pathLabel={d => d.speed ? `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Solar Wind</strong><br/>
                  Speed: ${d.speed} km/s<br/>
                  Density: ${d.density} protons/cm³<br/>
                  Intensity: ${(d.intensity * 100).toFixed(0)}%
                </div>
              ` : `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Magnetic Field Line</strong><br/>
                  Strength: ${d.strength} nT<br/>
                  Distortion: ${(d.distortion * 100).toFixed(0)}%
                </div>
              `}
              
              // Aurora arcs and solar flare arcs
              arcsData={[
                ...(showAurora ? auroraPaths.map(aurora => ({
                  id: aurora.id,
                  startLat: aurora.points[0][0],
                  startLng: aurora.points[0][1],
                  endLat: aurora.points[aurora.points.length - 1][0],
                  endLng: aurora.points[aurora.points.length - 1][1],
                  type: 'aurora',
                  ...aurora
                })) : []),
                ...(showSolarFlares ? solarFlareArcs.map(flare => ({
                  ...flare,
                  type: 'solar_flare'
                })) : [])
              ]}
              arcStartLat={d => d.type === 'aurora' ? d.startLat : d.startLat}
              arcStartLng={d => d.type === 'aurora' ? d.startLng : d.startLng}
              arcEndLat={d => d.type === 'aurora' ? d.endLat : d.endLat}
              arcEndLng={d => d.type === 'aurora' ? d.endLng : d.endLng}
              arcColor="color"
              arcStroke={d => d.type === 'aurora' ? d.intensity * 3 : d.intensity * 4}
              arcDashLength={d => d.type === 'aurora' ? 0.2 : 0.3}
              arcDashGap={0.1}
              arcDashAnimateTime={d => d.type === 'aurora' ? 2000 : (d.speed ? 5000 / d.speed * 1000 : 2000)}
              arcLabel={d => d.type === 'aurora' ? `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>${d.type === 'northern' ? 'Northern' : 'Southern'} Aurora</strong><br/>
                  Intensity: ${(d.intensity * 100).toFixed(0)}%<br/>
                  Kp Index: ${d.kpIndex}<br/>
                  Altitude: ~110 km
                </div>
              ` : `
                <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                  <strong>Solar Particle Event</strong><br/>
                  X-ray Level: ${d.xrayLevel}<br/>
                  Proton Level: ${d.protonLevel} pfu<br/>
                  Speed: ${d.speed} km/s
                </div>
              `}
              
              // Atmosphere
              showAtmosphere={true}
              atmosphereColor="#4080ff"
              atmosphereAltitude={0.15}
              
              // Controls
              enablePointerInteraction={true}
              
              // Events
              onGlobeReady={() => {
                setGlobeReady(true);
                if (globeRef.current) {
                  globeRef.current.pointOfView({
                    lat: 0,
                    lng: 0,
                    altitude: 2.5
                  }, 2000);
                  
                  globeRef.current.controls().autoRotate = true;
                  globeRef.current.controls().autoRotateSpeed = 0.3;
                }
              }}
              
              onZoom={({ lat, lng }) => {
                if (globeMaterial) {
                  globeMaterial.uniforms.globeRotation.value.set(lng, lat);
                }
              }}
            />
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600">
            <h4 className="text-white font-bold mb-2">Space Weather Legend</h4>
            <div className="space-y-1 text-xs">
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-yellow-400 mr-2"></div>
                Solar Wind (400-600 km/s)
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-blue-400 mr-2"></div>
                Magnetic Field Lines
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-green-400 mr-2"></div>
                Aurora (Northern/Southern)
              </div>
              <div className="flex items-center text-gray-300">
                <div className="w-4 h-1 bg-purple-400 mr-2"></div>
                Solar Flares/Particles
              </div>
            </div>
          </div>

          {/* Alert Status */}
          <div className="absolute bottom-4 right-4 z-10 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-600">
            <h4 className="text-white font-bold mb-2">Alert Status</h4>
            <div className="flex items-center justify-center">
              <div 
                className="w-8 h-8 rounded-full mr-3"
                style={{ backgroundColor: getAlertColor(alertLevel) }}
              ></div>
              <div className="text-white font-bold">
                {alertLevel.toUpperCase()}
              </div>
            </div>
            <div className="text-xs text-gray-300 mt-2">
              {alertLevel === 'green' && 'Quiet conditions'}
              {alertLevel === 'yellow' && 'Minor storm activity'}
              {alertLevel === 'orange' && 'Moderate storm activity'}
              {alertLevel === 'red' && 'Severe storm activity'}
            </div>
          </div>
        </Layout>
      </main>
    </>
  );
};

export default SpaceWeatherVisualization;