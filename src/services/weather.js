// ============================================================
// WARDA — Weather & Orientation Service
// Uses WeatherAPI.com (free tier: 10,000 calls/month)
// ============================================================

const WEATHER_API_KEY = process.env.WEATHERAPI_KEY || '';

// ─── Weather Cache (reduce API calls) ───────────────────────
let weatherCache = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// ─── Fetch Weather Data ─────────────────────────────────────
async function getWeather(location = 'Edinburgh') {
  if (weatherCache[location] && (Date.now() - weatherCache[location].fetchedAt < CACHE_DURATION)) {
    return weatherCache[location].data;
  }

  if (!WEATHER_API_KEY) {
    return getDefaultWeather(location);
  }

  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(location)}&aqi=no`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Weather API error: ${response.status}`);
      return getDefaultWeather(location);
    }

    const data = await response.json();

    const weather = {
      temperature: Math.round(data.current.temp_c),
      feelsLike: Math.round(data.current.feelslike_c),
      description: data.current.condition.text,
      icon: data.current.condition.icon,
      humidity: data.current.humidity,
      windSpeed: Math.round(data.current.wind_mph),
      location: data.location.name,
      country: data.location.country,
      localTime: data.location.localtime,
      isDay: data.current.is_day === 1,
      friendlyDescription: getFriendlyWeather(data.current)
    };

    weatherCache[location] = { data: weather, fetchedAt: Date.now() };
    return weather;

  } catch (error) {
    console.error('Weather fetch error:', error.message);
    return getDefaultWeather(location);
  }
}

// ─── Friendly Weather Description (for elderly) ─────────────
function getFriendlyWeather(current) {
  const temp = Math.round(current.temp_c);
  let friendly = '';

  if (temp <= 0) friendly = "It's very cold outside today — best to stay warm indoors.";
  else if (temp <= 5) friendly = "It's quite chilly out there today.";
  else if (temp <= 10) friendly = "It's a cool day outside.";
  else if (temp <= 15) friendly = "It's a mild day — not too cold, not too warm.";
  else if (temp <= 20) friendly = "It's a lovely day — nice and comfortable.";
  else if (temp <= 25) friendly = "It's a warm day — perfect for sitting by a window.";
  else friendly = "It's a hot day today — make sure you drink plenty of water.";

  const condition = current.condition.text.toLowerCase();
  if (condition.includes('rain') || condition.includes('drizzle')) friendly += " There's a bit of rain.";
  else if (condition.includes('snow')) friendly += " There's snow falling!";
  else if (condition.includes('cloud') || condition.includes('overcast')) friendly += " It's a bit cloudy.";
  else if (condition.includes('clear') || condition.includes('sunny')) friendly += " The sky is lovely and clear.";
  else if (condition.includes('thunder')) friendly += " There's a storm outside, but you're safe and warm in here.";
  else if (condition.includes('mist') || condition.includes('fog')) friendly += " It's a bit misty out there.";

  return friendly;
}

// ─── Default Weather (when no API key) ──────────────────────
function getDefaultWeather(location) {
  const season = getSeason();
  const defaults = {
    winter: { temperature: 4, description: 'Cloudy', friendlyDescription: "It's a typical winter day — chilly outside." },
    spring: { temperature: 12, description: 'Partly cloudy', friendlyDescription: "It's a nice spring day — the days are getting longer." },
    summer: { temperature: 18, description: 'Clear', friendlyDescription: "It's a lovely summer day — nice and warm." },
    autumn: { temperature: 10, description: 'Light rain', friendlyDescription: "It's an autumn day — the leaves are changing colour." }
  };

  const d = defaults[season] || defaults.winter;
  return { ...d, feelsLike: d.temperature - 2, icon: '', humidity: 70, windSpeed: 10, location: location.split(',')[0], country: 'GB' };
}

function getSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

// ─── Full Orientation Data ──────────────────────────────────
async function getOrientationData(careHomeLocation = 'Edinburgh') {
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
    season,
    seasonEmoji: seasonEmojis[season],
    weather,
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

function clearWeatherCache() { weatherCache = {}; }

module.exports = { getWeather, getOrientationData, getSeason, clearWeatherCache };
