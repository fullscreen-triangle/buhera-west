import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import dynamic from 'next/dynamic';
import useSceneTime from '../../hooks/useSceneTime';
import Rain from '../particles/Rain';
import Snow from '../particles/Snow';
import Fog from '../particles/Fog';
import Weather from '../weather/Weather';

// Dynamic import for react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import('react-globe.gl').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '400px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'white', textAlign: 'center' }}>
        <div style={{ border: '4px solid transparent', borderTop: '4px solid white', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }}></div>
        <p style={{ fontSize: '14px' }}>Loading Globe...</p>
      </div>
    </div>
  )
});

/**
 * Time-aware scene with both globe and weather particles
 */
const TimeAwareScene = () => {
  const { currentTime, getDayNightCycle, getSeasonalCycle, formatTime } = useSceneTime();
  const [showGlobe, setShowGlobe] = useState(true);
  
  // Determine weather based on time
  const weatherConditions = useMemo(() => {
    const dayNight = getDayNightCycle();
    const seasonal = getSeasonalCycle();
    
    // More rain during night and autumn/winter
    const rainProbability = (1 - dayNight) * 0.3 + (seasonal > 0.5 ? 0.4 : 0.1);
    
    // Snow only in winter (seasonal > 0.75)
    const snowProbability = seasonal > 0.75 ? 0.6 : 0;
    
    // Fog during dawn/dusk transitions
    const fogProbability = dayNight > 0.2 && dayNight < 0.5 ? 0.7 : 0.1;
    
    // Storm conditions during high activity periods
    const stormProbability = dayNight > 0.7 && seasonal > 0.6 ? 0.3 : 0;
    
    // Determine primary weather
    let primaryWeather = 'clear';
    let intensity = 0.3;
    
    if (snowProbability > 0.4) {
      primaryWeather = 'snow';
      intensity = snowProbability;
    } else if (stormProbability > 0.2) {
      primaryWeather = 'storm';
      intensity = stormProbability;
    } else if (rainProbability > 0.2) {
      primaryWeather = 'rain';
      intensity = rainProbability;
    } else if (fogProbability > 0.4) {
      primaryWeather = 'fog';
      intensity = fogProbability;
    }
    
    return {
      type: primaryWeather,
      intensity,
      showRain: primaryWeather === 'rain' || primaryWeather === 'storm',
      showSnow: primaryWeather === 'snow',
      showFog: primaryWeather === 'fog' || fogProbability > 0.3,
      timeOfDay: ((currentTime % 86400) / 86400) * 24,
      windSpeed: dayNight * 0.5 + 0.2,
      windDirection: [Math.sin(currentTime * 0.001) * 0.5, -1, Math.cos(currentTime * 0.001) * 0.5]
    };
  }, [getDayNightCycle, getSeasonalCycle, currentTime]);
  
  // Generate time-based data points for globe
  const timeAwareData = useMemo(() => {
    const dayNight = getDayNightCycle();
    const seasonal = getSeasonalCycle();
    
    // Create data points that change with time
    const points = [];
    for (let i = 0; i < 50; i++) {
      const lat = (Math.random() - 0.5) * 180;
      const lng = (Math.random() - 0.5) * 360;
      
      // Temperature varies with day/night cycle and season
      const baseTemp = 15 + seasonal * 20; // 15-35°C range
      const dayNightTemp = dayNight * 10; // +10°C during day
      const temperature = baseTemp + dayNightTemp + (Math.random() - 0.5) * 10;
      
      // Activity level based on time
      const activity = dayNight * 0.8 + seasonal * 0.2;
      
      points.push({
        lat,
        lng,
        temperature,
        activity,
        altitude: Math.max(0.01, activity * 0.05),
        size: Math.max(0.5, activity * 3),
        color: temperature > 25 ? '#ff4444' : temperature > 15 ? '#ffaa44' : '#4444ff'
      });
    }
    
    return points;
  }, [getDayNightCycle, getSeasonalCycle]);
  
  // Generate arcs representing global connections
  const connectionArcs = useMemo(() => {
    const arcs = [];
    const activityLevel = getDayNightCycle();
    
    // More connections during "day" periods
    const numArcs = Math.floor(activityLevel * 20) + 5;
    
    for (let i = 0; i < numArcs; i++) {
      const startLat = (Math.random() - 0.5) * 180;
      const startLng = (Math.random() - 0.5) * 360;
      const endLat = (Math.random() - 0.5) * 180;
      const endLng = (Math.random() - 0.5) * 360;
      
      arcs.push({
        startLat,
        startLng,
        endLat,
        endLng,
        color: `rgba(${Math.floor(255 * activityLevel)}, ${Math.floor(255 * (1 - activityLevel))}, 100, 0.8)`,
        stroke: Math.max(1, activityLevel * 3)
      });
    }
    
    return arcs;
  }, [getDayNightCycle]);
  
  // Day/night atmosphere color
  const atmosphereColor = useMemo(() => {
    const dayNight = getDayNightCycle();
    const r = Math.floor(135 + dayNight * 120); // 135-255
    const g = Math.floor(206 + dayNight * 49);  // 206-255
    const b = Math.floor(235 + dayNight * 20);  // 235-255
    return `rgb(${r}, ${g}, ${b})`;
  }, [getDayNightCycle]);
  
  // Globe background based on time
  const globeImageUrl = useMemo(() => {
    const dayNight = getDayNightCycle();
    // Use day texture during day, night texture during night
    return dayNight > 0.5 
      ? "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      : "//unpkg.com/three-globe/example/img/earth-night.jpg";
  }, [getDayNightCycle]);
  
  return (
    <div style={{ width: '100%', height: '400px', position: 'relative' }}>
      {/* Time and weather overlay */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 10,
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
        minWidth: '200px'
      }}>
        <div>Scene Time: {formatTime ? formatTime(currentTime) : '00:00:00'}</div>
        <div>Day/Night: {(getDayNightCycle() * 100).toFixed(0)}%</div>
        <div>Season: {(getSeasonalCycle() * 100).toFixed(0)}%</div>
        <div>Weather: {weatherConditions.type} ({(weatherConditions.intensity * 100).toFixed(0)}%)</div>
        <div>View: {showGlobe ? 'Globe' : '3D Scene'}</div>
      </div>
      
      {/* Activity and weather indicator */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 10,
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        <div style={{
          width: '60px',
          height: '8px',
          background: 'rgba(255, 255, 255, 0.3)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '4px'
        }}>
          <div style={{
            width: `${getDayNightCycle() * 100}%`,
            height: '100%',
            background: `linear-gradient(to right, #4444ff, #ffaa44, #ff4444)`,
            transition: 'width 0.3s ease'
          }} />
        </div>
        <div style={{ fontSize: '10px', marginBottom: '4px' }}>
          {getDayNightCycle() > 0.8 ? 'Peak Activity' : 
           getDayNightCycle() > 0.4 ? 'Moderate Activity' : 'Low Activity'}
        </div>
        <div style={{ fontSize: '10px', color: '#ccc' }}>
          Wind: {(weatherConditions.windSpeed * 100).toFixed(0)}%
        </div>
      </div>
      
      {/* View Toggle */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        zIndex: 10
      }}>
        <button
          onClick={() => setShowGlobe(!showGlobe)}
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}
        >
          Switch to {showGlobe ? '3D Scene' : 'Globe'}
        </button>
      </div>
      
      {showGlobe ? (
        /* Globe View with Weather Overlay */
        <div style={{ position: 'relative' }}>
          <Globe
            width={undefined}
            height={400}
            backgroundColor="rgba(0,0,0,0)"
            
            // Globe appearance changes with time
            globeImageUrl={globeImageUrl}
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            
            // Atmosphere changes color based on time
            showAtmosphere={true}
            atmosphereColor={atmosphereColor}
            atmosphereAltitude={0.12}
            
            // Time-aware data points
            pointsData={timeAwareData}
            pointLat="lat"
            pointLng="lng"
            pointAltitude="altitude"
            pointColor="color"
            pointRadius="size"
            pointResolution={6}
            pointLabel={d => `
              <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px; border-radius: 4px; font-size: 12px;">
                <div><strong>Temperature:</strong> ${d.temperature.toFixed(1)}°C</div>
                <div><strong>Activity:</strong> ${(d.activity * 100).toFixed(0)}%</div>
                <div><strong>Location:</strong> ${d.lat.toFixed(2)}, ${d.lng.toFixed(2)}</div>
              </div>
            `}
            
            // Dynamic connection arcs
            arcsData={connectionArcs}
            arcColor="color"
            arcStroke="stroke"
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashInitialGap={() => Math.random()}
            arcDashAnimateTime={1000}
            
            // Controls
            enablePointerInteraction={true}
            
            // Auto-rotation
            onGlobeReady={(globe) => {
              globe.pointOfView({ lat: 0, lng: 0, altitude: 2.5 });
              globe.controls().autoRotate = true;
              globe.controls().autoRotateSpeed = 0.5;
            }}
          />
          
          {/* Weather overlay on globe */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            opacity: weatherConditions.intensity * 0.7
          }}>
            <Canvas style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
              {/* Weather particles floating over globe */}
              {weatherConditions.showRain && (
                <Rain
                  intensity={weatherConditions.intensity}
                  wind={true}
                  windDirection={weatherConditions.windDirection}
                  windSpeed={weatherConditions.windSpeed}
                  splashEffects={weatherConditions.intensity > 0.5}
                />
              )}
              
              {weatherConditions.showSnow && (
                <Snow
                  intensity={weatherConditions.intensity}
                  wind={true}
                  windDirection={weatherConditions.windDirection}
                  windSpeed={weatherConditions.windSpeed * 0.5}
                  sparkle={0.8}
                  accumulation={false}
                />
              )}
              
              {weatherConditions.showFog && (
                <Fog
                  density={weatherConditions.intensity * 0.5}
                  animated={true}
                  groundFog={true}
                  height={2}
                  color={getDayNightCycle() > 0.5 ? '#e0e0e0' : '#404060'}
                />
              )}
            </Canvas>
          </div>
        </div>
      ) : (
        /* 3D Scene View with Full Weather */
        <Canvas shadows camera={{ position: [10, 10, 10], fov: 60 }}>
          {/* Lighting */}
          <ambientLight intensity={0.3 + getDayNightCycle() * 0.4} />
          <directionalLight
            position={[50, 50, 25]}
            intensity={getDayNightCycle() * 1.2 + 0.3}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          
          {/* Animated Sky */}
          <Sky
            distance={450000}
            sunPosition={[
              Math.sin(getDayNightCycle() * Math.PI * 2) * 50,
              Math.cos(getDayNightCycle() * Math.PI * 2) * 30 + 10,
              0
            ]}
            inclination={0.6}
            azimuth={0.1}
            rayleigh={0.5 + getDayNightCycle() * 1.5}
            turbidity={1 + (1 - getDayNightCycle()) * 9}
          />
          
          {/* Ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <meshLambertMaterial 
              color={new THREE.Color(
                0.2 + getSeasonalCycle() * 0.3,
                0.3 + getDayNightCycle() * 0.4,
                0.1 + (1 - getDayNightCycle()) * 0.2
              )}
            />
          </mesh>
          
          {/* Weather particles */}
          {weatherConditions.showRain && (
            <Rain
              intensity={weatherConditions.intensity}
              wind={true}
              windDirection={weatherConditions.windDirection}
              windSpeed={weatherConditions.windSpeed}
              splashEffects={true}
            />
          )}
          
          {weatherConditions.showSnow && (
            <Snow
              intensity={weatherConditions.intensity}
              wind={true}
              windDirection={weatherConditions.windDirection}
              windSpeed={weatherConditions.windSpeed * 0.5}
              sparkle={0.8}
              accumulation={true}
            />
          )}
          
          {weatherConditions.showFog && (
            <Fog
              density={weatherConditions.intensity * 0.4}
              animated={true}
              groundFog={true}
              volumetric={weatherConditions.intensity > 0.5}
              height={3}
              color={getDayNightCycle() > 0.5 ? '#e0e0e0' : '#404060'}
            />
          )}
          
          {/* Main weather system */}
          <Weather
            type={weatherConditions.type}
            intensity={weatherConditions.intensity}
            wind={weatherConditions.windSpeed > 0.3}
            windDirection={weatherConditions.windDirection}
            windSpeed={weatherConditions.windSpeed}
            lightning={weatherConditions.type === 'storm'}
            timeOfDay={weatherConditions.timeOfDay}
            affectLighting={true}
            soundVolume={0.3}
          />
          
          {/* Reference objects */}
          <mesh position={[0, 1, 0]} castShadow>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="red" />
          </mesh>
          
          <mesh position={[5, 0.5, 0]} castShadow>
            <sphereGeometry args={[1, 32, 32]} />
            <meshStandardMaterial color="blue" />
          </mesh>
          
          {/* Camera controls */}
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        </Canvas>
      )}
    </div>
  );
};

export default TimeAwareScene; 