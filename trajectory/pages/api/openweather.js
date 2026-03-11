// OpenWeatherMap API route with caching and rate limiting
const cache = new Map();
const rateLimitMap = new Map();

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 30;

function getClientIP(req) {
  return req.headers['x-forwarded-for'] || req.headers['x-real-ip'] ||
    req.connection?.remoteAddress || '127.0.0.1';
}

function isRateLimited(ip) {
  const now = Date.now();
  const requests = (rateLimitMap.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
  if (requests.length >= MAX_REQUESTS_PER_HOUR) return true;
  requests.push(now);
  rateLimitMap.set(ip, requests);
  return false;
}

// Normalize OpenWeatherMap response to match WeatherAPI shape
function normalizeOWMResponse(owm, forecastData) {
  const localTime = new Date((owm.dt + owm.timezone) * 1000);
  const hour = localTime.getUTCHours();
  const isDay = hour >= 6 && hour <= 18;

  // Map OWM condition codes to text descriptions
  const conditionText = owm.weather?.[0]?.description || 'Unknown';
  const conditionMain = owm.weather?.[0]?.main || 'Clouds';

  // Build 3-day forecast from the 5-day/3-hour forecast data
  const forecastDays = [];
  if (forecastData?.list) {
    const dayMap = {};
    for (const item of forecastData.list) {
      const date = new Date(item.dt * 1000).toISOString().split('T')[0];
      if (!dayMap[date]) dayMap[date] = [];
      dayMap[date].push(item);
    }

    const dates = Object.keys(dayMap).slice(0, 3);
    for (const date of dates) {
      const items = dayMap[date];
      const temps = items.map(i => i.main.temp);
      const winds = items.map(i => i.wind.speed);
      const humidities = items.map(i => i.main.humidity);
      // Pick the most common weather condition
      const conditions = items.map(i => i.weather[0]);
      const mainCondition = conditions[Math.floor(conditions.length / 2)];

      forecastDays.push({
        date,
        date_epoch: Math.floor(new Date(date).getTime() / 1000),
        day: {
          maxtemp_c: Math.round(Math.max(...temps)),
          maxtemp_f: Math.round(Math.max(...temps) * 9/5 + 32),
          mintemp_c: Math.round(Math.min(...temps)),
          mintemp_f: Math.round(Math.min(...temps) * 9/5 + 32),
          avgtemp_c: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length),
          avgtemp_f: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 9/5 + 32),
          maxwind_mph: Math.round(Math.max(...winds) * 2.237),
          maxwind_kph: Math.round(Math.max(...winds) * 3.6),
          avghumidity: Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length),
          condition: {
            text: mainCondition?.description || conditionText,
            code: mainCondition?.id || 800,
          },
          daily_will_it_rain: items.some(i => i.rain) ? 1 : 0,
          daily_chance_of_rain: items.some(i => i.rain) ? 60 : 10,
          daily_will_it_snow: items.some(i => i.snow) ? 1 : 0,
          daily_chance_of_snow: items.some(i => i.snow) ? 60 : 0,
          uv: 5,
        }
      });
    }
  }

  const windDegree = owm.wind?.deg || 0;
  const windDirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const windDir = windDirs[Math.round(windDegree / 22.5) % 16];

  return {
    location: {
      name: owm.name || 'Unknown',
      region: owm.sys?.country || '',
      country: owm.sys?.country || '',
      lat: owm.coord?.lat || 0,
      lon: owm.coord?.lon || 0,
      tz_id: '',
      localtime_epoch: owm.dt,
      localtime: localTime.toISOString().slice(0, 16),
    },
    current: {
      last_updated_epoch: owm.dt,
      last_updated: new Date(owm.dt * 1000).toISOString().slice(0, 16),
      temp_c: Math.round(owm.main?.temp || 0),
      temp_f: Math.round((owm.main?.temp || 0) * 9/5 + 32),
      is_day: isDay ? 1 : 0,
      condition: {
        text: conditionText.charAt(0).toUpperCase() + conditionText.slice(1),
        code: owm.weather?.[0]?.id || 800,
      },
      wind_mph: Math.round((owm.wind?.speed || 0) * 2.237),
      wind_kph: Math.round((owm.wind?.speed || 0) * 3.6),
      wind_degree: windDegree,
      wind_dir: windDir,
      pressure_mb: owm.main?.pressure || 1013,
      humidity: owm.main?.humidity || 50,
      cloud: owm.clouds?.all || 0,
      feelslike_c: Math.round(owm.main?.feels_like || owm.main?.temp || 0),
      feelslike_f: Math.round(((owm.main?.feels_like || owm.main?.temp || 0) * 9/5 + 32)),
      vis_km: Math.round((owm.visibility || 10000) / 1000),
      vis_miles: Math.round((owm.visibility || 10000) / 1609),
      uv: 5,
    },
    forecast: {
      forecastday: forecastDays,
    },
    source: 'openweathermap',
    cached: false,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { location } = req.query;
  if (!location) return res.status(400).json({ error: 'Location parameter is required' });

  const clientIP = getClientIP(req);
  if (isRateLimited(clientIP)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Check cache
  const cacheKey = `owm:${location.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return res.json({ ...cached.data, cached: true, cacheAge: Math.round((Date.now() - cached.timestamp) / 1000) });
  }

  const API_KEY = process.env.OPENWEATHERMAP_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'OpenWeatherMap API key not configured' });
  }

  try {
    // Determine if location is coords or city name
    const isCoords = /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location.trim());
    let weatherUrl, forecastUrl;

    if (isCoords) {
      const [lat, lon] = location.split(',');
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
      forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
    } else {
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=metric&appid=${API_KEY}`;
      forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&units=metric&appid=${API_KEY}`;
    }

    const [weatherRes, forecastRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(forecastUrl),
    ]);

    if (!weatherRes.ok) {
      const err = await weatherRes.json().catch(() => ({}));
      return res.status(weatherRes.status).json({ error: err.message || 'Weather API error' });
    }

    const [weatherJson, forecastJson] = await Promise.all([
      weatherRes.json(),
      forecastRes.ok ? forecastRes.json() : null,
    ]);

    const normalized = normalizeOWMResponse(weatherJson, forecastJson);

    // Cache it
    cache.set(cacheKey, { data: normalized, timestamp: Date.now() });
    if (cache.size > 100) cache.delete(cache.keys().next().value);

    res.json(normalized);
  } catch (error) {
    console.error('OpenWeatherMap error:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
}
