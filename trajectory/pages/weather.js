import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import LocationSelector from '../src/components/LocationSelector';
import { weatherService } from '../src/services/weatherService';

// Dynamic imports to avoid SSR issues with Three.js and Mapbox GL
const Scene3D = dynamic(() => import('../src/components/Scene3D'), { ssr: false });
const TerrainMap = dynamic(() => import('../src/components/TerrainMap'), { ssr: false });

export default function WeatherPage() {
    const [weatherData, setWeatherData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentLocationName, setCurrentLocationName] = useState('');
    const [isPortalMode, setIsPortalMode] = useState(false);
    const [exitPortalFunction, setExitPortalFunction] = useState(null);
    const [portalWeatherData, setPortalWeatherData] = useState(null);
    const [errorSearchQuery, setErrorSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('scene3d'); // 'scene3d' | 'terrain'
    const [dataSource, setDataSource] = useState('weatherapi'); // 'weatherapi' | 'openweather'

    useEffect(() => {
        loadCurrentLocationWeather();
    }, []);

    const fetchWeather = async (location) => {
        if (dataSource === 'openweather') {
            const res = await fetch(`/api/openweather?location=${encodeURIComponent(location)}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to fetch weather');
            }
            return res.json();
        }
        return weatherService.getCurrentWeather(location);
    };

    const loadCurrentLocationWeather = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const location = await weatherService.getCurrentLocation();
            const data = await fetchWeather(location);
            setWeatherData(data);
            setCurrentLocationName(`${data.location.name}, ${data.location.region}`);
        } catch (err) {
            console.error('Error loading weather:', err);
            setError('Unable to load weather data. Please try entering a city manually.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLocationChange = async (location) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchWeather(location);
            setWeatherData(data);
            setCurrentLocationName(`${data.location.name}, ${data.location.region}`);
        } catch (err) {
            console.error('Error loading weather:', err);
            setError('Unable to load weather data for this location.');
        } finally {
            setIsLoading(false);
        }
    };

    // When switching data source, reload weather
    useEffect(() => {
        if (currentLocationName) {
            handleLocationChange(currentLocationName);
        }
    }, [dataSource]);

    const isNightTime = () => {
        if (!weatherData?.location?.localtime) return false;
        const currentHour = new Date(weatherData.location.localtime).getHours();
        return currentHour >= 19 || currentHour <= 6;
    };

    const handleErrorSearch = async (e) => {
        e.preventDefault();
        if (errorSearchQuery.trim()) {
            await handleLocationChange(errorSearchQuery.trim());
            setErrorSearchQuery('');
        }
    };

    const displayWeatherData = isPortalMode && portalWeatherData ? portalWeatherData : weatherData;
    const isNight = isNightTime();
    const textColor = viewMode === 'terrain'
        ? 'text-white'
        : (isPortalMode || !isNight) ? 'text-black' : 'text-white';

    return (
        <>
            <Head>
                <title>Live Weather | Buhera-West</title>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
            </Head>

            <div className="w-screen h-screen min-h-dvh relative overflow-hidden bg-gray-950">
                {/* View layer — 3D Scene or Terrain Map */}
                <div className="absolute inset-0 z-0">
                    {viewMode === 'scene3d' ? (
                        <Scene3D
                            weatherData={weatherData}
                            isLoading={isLoading}
                            onPortalModeChange={setIsPortalMode}
                            onSetExitPortalFunction={setExitPortalFunction}
                            onPortalWeatherDataChange={setPortalWeatherData}
                        />
                    ) : (
                        <TerrainMap
                            weatherData={weatherData}
                            isLoading={isLoading}
                            onLocationChange={handleLocationChange}
                        />
                    )}
                </div>

                {/* View mode toggle — top center */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex bg-black/60 backdrop-blur-xl rounded-xl border border-white/15 overflow-hidden shadow-2xl">
                    <button
                        onClick={() => setViewMode('scene3d')}
                        className={`px-4 py-2.5 text-xs font-light transition-all flex items-center space-x-1.5 ${
                            viewMode === 'scene3d'
                                ? 'bg-cyan-500/30 text-cyan-400'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                        </svg>
                        <span>3D Scene</span>
                    </button>
                    <button
                        onClick={() => setViewMode('terrain')}
                        className={`px-4 py-2.5 text-xs font-light transition-all flex items-center space-x-1.5 ${
                            viewMode === 'terrain'
                                ? 'bg-cyan-500/30 text-cyan-400'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                        </svg>
                        <span>Terrain</span>
                    </button>
                </div>

                {/* Data source toggle — top right area */}
                <div className="absolute top-4 right-4 z-30 flex bg-black/50 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden">
                    <button
                        onClick={() => setDataSource('weatherapi')}
                        className={`px-3 py-1.5 text-[10px] font-light transition-all ${
                            dataSource === 'weatherapi' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        WeatherAPI
                    </button>
                    <button
                        onClick={() => setDataSource('openweather')}
                        className={`px-3 py-1.5 text-[10px] font-light transition-all ${
                            dataSource === 'openweather' ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        OpenWeather
                    </button>
                </div>

                {/* Weather UI overlays (only in 3D scene mode — terrain map has its own overlays) */}
                {viewMode === 'scene3d' && weatherData && !isLoading && (
                    <>
                        {isPortalMode ? (
                            <>
                                <div className={`absolute top-14 left-6 z-20 ${textColor}`}>
                                    <button
                                        onClick={() => exitPortalFunction?.()}
                                        className={`flex items-center space-x-2 px-4 py-2 ${textColor} opacity-80 hover:opacity-100 transition-opacity`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        <span className="text-sm font-light">Back</span>
                                    </button>
                                </div>
                                <div className={`absolute top-14 right-6 z-20 ${textColor} text-right`}>
                                    <div className="text-lg font-light tracking-wide opacity-95">
                                        {displayWeatherData.location.name}
                                        {displayWeatherData.rateLimited && (
                                            <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">DEMO</span>
                                        )}
                                    </div>
                                    <div className="text-sm opacity-60 tracking-wide">
                                        {displayWeatherData.location.region}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className={`absolute top-14 left-6 right-6 z-20 flex items-start justify-between ${textColor}`}>
                                <div>
                                    <div className="text-lg font-light tracking-wide opacity-95">
                                        {displayWeatherData.location.name}
                                        {displayWeatherData.rateLimited && (
                                            <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">DEMO</span>
                                        )}
                                        {displayWeatherData.source === 'openweathermap' && (
                                            <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full">OWM</span>
                                        )}
                                    </div>
                                    <div className="text-sm opacity-60 tracking-wide">
                                        {displayWeatherData.location.region}
                                    </div>
                                </div>
                                <LocationSelector
                                    onLocationChange={handleLocationChange}
                                    currentLocation={currentLocationName}
                                    isLoading={isLoading}
                                    isNight={isNight}
                                />
                            </div>
                        )}

                        {/* Temperature — Bottom Left */}
                        <div className={`absolute bottom-20 md:bottom-6 left-6 z-20 ${textColor}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                            <div className="flex items-end space-x-4">
                                <div className="flex items-baseline">
                                    <span className="text-6xl font-thin leading-none">
                                        {Math.round(displayWeatherData.current.temp_f)}
                                    </span>
                                    <span className="text-2xl font-thin opacity-75">°</span>
                                </div>
                                <div className="pb-2">
                                    <div className="text-sm font-light opacity-80 capitalize mb-1">
                                        {displayWeatherData.current.condition.text}
                                    </div>
                                    <div className="text-xs opacity-60">
                                        H: {Math.round(displayWeatherData.current.temp_f + 5)}° L: {Math.round(displayWeatherData.current.temp_f - 10)}°
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats — Bottom Right */}
                        <div className={`absolute bottom-20 md:bottom-6 right-6 z-20 ${textColor}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                            <div className="flex flex-col space-y-3 text-right text-sm">
                                <div className="flex items-center justify-end space-x-2">
                                    <span className="opacity-60">HUMIDITY</span>
                                    <span className="font-light">{displayWeatherData.current.humidity}%</span>
                                </div>
                                <div className="flex items-center justify-end space-x-2">
                                    <span className="opacity-60">WIND</span>
                                    <span className="font-light">{Math.round(displayWeatherData.current.wind_mph)} mph</span>
                                </div>
                                <div className="flex items-center justify-end space-x-2">
                                    <span className="opacity-60">FEELS</span>
                                    <span className="font-light">{Math.round(displayWeatherData.current.feelslike_f)}°</span>
                                </div>
                                <div className="flex items-center justify-end space-x-2">
                                    <span className="opacity-60">PRESSURE</span>
                                    <span className="font-light">{displayWeatherData.current.pressure_mb} mb</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Terrain mode location selector */}
                {viewMode === 'terrain' && weatherData && !isLoading && (
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20">
                        <LocationSelector
                            onLocationChange={handleLocationChange}
                            currentLocation={currentLocationName}
                            isLoading={isLoading}
                            isNight={true}
                        />
                    </div>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-50 bg-black/40 backdrop-blur-sm">
                        <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
                        <p className="text-lg font-light">Loading weather data...</p>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-lg z-50">
                        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 max-w-sm mx-4 text-center border border-white/20">
                            <p className="text-white text-lg font-light mb-6 leading-relaxed">{error}</p>
                            <form onSubmit={handleErrorSearch} className="mb-6">
                                <div className="flex items-center space-x-2 bg-white/10 rounded-2xl p-3 border border-white/20">
                                    <input
                                        type="text"
                                        value={errorSearchQuery}
                                        onChange={(e) => setErrorSearchQuery(e.target.value)}
                                        placeholder="Enter city name..."
                                        className="flex-1 bg-transparent text-white placeholder-white/60 focus:outline-none text-sm font-light"
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="submit"
                                        className="text-white/80 hover:text-white transition-colors disabled:opacity-40"
                                        disabled={!errorSearchQuery.trim() || isLoading}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </button>
                                </div>
                            </form>
                            <button
                                onClick={loadCurrentLocationWeather}
                                className="w-full bg-white/20 hover:bg-white/30 px-4 py-3 rounded-2xl text-white font-light transition-all border border-white/30 text-sm"
                                disabled={isLoading}
                            >
                                Try Location Again
                            </button>
                        </div>
                    </div>
                )}

                {/* Back to site link */}
                <Link href="/">
                    <span className="absolute bottom-4 left-4 z-30 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white/50 text-xs font-light hover:text-white/80 transition-colors border border-white/10 cursor-pointer">
                        ← Back to Buhera-West
                    </span>
                </Link>
            </div>
        </>
    );
}
