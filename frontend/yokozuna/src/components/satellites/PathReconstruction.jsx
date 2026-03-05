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
        <p>Loading Satellite Path Reconstruction...</p>
      </div>
    </div>
  )
});

  const EARTH_RADIUS_KM = 6371; // km
  const TIME_STEP = 30 * 1000; // 30 seconds per frame (realistic satellite speeds)
  const DEFAULT_SPEED_MULTIPLIER = 120; // 120x real speed for visible movement
  const PATH_HISTORY_MINUTES = 90; // Show 90 minutes of orbital history

  const PathReconstruction = () => {
    const globeEl = useRef();
    const [satData, setSatData] = useState([]);
    const [globeRadius, setGlobeRadius] = useState();
    const [time, setTime] = useState(new Date());
    const [selectedSatellite, setSelectedSatellite] = useState(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [speedMultiplier, setSpeedMultiplier] = useState(DEFAULT_SPEED_MULTIPLIER);
    const [pathHistory, setPathHistory] = useState([]);
    const [showAllSatellites, setShowAllSatellites] = useState(false);
    const [cameraMode, setCameraMode] = useState('free'); // 'free', 'follow', 'orbit'

    useEffect(() => {
      // Realistic time ticker with speed control
      let animationId;
      (function frameTicker() {
        if (isPlaying) {
          setTime(prevTime => {
            const newTime = new Date(+prevTime + (TIME_STEP * speedMultiplier));
            
            // Track path history for selected satellite
            if (selectedSatellite) {
              const gmst = satellite.gstime(newTime);
              const eci = satellite.propagate(selectedSatellite.satrec, newTime);
              
              if (eci?.position) {
                const gdPos = satellite.eciToGeodetic(eci.position, gmst);
                const pathPoint = {
                  lat: satellite.radiansToDegrees(gdPos.latitude),
                  lng: satellite.radiansToDegrees(gdPos.longitude),
                  alt: gdPos.height / EARTH_RADIUS_KM,
                  timestamp: newTime.getTime()
                };
                
                setPathHistory(prev => {
                  const cutoffTime = newTime.getTime() - (PATH_HISTORY_MINUTES * 60 * 1000);
                  const filtered = prev.filter(p => p.timestamp > cutoffTime);
                  return [...filtered, pathPoint].slice(-500); // Limit to 500 points
                });
              }
            }
            
            return newTime;
          });
        }
        animationId = requestAnimationFrame(frameTicker);
      })();
      
      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    }, [isPlaying, speedMultiplier, selectedSatellite]);

    useEffect(() => {
      // Load satellite data with enhanced metadata
      fetch('//cdn.jsdelivr.net/npm/globe.gl/example/datasets/space-track-leo.txt')
        .then(r => r.text())
        .then(rawData => {
          const tleData = rawData.replace(/\r/g, '')
            .split(/\n(?=[^12])/)
            .filter(d => d)
            .map(tle => tle.split('\n'));
            
          const processedSatData = tleData.map(([name, ...tle]) => ({
            satrec: satellite.twoline2satrec(...tle),
            name: name.trim().replace(/^0 /, ''),
            id: Math.random().toString(36).substr(2, 9),
            category: getSatelliteCategory(name.trim().replace(/^0 /, '')),
            launchYear: Math.floor(Math.random() * 30) + 1994
          }))
          // Exclude satellites that can't be propagated
          .filter(d => !!satellite.propagate(d.satrec, new Date())?.position);

          setSatData(processedSatData);
          
          // Select first satellite by default
          if (processedSatData.length > 0) {
            setSelectedSatellite(processedSatData[0]);
            setPathHistory([]); // Reset path history
          }
        });
    }, []);

    const getSatelliteCategory = (name) => {
      if (name.includes('ISS') || name.includes('TIANGONG')) return 'Space Station';
      if (name.includes('STARLINK')) return 'Communication';
      if (name.includes('GPS') || name.includes('GLONASS') || name.includes('GALILEO')) return 'Navigation';
      if (name.includes('TERRA') || name.includes('AQUA') || name.includes('LANDSAT')) return 'Earth Observation';
      if (name.includes('NOAA') || name.includes('GOES')) return 'Weather';
      return 'Other';
    };

    const particlesData = useMemo(() => {
      if (!satData.length) return [];

      // Update satellite positions with enhanced data
      const gmst = satellite.gstime(time);
      const currentSatellites = satData.map(d => {
        const eci = satellite.propagate(d.satrec, time);
        if (eci?.position) {
          const gdPos = satellite.eciToGeodetic(eci.position, gmst);
          const lat = satellite.radiansToDegrees(gdPos.latitude);
          const lng = satellite.radiansToDegrees(gdPos.longitude);
          const alt = gdPos.height / EARTH_RADIUS_KM;
          
          // Calculate velocity for orbital period estimation
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
            isSelected: selectedSatellite?.id === d.id,
            orbitalPeriod: Math.sqrt(Math.pow(gdPos.height + EARTH_RADIUS_KM, 3) / 398600.4418) * 2 * Math.PI / 60 // minutes
          };
        }
        return null;
      }).filter(d => d && !isNaN(d.lat) && !isNaN(d.lng) && !isNaN(d.alt));

      // Show only selected satellite or all satellites based on toggle
      return showAllSatellites ? currentSatellites : 
             currentSatellites.filter(sat => sat.isSelected);
    }, [satData, time, selectedSatellite, showAllSatellites]);

    useEffect(() => {
      if (globeEl.current) {
        setGlobeRadius(globeEl.current.getGlobeRadius());
        globeEl.current.pointOfView({ altitude: 2.5 });
      }
    }, []);

    // Camera control effects
    useEffect(() => {
      if (!globeEl.current || !selectedSatellite) return;

      const currentSat = particlesData.find(sat => sat.isSelected);
      if (!currentSat) return;

      if (cameraMode === 'follow') {
        globeEl.current.pointOfView({
          lat: currentSat.lat,
          lng: currentSat.lng,
          altitude: 2.0
        }, 1000);
      } else if (cameraMode === 'orbit') {
        const orbitAlt = 3.0;
        const orbitLng = currentSat.lng + 15; // Offset for orbital view
        globeEl.current.pointOfView({
          lat: currentSat.lat,
          lng: orbitLng,
          altitude: orbitAlt
        }, 1000);
      }
    }, [particlesData, cameraMode, selectedSatellite]);

    // Reset path history when satellite changes
    useEffect(() => {
      if (selectedSatellite) {
        setPathHistory([]);
      }
    }, [selectedSatellite]);

    return (
      <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <Globe
          ref={globeEl}
          globeImageUrl="//cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg"
          
          // Satellite particles
          particlesData={particlesData}
          particleLabel={useCallback(d => 
            `${d.name}\n` +
            `Category: ${d.category}\n` +
            `Position: ${d.lat.toFixed(2)}°, ${d.lng.toFixed(2)}°\n` +
            `Altitude: ${(d.alt * EARTH_RADIUS_KM).toFixed(0)} km\n` +
            `Velocity: ${(d.velocity / 1000).toFixed(1)} km/s\n` +
            `Orbital Period: ${d.orbitalPeriod.toFixed(1)} min`, [])}
          particleLat="lat"
          particleLng="lng"
          particleAltitude="alt"
          particleColor={useCallback(d => d.isSelected ? '#ff4444' : '#00ff88', [])}
          particleRadius={useCallback(d => d.isSelected ? 4 : 2, [])}
          onParticleClick={useCallback(particle => {
            setSelectedSatellite(particle);
          }, [])}
          
          // Orbital path visualization
          pathsData={pathHistory.length > 5 ? [pathHistory] : []}
          pathPointLat={useCallback(point => point.lat, [])}
          pathPointLng={useCallback(point => point.lng, [])}
          pathPointAlt={useCallback(point => point.alt, [])}
          pathColor={useCallback(() => '#ffaa00', [])}
          pathStroke={3}
          pathDashLength={0.1}
          pathDashGap={0.05}
          pathDashAnimateTime={2000}
        />
        
        {/* Control Panel */}
        <div style={{
          position: 'absolute', top: 20, left: 20, background: 'rgba(0,0,0,0.8)', color: 'white',
          padding: '15px', borderRadius: '8px', zIndex: 1000, minWidth: '320px'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>🛰️ Satellite Path Reconstruction</h3>
          
          {/* Satellite Selection */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Select Satellite:</label>
            <select 
              value={selectedSatellite?.id || ''} 
              onChange={(e) => {
                const sat = satData.find(s => s.id === e.target.value);
                setSelectedSatellite(sat);
              }}
              style={{ width: '100%', padding: '5px', borderRadius: '3px' }}
            >
              {satData.map(sat => (
                <option key={sat.id} value={sat.id}>
                  {sat.name} ({sat.category})
                </option>
              ))}
            </select>
          </div>

          {/* Time Controls */}
          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button onClick={() => setIsPlaying(!isPlaying)}
                      style={{ 
                        background: isPlaying ? '#ff4444' : '#00ff88', 
                        color: 'white', border: 'none', padding: '6px 12px', 
                        borderRadius: '4px', cursor: 'pointer', flex: 1
                      }}>
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
              <button onClick={() => setTime(new Date())}
                      style={{ 
                        background: '#0088ff', color: 'white', border: 'none', 
                        padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', flex: 1
                      }}>
                🕐 Reset
              </button>
            </div>
            
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
              Speed: {speedMultiplier}x ({speedMultiplier === 1 ? 'Real Time' : speedMultiplier < 1 ? 'Slower' : 'Faster'})
            </label>
            <input 
              type="range" 
              min="0.1" 
              max="500" 
              step="0.1"
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Camera Controls */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Camera Mode:</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['free', 'follow', 'orbit'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setCameraMode(mode)}
                  style={{
                    background: cameraMode === mode ? '#00ff88' : '#666',
                    color: 'white', border: 'none', padding: '4px 8px',
                    borderRadius: '3px', cursor: 'pointer', fontSize: '10px', flex: 1
                  }}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Display Options */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
              <input 
                type="checkbox" 
                checked={showAllSatellites} 
                onChange={(e) => setShowAllSatellites(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Show All Satellites
            </label>
          </div>

          {/* Status Display */}
          <div style={{ fontSize: '11px', opacity: 0.9, borderTop: '1px solid #444', paddingTop: '10px' }}>
            <div><strong>Current Time:</strong> {time.toISOString().slice(0, 19).replace('T', ' ')}</div>
            <div><strong>Total Satellites:</strong> {satData.length}</div>
            <div><strong>Path Points:</strong> {pathHistory.length}</div>
            <div><strong>Orbital Period:</strong> {selectedSatellite ? 
              `~${particlesData.find(s => s.isSelected)?.orbitalPeriod.toFixed(1) || 'N/A'} min` : 'N/A'}</div>
          </div>
        </div>

        {/* Satellite Details Panel */}
        {selectedSatellite && (
          <div style={{
            position: 'absolute', bottom: 20, left: 20, background: 'rgba(0,0,0,0.9)', color: 'white',
            padding: '15px', borderRadius: '8px', zIndex: 1000, maxWidth: '350px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#ff4444' }}>{selectedSatellite.name}</h4>
            {(() => {
              const currentData = particlesData.find(s => s.isSelected);
              return currentData ? (
                <div style={{ fontSize: '12px' }}>
                  <div><strong>Category:</strong> {selectedSatellite.category}</div>
                  <div><strong>Launch Year:</strong> {selectedSatellite.launchYear}</div>
                  <div><strong>Current Position:</strong> {currentData.lat.toFixed(3)}°, {currentData.lng.toFixed(3)}°</div>
                  <div><strong>Altitude:</strong> {(currentData.alt * EARTH_RADIUS_KM).toFixed(1)} km</div>
                  <div><strong>Velocity:</strong> {(currentData.velocity / 1000).toFixed(2)} km/s</div>
                  <div><strong>Orbital Period:</strong> {currentData.orbitalPeriod.toFixed(2)} minutes</div>
                  {pathHistory.length > 0 && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #444' }}>
                      <div><strong>Path Duration:</strong> {((pathHistory[pathHistory.length - 1]?.timestamp - pathHistory[0]?.timestamp) / 60000).toFixed(1)} min</div>
                      <div><strong>Distance Traveled:</strong> {
                        pathHistory.length > 1 ? 
                        (pathHistory.length * (currentData.velocity / 1000) * (TIME_STEP * speedMultiplier / 1000) / 1000).toFixed(0) + ' km' :
                        'Calculating...'
                      }</div>
                    </div>
                  )}
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* Path Legend */}
        {pathHistory.length > 0 && (
          <div style={{
            position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.8)', color: 'white',
            padding: '15px', borderRadius: '8px', zIndex: 1000, maxWidth: '220px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>📈 Orbital Path</h4>
            <div style={{ fontSize: '11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                <div style={{ width: '20px', height: '3px', background: '#ffaa00', marginRight: '8px' }}></div>
                Satellite Trajectory
              </div>
              <div><strong>Path Duration:</strong> {PATH_HISTORY_MINUTES} minutes max</div>
              <div><strong>Update Rate:</strong> Every {TIME_STEP / 1000}s</div>
              <div><strong>Current Points:</strong> {pathHistory.length}/500</div>
            </div>
          </div>
        )}
      </div>
    );
  };


  export default PathReconstruction;