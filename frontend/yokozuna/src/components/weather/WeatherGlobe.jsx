import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';

// Dynamic import for react-globe.gl to prevent SSR issues
const Globe = dynamic(() => import('react-globe.gl').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-black flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
    </div>
  )
});

const WEATHER_COLORS = {
  sunny: '#FFD700',
  cloudy: '#87CEEB',
  rainy: '#4169E1',
  stormy: '#8B0000',
  snowy: '#FFFFFF',
  clear: '#00CED1'
};

export default function WeatherGlobe({ 
  weatherData = [], 
  focusedLocation = null, 
  isLoading = false 
}) {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle window dimensions safely for SSR
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    // Set initial dimensions
    updateDimensions();
    
    // Update on resize
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <div className="weather-globe-container" style={{ width: '100vw', height: '100vh' }}>
      <Globe
        width={dimensions.width}
        height={dimensions.height}
        
        // Globe appearance
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        
        // Atmosphere
        showAtmosphere={true}
        atmosphereColor="#87CEEB"
        atmosphereAltitude={0.15}
        
        // Weather points
        pointsData={weatherData}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.01}
        pointRadius={d => Math.max(0.1, d.temp ? Math.abs(d.temp) / 50 : 0.1)}
        pointColor={d => {
          if (!d.weather) return WEATHER_COLORS.clear;
          const weather = d.weather.toLowerCase();
          return WEATHER_COLORS[weather] || WEATHER_COLORS.clear;
        }}
        pointResolution={8}
        
        // Labels for focused location
        labelsData={focusedLocation ? [focusedLocation] : []}
        labelLat="lat"
        labelLng="lng"
        labelText={d => d.name || `${d.lat?.toFixed(2)}, ${d.lng?.toFixed(2)}`}
        labelSize={1.5}
        labelColor="#FFFFFF"
        labelResolution={2}
        
        // Non-interactive - disable pointer events
        enablePointerInteraction={false}
      />
      
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-white text-xl">Loading weather data...</div>
        </div>
      )}
      
      <style jsx>{`
        .weather-globe-container {
          position: relative;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
} 