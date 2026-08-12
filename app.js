// State
const state = {
  units: { temp: 'celsius', wind: 'kmh', precip: 'mm' },
  location: null,
  weather: null,
  selectedDay: 0,
  suggestions: []
};

// Helpers
const $ = id => document.getElementById(id);

// Map WMO codes → official icons
function getIcon(code) {
  if (code === 0) return 'assets/images/icon-sunny.webp';
  if (code === 1 || code === 2) return 'assets/images/icon-partly-cloudy.webp';
  if (code === 3) return 'assets/images/icon-overcast.webp';
  if (code === 45 || code === 48) return 'assets/images/icon-fog.webp';
  if (code >= 51 && code <= 57) return 'assets/images/icon-drizzle.webp';
  if (code >= 61 && code <= 67) return 'assets/images/icon-rain.webp';
  if (code >= 71 && code <= 77) return 'assets/images/icon-snow.webp';
  if (code >= 80 && code <= 82) return 'assets/images/icon-rain.webp';
  if (code >= 85 && code <= 86) return 'assets/images/icon-snow.webp';
  if (code >= 95) return 'assets/images/icon-rain.webp'; // thunderstorm → rain icon as fallback
  return 'assets/images/icon-overcast.webp';
}

function formatTemp(c) {
  return state.units.temp === 'fahrenheit'
    ? Math.round(c * 9/5 + 32) + '°'
    : Math.round(c) + '°';
}

function formatWind(kmh) {
  return state.units.wind === 'mph'
    ? Math.round(kmh * 0.621371) + ' mph'
    : Math.round(kmh) + ' km/h';
}

function formatPrecip(mm) {
  return state.units.precip === 'inch'
    ? (mm / 25.4).toFixed(2) + ' in'
    : mm.toFixed(1) + ' mm';
}

