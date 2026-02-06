// ============================================================
// WARDA — Weather & Orientation Service
// Provides time, date, weather, season for ambient display
// Uses OpenWeatherMap API (free tier: 1000 calls/day)
// ============================================================

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || '';

// ─── Weather Cache (reduce API calls) ───────────────────────
let weatherCache = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// ─── Fetch Weather Data ─────────────────────────────────────
async function getWeather(location = 'Edinburgh,GB') {
  // Check cache first
  if (weatherCache[location] && (Date.now() - weatherCache[location].fetchedAt < CACHE_DURATION)) {
    return weatherCache[location].data;
  }

  if (!OPENWEATHER_API_KEY) {
    // Return sensible defaults if no API key configured
    return getDefaultWeather(location);
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Weather API error: ${response.status}`);
      return getDefaultWeather(location);
    }

    const data = await response.json();
    
    const weather = {
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      description: data.weather[0]?.description || 'clear',
      icon: data.weather[0]?.icon || '01d',
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind?.speed || 0),
      location: data.name,
      country: data.sys?.country || 'GB',
      sunrise: new Date(data.sys?.sunrise * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      sunset: new Date(data.sys?.sunset * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      friendlyDescription: getFriendlyWeather(data)
    };

    // Cache it
    weatherCache[location] = { data: weather, fetchedAt: Date.now() };
    return weather;

  } catch (error) {
    console.error('Weather fetch error:', error.message);
    return getDefaultWeather(location);
  }
}

// ─── Friendly Weather Description (for elderly) ─────────────
function getFriendlyWeather(data) {
  const temp = Math.round(data.main.temp);
  const desc = data.weather[0]?.main || 'Clear';
  
  let friendly = '';
  
  // Temperature description
  if (temp <= 0) friendly = "It's very cold outside today — best to stay warm indoors.";
  else if (temp <= 5) friendly = "It's quite chilly out there today.";
  else if (temp <= 10) friendly = "It's a cool day outside.";
  else if (temp <= 15) friendly = "It's a mild day — not too cold, not too warm.";
  else if (temp <= 20) friendly = "It's a lovely day — nice and comfortable.";
  else if (temp <= 25) friendly = "It's a warm day — perfect for sitting by a window.";
  else friendly = "It's a hot day today — make sure you drink plenty of water.";

  // Weather condition
  if (desc === 'Rain' || desc === 'Drizzle') friendly += " There's a bit of rain.";
  else if (desc === 'Snow') friendly += " There's snow falling!";
  else if (desc === 'Clouds') friendly += " It's a bit cloudy.";
  else if (desc === 'Clear') friendly += " The sky is lovely and clear.";
  else if (desc === 'Thunderstorm') friendly += " There's a storm outside, but you're safe and warm in here.";
  else if (desc === 'Mist' || desc === 'Fog') friendly += " It's a bit misty out there.";

  return friendly;
}

// ─── Default Weather (when no API key) ──────────────────────
function getDefaultWeather(location) {
  const season = getSeason();
  const defaults = {
    winter: { temperature: 4, description: 'cloudy', friendlyDescription: "It's a typical winter day — chilly outside." },
    spring: { temperature: 12, description: 'partly cloudy', friendlyDescription: "It's a nice spring day — the days are getting longer." },
    summer: { temperature: 18, description: 'clear sky', friendlyDescription: "It's a lovely summer day — nice and warm." },
    autumn: { temperature: 10, description: 'light rain', friendlyDescription: "It's an autumn day — the leaves are changing colour." }
  };

  const d = defaults[season] || defaults.winter;
  return {
    ...d,
    feelsLike: d.temperature - 2,
    icon: '03d',
    humidity: 70,
    windSpeed: 10,
    location: location.split(',')[0],
    country: 'GB',
    sunrise: '07:30',
    sunset: '16:30'
  };
}

function getSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

// ─── Full Orientation Data ──────────────────────────────────
// Everything the tablet needs for the ambient display
async function getOrientationData(careHomeLocation = 'Edinburgh,GB') {
  const now = new Date();
  const weather = await getWeather(careHomeLocation);
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  
  const season = getSeason();
  const seasonEmojis = { spring: '🌸', summer: '☀️', autumn: '🍂', winter: '❄️' };
  
  return {
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    day: dayNames[now.getDay()],
    date: now.getDate(),
    month: monthNames[now.getMonth()],
    year: now.getFullYear(),
    fullDate: `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`,
    season: season,
    seasonEmoji: seasonEmojis[season],
    weather: weather,
    greeting: getTimeGreeting(now.getHours()),
    isNight: now.getHours() >= 22 || now.getHours() < 6
  };
}

function getTimeGreeting(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

// ─── Clear Weather Cache ────────────────────────────────────
function clearWeatherCache() {
  weatherCache = {};
}

module.exports = {
  getWeather,
  getOrientationData,
  getSeason,
  clearWeatherCache
};
