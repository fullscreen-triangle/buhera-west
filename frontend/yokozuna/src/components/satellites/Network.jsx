'use client'
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as satellite from 'satellite.js';

// Dynamic import for react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import('react-globe.gl').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'white', textAlign: 'center' }}>
        <div style={{ border: '4px solid transparent', borderTop: '4px solid white', borderRadius: '50%', width: '48px', height: '48px', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
        <p>Loading Satellite Network...</p>
      </div>
    </div>
  )
});

  const EARTH_RADIUS_KM = 6371; // km
  const TIME_STEP = 60 * 1000; // 1 minute per frame (real satellite speeds)
  const SPEED_MULTIPLIER = 60; // 60x real speed for visible movement

  const Network = () => {
    const globeEl = useRef();
    const [satData, setSatData] = useState();
    const [globeRadius, setGlobeRadius] = useState();
    const [time, setTime] = useState(new Date());
    const [isPlaying, setIsPlaying] = useState(true);
    const [speedMultiplier, setSpeedMultiplier] = useState(SPEED_MULTIPLIER);
    const [selectedSatellite, setSelectedSatellite] = useState(null);

    useEffect(() => {
      // time ticker with realistic satellite speeds
      let animationId;
      (function frameTicker() {
        if (isPlaying) {
          setTime(time => new Date(+time + (TIME_STEP * speedMultiplier)));
        }
        animationId = requestAnimationFrame(frameTicker);
      })();
      
      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    }, [isPlaying, speedMultiplier]);

    useEffect(() => {
      // load satellite data
      const loadSatelliteData = async () => {
        try {
          const response = await fetch('//cdn.jsdelivr.net/npm/globe.gl/example/datasets/space-track-leo.txt');
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const rawData = await response.text();
          const tleData = rawData.replace(/\r/g, '')
            .split(/\n(?=[^12])/)
            .filter(d => d)
            .map(tle => tle.split('\n'));
            
          const satData = tleData.map(([name, ...tle]) => ({
            satrec: satellite.twoline2satrec(...tle),
            name: name.trim().replace(/^0 /, '')
          }))
          // exclude those that can't be propagated
          .filter(d => !!satellite.propagate(d.satrec, new Date())?.position);

          setSatData(satData);
        } catch (error) {
          console.error('Failed to load satellite data:', error);
          // Optionally set some fallback data or error state
          setSatData([]);
        }
      };

      loadSatelliteData();
    }, []);

    const particlesData = useMemo(() => {
      if (!satData) return [];

      // Update satellite positions with realistic orbital mechanics
      const gmst = satellite.gstime(time);
      return satData.map(d => {
        const eci = satellite.propagate(d.satrec, time);
        if (eci?.position) {
          const gdPos = satellite.eciToGeodetic(eci.position, gmst);
          const lat = satellite.radiansToDegrees(gdPos.latitude);
          const lng = satellite.radiansToDegrees(gdPos.longitude);
          const alt = gdPos.height / EARTH_RADIUS_KM;
          
          // Add velocity and orbital period information
          const velocity = eci.velocity ? Math.sqrt(
            Math.pow(eci.velocity.x, 2) + 
            Math.pow(eci.velocity.y, 2) + 
            Math.pow(eci.velocity.z, 2)
          ) : 0;
          
          return { 
            ...d, 
            lat, 
            lng, 
            alt, 
            velocity: velocity * 1000, // Convert to m/s
            orbitalPeriod: Math.sqrt(Math.pow(gdPos.height + EARTH_RADIUS_KM, 3) / 398600.4418) * 2 * Math.PI / 60, // minutes
            isSelected: selectedSatellite === d.name
          };
        }
        return null;
      }).filter(d => d && !isNaN(d.lat) && !isNaN(d.lng) && !isNaN(d.alt));
    }, [satData, time, selectedSatellite]);

    useEffect(() => {
      if (globeEl.current) {
        setGlobeRadius(globeEl.current.getGlobeRadius());
        globeEl.current.pointOfView({ altitude: 3.5 });
      }
    }, []);

    return (
      <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <Globe
          ref={globeEl}
          globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg"
          particlesData={particlesData}
          particleLabel={useCallback(d => `${d.name}\nAltitude: ${(d.alt * EARTH_RADIUS_KM).toFixed(0)} km\nVelocity: ${(d.velocity / 1000).toFixed(1)} km/s\nPeriod: ${d.orbitalPeriod.toFixed(1)} min`, [])}
          particleLat="lat"
          particleLng="lng"
          particleAltitude="alt"
          particleColor={useCallback(d => d.isSelected ? '#ff4444' : '#00ff88', [])}
          particleRadius={useCallback(d => d.isSelected ? 3 : 1.5, [])}
          onParticleClick={useCallback(particle => {
            setSelectedSatellite(selectedSatellite === particle.name ? null : particle.name);
          }, [selectedSatellite])}
        />
        
        {/* Controls Panel */}
        <div style={{
          position: 'absolute', top: 20, left: 20, background: 'rgba(0,0,0,0.8)', color: 'white',
          padding: '15px', borderRadius: '8px', zIndex: 1000, minWidth: '280px'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>🛰️ Satellite Network Control</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <button onClick={() => setIsPlaying(!isPlaying)}
                    style={{ 
                      background: isPlaying ? '#ff4444' : '#00ff88', 
                      color: 'white', border: 'none', padding: '8px 15px', 
                      borderRadius: '5px', cursor: 'pointer', marginRight: '10px'
                    }}>
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <button onClick={() => setTime(new Date())}
                    style={{ 
                      background: '#0088ff', color: 'white', border: 'none', 
                      padding: '8px 15px', borderRadius: '5px', cursor: 'pointer'
                    }}>
              🕐 Reset Time
            </button>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
              Speed: {speedMultiplier}x ({speedMultiplier === 1 ? 'Real Time' : speedMultiplier < 1 ? 'Slower' : 'Faster'})
            </label>
            <input 
              type="range" 
              min="0.1" 
              max="200" 
              step="0.1"
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ fontSize: '11px', opacity: 0.9 }}>
            <div><strong>Current Time:</strong> {time.toISOString().slice(0, 19).replace('T', ' ')}</div>
            <div><strong>Active Satellites:</strong> {particlesData.length}</div>
            {selectedSatellite && (
              <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255,68,68,0.2)', borderRadius: '5px' }}>
                <strong>Selected:</strong> {selectedSatellite}
              </div>
            )}
          </div>
        </div>

        {/* Satellite Info Panel */}
        {selectedSatellite && (
          <div style={{
            position: 'absolute', bottom: 20, left: 20, background: 'rgba(0,0,0,0.9)', color: 'white',
            padding: '15px', borderRadius: '8px', zIndex: 1000, maxWidth: '320px'
          }}>
            {(() => {
              const sat = particlesData.find(d => d.name === selectedSatellite);
              return sat ? (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', color: '#ff4444' }}>{sat.name}</h4>
                  <div style={{ fontSize: '12px' }}>
                    <div><strong>Position:</strong> {sat.lat.toFixed(2)}°, {sat.lng.toFixed(2)}°</div>
                    <div><strong>Altitude:</strong> {(sat.alt * EARTH_RADIUS_KM).toFixed(0)} km</div>
                    <div><strong>Velocity:</strong> {(sat.velocity / 1000).toFixed(1)} km/s</div>
                    <div><strong>Orbital Period:</strong> {sat.orbitalPeriod.toFixed(1)} minutes</div>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>
    );
  };


  export { Network as SatelliteNetwork };
  export default Network;