// API
async function searchPlaces(query) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en`);
  const data = await res.json();
  return data.results || [];
}

async function getWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation',
    hourly: 'temperature_2m,weather_code,precipitation',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'auto',
    forecast_days: 7
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  return res.json();
}

// UI helpers
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function showLoading() {
  show($('loading'));
  hide($('error'));
  hide($('content'));
}

function showError(msg) {
  hide($('loading'));
  hide($('content'));
  show($('error'));
  $('errorMsg').textContent = msg;
}

function showContent() {
  hide($('loading'));
  hide($('error'));
  show($('content'));
}

// Render functions
function renderCurrent() {
  const { current } = state.weather;
  const loc = state.location;

  $('location').textContent = loc.country ? `${loc.name}, ${loc.country}` : loc.name;
  $('date').textContent = new Date(current.time).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  });
  $('icon').src = getIcon(current.weather_code);
  $('temp').textContent = formatTemp(current.temperature_2m);
  $('feelsLike').textContent = formatTemp(current.apparent_temperature);
  $('humidity').textContent = Math.round(current.relative_humidity_2m) + '%';
  $('wind').textContent = formatWind(current.wind_speed_10m);
  $('precip').textContent = formatPrecip(current.precipitation);
}

function renderDaily() {
  const container = $('daily');
  container.innerHTML = '';
  const { daily } = state.weather;

  daily.time.forEach((t, i) => {
    const day = new Date(t).toLocaleDateString('en-US', { weekday: 'short' });
    const card = document.createElement('div');
    card.className = 'bg-neutral-800 rounded-xl p-3 text-center';
    card.innerHTML = `
      <p class="text-sm text-neutral-300 mb-2">${day}</p>
      <img src="${getIcon(daily.weather_code[i])}" alt="" class="w-10 h-10 mx-auto mb-2">
      <p class="text-sm font-medium">${formatTemp(daily.temperature_2m_max[i])} <span class="text-neutral-300">${formatTemp(daily.temperature_2m_min[i])}</span></p>
    `;
    container.appendChild(card);
  });
}

function renderDayMenu() {
  const menu = $('dayMenu');
  menu.innerHTML = '';
  const { daily } = state.weather;

  daily.time.forEach((t, i) => {
    const label = new Date(t).toLocaleDateString('en-US', { weekday: 'long' });
    const li = document.createElement('li');
    li.className = `px-4 py-2.5 text-sm cursor-pointer hover:bg-neutral-600 ${i === state.selectedDay ? 'bg-blue-500/30' : ''}`;
    li.textContent = label;
    li.onclick = () => {
      state.selectedDay = i;
      $('dayLabel').textContent = label;
      hide(menu);
      renderHourly();
    };
    menu.appendChild(li);
  });

  $('dayLabel').textContent = new Date(daily.time[state.selectedDay]).toLocaleDateString('en-US', { weekday: 'long' });
}

function renderHourly() {
  const container = $('hourly');
  container.innerHTML = '';
  const { hourly, daily } = state.weather;
  const dayStr = daily.time[state.selectedDay];
  const now = new Date();
  const isToday = dayStr === now.toISOString().slice(0, 10);

  hourly.time.forEach((t, i) => {
    if (!t.startsWith(dayStr)) return;
    const date = new Date(t);
    if (isToday && date < now) return;

    const row = document.createElement('div');
    row.className = 'flex items-center justify-between bg-neutral-700/60 rounded-xl px-4 py-3';
    row.innerHTML = `
      <div class="flex items-center gap-3">
        <img src="${getIcon(hourly.weather_code[i])}" alt="" class="w-8 h-8">
        <span class="text-sm">${date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}</span>
      </div>
      <span class="font-medium">${formatTemp(hourly.temperature_2m[i])}</span>
    `;
    container.appendChild(row);
  });

  if (!container.children.length) {
    container.innerHTML = '<p class="text-neutral-400 text-sm text-center py-6">No hourly data</p>';
  }
}

function render() {
  renderCurrent();
  renderDaily();
  renderDayMenu();
  renderHourly();
  showContent();
}

// Main actions
async function loadWeather(lat, lon, name, country) {
  showLoading();
  try {
    state.location = { name, country, lat, lon };
    state.weather = await getWeather(lat, lon);
    state.selectedDay = 0;
    render();
  } catch (err) {
    console.error(err);
    showError('Could not load weather. Please try again.');
  }
}

async function doSearch(query) {
  if (!query.trim()) return;
  showLoading();
  hide($('suggestions'));
  try {
    const results = await searchPlaces(query);
    if (!results.length) {
      showError(`No results for "${query}"`);
      return;
    }
    const place = results[0];
    await loadWeather(place.latitude, place.longitude, place.name, place.country || place.admin1 || '');
  } catch {
    showError('Search failed. Check your connection.');
  }
}

// Events
$('searchBtn').onclick = () => doSearch($('searchInput').value);
$('searchInput').onkeydown = e => { if (e.key === 'Enter') doSearch($('searchInput').value); };

let timer;
$('searchInput').oninput = () => {
  clearTimeout(timer);
  const q = $('searchInput').value.trim();
  if (q.length < 2) {
    hide($('suggestions'));
    return;
  }
  timer = setTimeout(async () => {
    try {
      const results = await searchPlaces(q);
      state.suggestions = results;
      if (!results.length) {
        hide($('suggestions'));
        return;
      }
      $('suggestions').innerHTML = results.map((r, i) => `
        <li class="px-4 py-3 hover:bg-neutral-700 cursor-pointer text-sm border-b border-neutral-700 last:border-0" data-i="${i}">
          ${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country ? ', ' + r.country : ''}
        </li>
      `).join('');
      show($('suggestions'));
    } catch {
      hide($('suggestions'));
    }
  }, 300);
};

$('suggestions').onclick = e => {
  const li = e.target.closest('li');
  if (!li) return;
  const place = state.suggestions[+li.dataset.i];
  $('searchInput').value = place.name;
  hide($('suggestions'));
  loadWeather(place.latitude, place.longitude, place.name, place.country || place.admin1 || '');
};

// Units
$('unitsBtn').onclick = e => {
  e.stopPropagation();
  $('unitsMenu').classList.toggle('hidden');
  hide($('dayMenu'));
};

document.querySelectorAll('.unit-btn').forEach(btn => {
  btn.onclick = () => {
    const type = btn.dataset.unit;
    const value = btn.dataset.value;
    state.units[type] = value;

    document.querySelectorAll(`.unit-btn[data-unit="${type}"]`).forEach(b => {
      b.classList.remove('bg-blue-500', 'text-white');
      b.classList.add('bg-neutral-700', 'hover:bg-neutral-600');
    });
    btn.classList.remove('bg-neutral-700', 'hover:bg-neutral-600');
    btn.classList.add('bg-blue-500', 'text-white');

    if (state.weather) render();
  };
});

// Day selector
$('dayBtn').onclick = e => {
  e.stopPropagation();
  $('dayMenu').classList.toggle('hidden');
  hide($('unitsMenu'));
};

// Close menus
document.onclick = () => {
  hide($('unitsMenu'));
  hide($('dayMenu'));
  hide($('suggestions'));
};

$('retryBtn').onclick = () => {
  if (state.location) {
    loadWeather(state.location.lat, state.location.lon, state.location.name, state.location.country);
  } else {
    doSearch('Berlin');
  }
};

// Start with Berlin
loadWeather(52.52, 13.41, 'Berlin', 'Germany');