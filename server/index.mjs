import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const app = express();
const bootedAt = new Date().toISOString();
const version = process.env.RAILWAY_GIT_COMMIT_SHA
  || process.env.SOURCE_VERSION
  || process.env.RAILWAY_DEPLOYMENT_ID
  || 'local-dev';

const rooms = new Map();
const cache = new Map();
let nominatimQueue = Promise.resolve();
let nominatimLastRequestAt = 0;
const APP_USER_AGENT = 'WaypointTeslaBrowser/2.0 (+https://github.com/udiram/waypoint)';
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'User-Agent': APP_USER_AGENT,
};

const OSM_CATEGORIES = {
  charging: ['charging_station'],
  camps: ['camp_site', 'caravan_site'],
  food: ['restaurant', 'fast_food', 'cafe'],
  sights: ['viewpoint', 'museum', 'attraction', 'artwork'],
};

const WEATHER_CODE_LABELS = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm and hail',
  99: 'Severe thunderstorm and hail',
};

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureRoom(roomCode) {
  const normalized = roomCode.trim().toUpperCase();
  if (!rooms.has(normalized)) {
    rooms.set(normalized, {
      roomCode: normalized,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      decision: null,
      members: new Map(),
    });
  }
  return rooms.get(normalized);
}

function serializeRoom(room) {
  return {
    roomCode: room.roomCode,
    decision: room.decision,
    updatedAt: room.updatedAt,
    members: [...room.members.values()]
      .sort((left, right) => left.joinedAt - right.joinedAt)
      .map((member) => ({
        id: member.id,
        name: member.name,
        color: member.color,
        charge: member.charge,
        eta: member.eta,
        location: member.location,
        status: member.status,
        joinedAt: member.joinedAt,
        updatedAt: member.updatedAt,
      })),
  };
}

function broadcastRoom(room) {
  const payload = JSON.stringify({
    type: 'snapshot',
    room: serializeRoom(room),
  });
  for (const member of room.members.values()) {
    if (member.socket.readyState === member.socket.OPEN) {
      member.socket.send(payload);
    }
  }
}

function cleanupRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.members.size === 0) {
    rooms.delete(roomCode);
  }
}

function roundCoordinate(value, precision = 3) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function parseCoordinate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

function shortPlaceLabel(label) {
  if (!label) return 'Unknown place';
  return label.split(',').slice(0, 2).join(',').trim();
}

function weatherLabel(code) {
  return WEATHER_CODE_LABELS[code] || 'Conditions changing';
}

function haversineMiles(a, b) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.7613;
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const arc = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(arc));
}

function sampleRoutePoints(coordinates, fractions) {
  if (!coordinates?.length) return [];
  return fractions.map((fraction) => {
    const index = Math.min(
      coordinates.length - 1,
      Math.max(0, Math.round(fraction * (coordinates.length - 1))),
    );
    const [longitude, latitude] = coordinates[index];
    return { latitude, longitude, fraction };
  });
}

function classifyOsmElement(tags = {}) {
  if (tags.amenity === 'charging_station') return 'charging';
  if (tags.tourism === 'camp_site' || tags.tourism === 'caravan_site') return 'camps';
  if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food' || tags.amenity === 'cafe') return 'food';
  if (tags.tourism === 'viewpoint' || tags.tourism === 'museum' || tags.tourism === 'attraction' || tags.tourism === 'artwork') {
    return 'sights';
  }
  return null;
}

function fallbackPlaceName(category, tags = {}) {
  if (tags.operator) return tags.operator;
  if (tags.brand) return tags.brand;
  if (tags.network) return tags.network;
  const labels = {
    charging: 'Charging stop',
    camps: 'Camp stop',
    food: 'Food stop',
    sights: 'Scenic stop',
  };
  return labels[category] || 'Route stop';
}

function createEmptyPoiGroups() {
  return {
    charging: [],
    camps: [],
    food: [],
    sights: [],
  };
}

function dedupePois(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    const key = `${item.category}:${item.name}:${roundCoordinate(item.latitude, 4)}:${roundCoordinate(item.longitude, 4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function formatClock(value, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value));
}

function stripHtml(value = '') {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function clamp(value, lower, upper) {
  return Math.min(upper, Math.max(lower, value));
}

async function fetchJson(url, { headers = {}, timeoutMs = 14000, method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...DEFAULT_HEADERS,
        ...headers,
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchCachedJson(key, ttlMs, url, options) {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }
  const value = await fetchJson(url, options);
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
}

async function fetchNominatimJson(key, ttlMs, url) {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;

  const request = nominatimQueue.then(async () => {
    const waitMs = Math.max(0, 1100 - (Date.now() - nominatimLastRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    nominatimLastRequestAt = Date.now();
    return fetchJson(url);
  });
  nominatimQueue = request.catch(() => undefined);
  const value = await request;
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function reverseGeocode(latitude, longitude) {
  const lat = roundCoordinate(latitude, 4);
  const lon = roundCoordinate(longitude, 4);
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&lat=${lat}&lon=${lon}`;
  const data = await fetchNominatimJson(`reverse:${lat}:${lon}`, 6 * 60 * 60 * 1000, url);
  return {
    latitude,
    longitude,
    label: data.display_name || `${lat}, ${lon}`,
    shortLabel: shortPlaceLabel(data.display_name),
  };
}

async function searchPlaces(query, limit = 5) {
  const normalized = query.trim();
  const safeLimit = Math.min(6, Math.max(1, limit));
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&dedupe=1&limit=${safeLimit}&q=${encodeURIComponent(normalized)}`;
  const data = await fetchNominatimJson(`search:${safeLimit}:${normalized.toLowerCase()}`, 24 * 60 * 60 * 1000, url);
  return data.map((place) => ({
    latitude: Number(place.lat),
    longitude: Number(place.lon),
    label: place.display_name,
    shortLabel: shortPlaceLabel(place.display_name),
    type: place.type || place.category || 'place',
  }));
}

async function geocodePlace(query) {
  const places = await searchPlaces(query, 1);
  return places[0] || null;
}

async function fetchForecast(latitude, longitude) {
  const lat = roundCoordinate(latitude, 3);
  const lon = roundCoordinate(longitude, 3);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_gusts_10m,apparent_temperature,weather_code,precipitation_probability&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation_probability,weather_code&daily=temperature_2m_min,temperature_2m_max,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=2&timezone=auto`;
  return fetchCachedJson(`forecast:${lat}:${lon}`, 15 * 60 * 1000, url);
}

function findNearestHourlySnapshot(hourly, targetTime) {
  const target = targetTime.getTime();
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (let index = 0; index < hourly.time.length; index += 1) {
    const sampleTime = new Date(hourly.time[index]).getTime();
    const delta = Math.abs(sampleTime - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }

  return {
    time: hourly.time[bestIndex],
    temperature: hourly.temperature_2m[bestIndex],
    wind: hourly.wind_speed_10m[bestIndex],
    gust: hourly.wind_gusts_10m[bestIndex],
    precipitationProbability: hourly.precipitation_probability[bestIndex],
    weatherCode: hourly.weather_code[bestIndex],
  };
}

function buildOvernightForecast(forecast) {
  const now = Date.now();
  const timezone = forecast.timezone || 'UTC';
  const sunriseTimes = (forecast.daily?.sunrise || []).map((value) => new Date(value).getTime());
  const nextSunrise = sunriseTimes.find((value) => value > now) || sunriseTimes[0] || now;
  const items = [];

  for (let index = 0; index < forecast.hourly.time.length; index += 1) {
    const stamp = new Date(forecast.hourly.time[index]).getTime();
    if (stamp < now) continue;
    if (stamp > nextSunrise) break;
    items.push({
      time: forecast.hourly.time[index],
      label: formatClock(forecast.hourly.time[index], timezone),
      temperature: forecast.hourly.temperature_2m[index],
      wind: forecast.hourly.wind_speed_10m[index],
      gust: forecast.hourly.wind_gusts_10m[index],
      precipitationProbability: forecast.hourly.precipitation_probability[index],
      weatherCode: forecast.hourly.weather_code[index],
    });
    if (items.length >= 12) break;
  }

  const lowTemperature = items.length
    ? Math.min(...items.map((item) => item.temperature))
    : forecast.daily?.temperature_2m_min?.[0] ?? null;

  return {
    hourly: items,
    lowTemperature,
    startTemperature: items[0]?.temperature ?? forecast.current?.temperature_2m ?? null,
    sunrise: new Date(nextSunrise).toISOString(),
    sunriseLabel: formatClock(nextSunrise, timezone),
    sunset: forecast.daily?.sunset?.[0] || null,
    sunsetLabel: forecast.daily?.sunset?.[0] ? formatClock(forecast.daily.sunset[0], timezone) : null,
  };
}

function overpassQuery(points) {
  const blocks = points.flatMap((point) => {
    const lat = point.latitude.toFixed(5);
    const lon = point.longitude.toFixed(5);
    return [
      `node(around:12000,${lat},${lon})[amenity=charging_station];`,
      `way(around:12000,${lat},${lon})[amenity=charging_station];`,
      `node(around:16000,${lat},${lon})[tourism=camp_site];`,
      `way(around:16000,${lat},${lon})[tourism=camp_site];`,
      `node(around:16000,${lat},${lon})[tourism=caravan_site];`,
      `way(around:16000,${lat},${lon})[tourism=caravan_site];`,
      `node(around:7000,${lat},${lon})[amenity=restaurant];`,
      `way(around:7000,${lat},${lon})[amenity=restaurant];`,
      `node(around:7000,${lat},${lon})[amenity=fast_food];`,
      `way(around:7000,${lat},${lon})[amenity=fast_food];`,
      `node(around:7000,${lat},${lon})[amenity=cafe];`,
      `way(around:7000,${lat},${lon})[amenity=cafe];`,
      `node(around:9000,${lat},${lon})[tourism=viewpoint];`,
      `way(around:9000,${lat},${lon})[tourism=viewpoint];`,
      `node(around:9000,${lat},${lon})[tourism=museum];`,
      `way(around:9000,${lat},${lon})[tourism=museum];`,
      `node(around:9000,${lat},${lon})[tourism=attraction];`,
      `way(around:9000,${lat},${lon})[tourism=attraction];`,
      `node(around:9000,${lat},${lon})[tourism=artwork];`,
      `way(around:9000,${lat},${lon})[tourism=artwork];`,
    ];
  });

  return `[out:json][timeout:18];(${blocks.join('')});out center 120;`;
}

async function fetchPois(points, anchor) {
  const cacheKey = `pois:${points.map((point) => `${roundCoordinate(point.latitude, 3)},${roundCoordinate(point.longitude, 3)}`).join('|')}`;
  const data = await fetchCachedJson(
    cacheKey,
    30 * 60 * 1000,
    'https://overpass-api.de/api/interpreter',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: overpassQuery(points),
      timeoutMs: 20000,
    },
  );

  const groups = createEmptyPoiGroups();
  for (const element of data.elements || []) {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    const category = classifyOsmElement(element.tags);
    if (!category) continue;
    const point = { latitude, longitude };
    const miles = haversineMiles(anchor, point);
    const item = {
      id: `${element.type}-${element.id}`,
      category,
      name: element.tags?.name || fallbackPlaceName(category, element.tags),
      detail: element.tags?.operator || element.tags?.network || element.tags?.tourism || element.tags?.amenity || '',
      latitude,
      longitude,
      distanceMiles: Number(miles.toFixed(miles > 10 ? 0 : 1)),
    };
    groups[category].push(item);
  }

  for (const category of Object.keys(groups)) {
    groups[category] = dedupePois(groups[category])
      .sort((left, right) => left.distanceMiles - right.distanceMiles)
      .slice(0, 4);
  }

  return groups;
}

async function fetchWikiDetails(pageIds) {
  if (!pageIds.length) return {};
  const ids = pageIds.join('|');
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&pageids=${ids}&inprop=url&exintro=1&explaintext=1`;
  const data = await fetchCachedJson(`wiki-details:${ids}`, 24 * 60 * 60 * 1000, url);
  return data.query?.pages || {};
}

async function fetchLore(points, anchor) {
  const cacheKey = `lore:${points.map((point) => `${roundCoordinate(point.latitude, 3)},${roundCoordinate(point.longitude, 3)}`).join('|')}`;
  const entry = cache.get(cacheKey);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }

  const pages = [];
  const seenPageIds = new Set();

  for (const point of points) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=geosearch&gscoord=${point.latitude}|${point.longitude}&gsradius=10000&gslimit=4`;
    const data = await fetchJson(url);
    for (const page of data.query?.geosearch || []) {
      if (seenPageIds.has(page.pageid)) continue;
      seenPageIds.add(page.pageid);
      pages.push(page);
      if (pages.length >= 8) break;
    }
    if (pages.length >= 8) break;
  }

  const details = await fetchWikiDetails(pages.map((page) => page.pageid));
  const lore = pages.map((page) => {
    const detail = details[page.pageid];
    const point = { latitude: page.lat, longitude: page.lon };
    const miles = haversineMiles(anchor, point);
    return {
      id: String(page.pageid),
      title: page.title,
      summary: stripHtml(detail?.extract || 'A nearby place with a story tied to this route.'),
      url: detail?.fullurl || null,
      latitude: page.lat,
      longitude: page.lon,
      distanceMiles: Number(miles.toFixed(miles > 10 ? 0 : 1)),
    };
  }).filter((item) => item.summary);

  cache.set(cacheKey, {
    value: lore,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return lore;
}

function buildRouteWeatherSamples(route, forecastByPoint) {
  const points = sampleRoutePoints(route.coordinates, [0, 0.33, 0.66, 1]);
  return points.map((point, index) => {
    const etaTime = new Date(Date.now() + route.duration * 1000 * point.fraction);
    const forecast = forecastByPoint[index];
    const hourly = findNearestHourlySnapshot(forecast.hourly, etaTime);
    return {
      label: index === 0 ? 'Now' : index === points.length - 1 ? 'Arrival' : `${Math.round(point.fraction * 100)}%`,
      time: hourly.time,
      etaLabel: formatClock(hourly.time, forecast.timezone || 'UTC'),
      temperature: hourly.temperature,
      wind: hourly.wind,
      gust: hourly.gust,
      precipitationProbability: hourly.precipitationProbability,
      weatherCode: hourly.weatherCode,
      weatherLabel: weatherLabel(hourly.weatherCode),
      latitude: point.latitude,
      longitude: point.longitude,
      fraction: point.fraction,
    };
  });
}

function deriveRouteHazard(primaryWeather, alternativeWeather) {
  const primaryMaxWind = Math.max(...primaryWeather.map((item) => item.wind), 0);
  const alternativeMaxWind = Math.max(...alternativeWeather.map((item) => item.wind), 0);
  const primaryMaxPrecip = Math.max(...primaryWeather.map((item) => item.precipitationProbability ?? 0), 0);
  const alternativeMaxPrecip = Math.max(...alternativeWeather.map((item) => item.precipitationProbability ?? 0), 0);
  const calmerDifference = Math.round(primaryMaxWind - alternativeMaxWind);

  return {
    primaryMaxWind,
    alternativeMaxWind,
    primaryMaxPrecip,
    alternativeMaxPrecip,
    calmerDifference,
    calmerRoute: calmerDifference > 2 ? 'alternative' : 'primary',
  };
}

function deriveQuest(routeLore, nearby) {
  const candidates = [
    ...routeLore.slice(0, 3).map((item) => ({
      label: item.title,
      hint: item.summary,
      distanceMiles: item.distanceMiles,
      source: 'story',
    })),
    ...nearby.sights.slice(0, 2).map((item) => ({
      label: item.name,
      hint: item.detail ? `Look for ${item.detail.toLowerCase()} signage.` : 'Watch for a notable landmark near the route.',
      distanceMiles: item.distanceMiles,
      source: 'sight',
    })),
    ...nearby.food.slice(0, 1).map((item) => ({
      label: item.name,
      hint: 'Spot the stop before the car reaches it.',
      distanceMiles: item.distanceMiles,
      source: 'food',
    })),
  ];

  return candidates
    .sort((left, right) => left.distanceMiles - right.distanceMiles)
    .slice(0, 6)
    .map((item, index) => ({
      id: `${item.source}-${index}`,
      label: item.label,
      hint: item.hint,
      distanceMiles: item.distanceMiles,
      active: index === 0,
      done: false,
    }));
}

function markerFromPoint(point, label, kind) {
  return {
    label,
    kind,
    latitude: point.latitude,
    longitude: point.longitude,
  };
}

async function buildLocationContext(latitude, longitude) {
  const anchor = { latitude, longitude };
  const [origin, forecast, nearby, lore] = await Promise.all([
    reverseGeocode(latitude, longitude),
    fetchForecast(latitude, longitude),
    fetchPois([{ latitude, longitude }], anchor),
    fetchLore([{ latitude, longitude }], anchor),
  ]);

  return {
    origin,
    weather: {
      ...forecast.current,
      label: weatherLabel(forecast.current.weather_code),
    },
    overnight: buildOvernightForecast(forecast),
    nearby,
    lore,
  };
}

async function buildRouteContext(origin, destination) {
  const originKey = `${roundCoordinate(origin.latitude, 3)},${roundCoordinate(origin.longitude, 3)}`;
  const destinationKey = `${roundCoordinate(destination.latitude, 3)},${roundCoordinate(destination.longitude, 3)}`;
  const cacheKey = `route:${originKey}:${destinationKey}`;
  const entry = cache.get(cacheKey);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }

  const routeUrl = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&alternatives=true&steps=true`;
  const routeData = await fetchJson(routeUrl);
  const rawRoutes = (routeData.routes || []).slice(0, 2);
  if (!rawRoutes.length) {
    throw new Error('Route service returned no routes.');
  }

  const routes = rawRoutes.map((route, index) => ({
    id: index === 0 ? 'primary' : 'alternative',
    distance: route.distance,
    duration: route.duration,
    coordinates: route.geometry.coordinates,
    roads: [...new Set((route.legs || []).flatMap((leg) => leg.steps || []).map((step) => step.name).filter(Boolean))].slice(0, 5),
  }));

  const [primary, alternative = routes[0]] = routes;
  const primaryWeatherPoints = sampleRoutePoints(primary.coordinates, [0, 0.33, 0.66, 1]);
  const alternativeWeatherPoints = sampleRoutePoints(alternative.coordinates, [0, 0.33, 0.66, 1]);

  const [primaryForecasts, alternativeForecasts, nearby, lore] = await Promise.all([
    Promise.all(primaryWeatherPoints.map((point) => fetchForecast(point.latitude, point.longitude))),
    Promise.all(alternativeWeatherPoints.map((point) => fetchForecast(point.latitude, point.longitude))),
    fetchPois(sampleRoutePoints(primary.coordinates, [0.18, 0.5, 0.82]), origin),
    fetchLore(sampleRoutePoints(primary.coordinates, [0.24, 0.58, 0.9]), origin),
  ]);

  const primaryWeather = buildRouteWeatherSamples(primary, primaryForecasts);
  const alternativeWeather = buildRouteWeatherSamples(alternative, alternativeForecasts);
  const hazard = deriveRouteHazard(primaryWeather, alternativeWeather);
  const midpointPoi = nearby.sights[0] || nearby.food[0] || nearby.charging[0] || lore[0];
  const midpointPoint = sampleRoutePoints(primary.coordinates, [0.5])[0] || origin;
  const midpointLabel = midpointPoi?.name || midpointPoi?.title || 'Mid-route';

  const response = {
    primary: {
      ...primary,
      markers: [
        markerFromPoint(origin, origin.shortLabel || 'Start', 'start'),
        markerFromPoint(midpointPoi || midpointPoint, midpointLabel, 'midpoint'),
        markerFromPoint(destination, destination.shortLabel || 'Destination', 'destination'),
      ],
    },
    alternative: routes[1] ? {
      ...alternative,
      markers: [
        markerFromPoint(origin, origin.shortLabel || 'Start', 'start'),
        markerFromPoint(sampleRoutePoints(alternative.coordinates, [0.5])[0] || origin, 'Alternate midpoint', 'midpoint'),
        markerFromPoint(destination, destination.shortLabel || 'Destination', 'destination'),
      ],
    } : null,
    primaryWeather,
    alternativeWeather: routes[1] ? alternativeWeather : [],
    nearby,
    lore,
    quest: deriveQuest(lore, nearby),
    hazard,
  };

  cache.set(cacheKey, {
    value: response,
    expiresAt: Date.now() + 15 * 60 * 1000,
  });

  return response;
}

app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'waypoint',
    version,
    bootedAt,
    rooms: rooms.size,
    cacheEntries: cache.size,
    now: new Date().toISOString(),
  });
});

app.get('/api/ready', (_request, response) => {
  response.json({
    ready: true,
    rooms: rooms.size,
    cacheEntries: cache.size,
    now: new Date().toISOString(),
  });
});

app.get('/api/version', (_request, response) => {
  response.json({
    name: 'waypoint-tesla-browser',
    version,
    bootedAt,
  });
});

app.get('/api/geocode/search', async (request, response) => {
  const query = String(request.query.q || '').trim();
  if (query.length < 3) {
    response.json({ ok: true, results: [] });
    return;
  }
  try {
    const results = await searchPlaces(query, 5);
    response.json({ ok: true, results, dataSource: 'OpenStreetMap Nominatim' });
  } catch (error) {
    response.status(502).json({ ok: false, error: error.message });
  }
});

app.get('/api/geocode', async (request, response) => {
  const query = String(request.query.q || '').trim();
  if (query.length < 3) {
    response.status(400).json({ ok: false, error: 'Enter at least three characters.' });
    return;
  }
  try {
    const place = await geocodePlace(query);
    if (!place) {
      response.status(404).json({ ok: false, error: 'No matching place found.' });
      return;
    }
    response.json({ ...place, dataSource: 'OpenStreetMap Nominatim' });
  } catch (error) {
    response.status(502).json({ ok: false, error: error.message });
  }
});

app.get('/api/reverse', async (request, response) => {
  const latitude = parseCoordinate(request.query.lat);
  const longitude = parseCoordinate(request.query.lon);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    response.status(400).json({ ok: false, error: 'Valid latitude and longitude are required.' });
    return;
  }
  try {
    const place = await reverseGeocode(latitude, longitude);
    response.json({ ...place, label: place.shortLabel || place.label, fullLabel: place.label, dataSource: 'OpenStreetMap Nominatim' });
  } catch (error) {
    response.status(502).json({ ok: false, error: error.message });
  }
});

app.get('/api/nearby', async (request, response) => {
  const latitude = parseCoordinate(request.query.lat);
  const longitude = parseCoordinate(request.query.lon);
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    response.status(400).json({ ok: false, error: 'Valid latitude and longitude are required.' });
    return;
  }
  try {
    const anchor = { latitude, longitude };
    const groups = await fetchPois([anchor], anchor);
    const normalize = (item) => ({
      ...item,
      distanceMeters: Math.round(item.distanceMiles * 1609.344),
    });
    response.json({
      campsites: groups.camps.map(normalize),
      chargers: groups.charging.map(normalize),
      updatedAt: new Date().toISOString(),
      dataSource: 'OpenStreetMap Overpass',
    });
  } catch (error) {
    response.status(502).json({ ok: false, error: error.message });
  }
});

app.get('/api/location-context', async (request, response) => {
  const latitude = parseCoordinate(request.query.latitude);
  const longitude = parseCoordinate(request.query.longitude);
  if (latitude === null || longitude === null) {
    response.status(400).json({ ok: false, error: 'latitude and longitude are required' });
    return;
  }

  try {
    const context = await buildLocationContext(latitude, longitude);
    response.json({ ok: true, ...context });
  } catch (error) {
    response.status(502).json({ ok: false, error: error.message });
  }
});

app.get('/api/route-context', async (request, response) => {
  const originLatitude = parseCoordinate(request.query.originLatitude);
  const originLongitude = parseCoordinate(request.query.originLongitude);
  const destinationLatitude = parseCoordinate(request.query.destinationLatitude);
  const destinationLongitude = parseCoordinate(request.query.destinationLongitude);

  if ([originLatitude, originLongitude, destinationLatitude, destinationLongitude].some((value) => value === null)) {
    response.status(400).json({ ok: false, error: 'originLatitude, originLongitude, destinationLatitude, and destinationLongitude are required' });
    return;
  }

  const origin = {
    latitude: originLatitude,
    longitude: originLongitude,
    shortLabel: String(request.query.originLabel || 'Start'),
  };
  const destination = {
    latitude: destinationLatitude,
    longitude: destinationLongitude,
    label: String(request.query.destinationLabel || 'Destination'),
    shortLabel: shortPlaceLabel(String(request.query.destinationLabel || 'Destination')),
  };

  try {
    const context = await buildRouteContext(origin, destination);
    response.json({ ok: true, ...context });
  } catch (error) {
    response.status(502).json({ ok: false, error: error.message });
  }
});

app.get('/api/convoy/:roomCode', (request, response) => {
  const room = ensureRoom(request.params.roomCode);
  response.json({
    ok: true,
    room: serializeRoom(room),
  });
});

app.use(express.static(distDir, { index: false, maxAge: '1h' }));

app.use((request, response) => {
  if (request.path.startsWith('/api/')) {
    response.status(404).json({ ok: false, error: 'Not found' });
    return;
  }
  response.sendFile(path.join(distDir, 'index.html'));
});

const port = Number(process.env.PORT || 8080);
const server = app.listen(port, () => {
  console.log(JSON.stringify({ event: 'server_started', port, version, bootedAt }));
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket) => {
  let memberRef = null;

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload.' }));
      return;
    }

    if (message.type === 'join') {
      const room = ensureRoom(message.roomCode || 'WAYPT');
      const existingMember = message.memberId ? room.members.get(message.memberId) : null;
      const memberId = existingMember?.id || randomId('member');
      const nextMember = {
        id: memberId,
        name: message.profile?.name || 'Vehicle',
        color: message.profile?.color || '#80bfff',
        charge: message.profile?.charge || 'Unset',
        eta: message.profile?.eta || 'Calculating',
        location: message.profile?.location || null,
        status: message.profile?.status || 'Connected',
        joinedAt: existingMember?.joinedAt || Date.now(),
        updatedAt: Date.now(),
        socket,
      };
      room.updatedAt = Date.now();
      room.members.set(memberId, nextMember);
      memberRef = { roomCode: room.roomCode, memberId };
      socket.send(JSON.stringify({ type: 'joined', memberId, roomCode: room.roomCode }));
      broadcastRoom(room);
      return;
    }

    if (!memberRef) {
      socket.send(JSON.stringify({ type: 'error', message: 'Join a room before sending updates.' }));
      return;
    }

    const room = rooms.get(memberRef.roomCode);
    const member = room?.members.get(memberRef.memberId);
    if (!room || !member) {
      socket.send(JSON.stringify({ type: 'error', message: 'Room state expired.' }));
      return;
    }

    room.updatedAt = Date.now();

    if (message.type === 'state') {
      room.members.set(memberRef.memberId, {
        ...member,
        charge: message.payload?.charge || member.charge,
        eta: message.payload?.eta || member.eta,
        location: message.payload?.location || member.location,
        status: message.payload?.status || member.status,
        updatedAt: Date.now(),
        socket,
      });
      broadcastRoom(room);
      return;
    }

    if (message.type === 'decision') {
      room.decision = {
        title: message.payload?.title || 'Group decision',
        detail: message.payload?.detail || 'Decision updated',
        sentAt: Date.now(),
      };
      room.members.set(memberRef.memberId, {
        ...member,
        status: message.payload?.status || 'Shared a plan',
        updatedAt: Date.now(),
        socket,
      });
      broadcastRoom(room);
      return;
    }

    if (message.type === 'ping') {
      socket.send(JSON.stringify({ type: 'pong', at: Date.now() }));
    }
  });

  socket.on('close', () => {
    if (!memberRef) return;
    const room = rooms.get(memberRef.roomCode);
    if (!room) return;
    room.members.delete(memberRef.memberId);
    room.updatedAt = Date.now();
    if (room.members.size > 0) {
      broadcastRoom(room);
    }
    cleanupRoom(memberRef.roomCode);
  });
});

const pruneTimer = setInterval(() => {
  const now = Date.now();
  const roomCutoff = now - 6 * 60 * 60 * 1000;
  const cacheCutoff = now - 24 * 60 * 60 * 1000;

  for (const [roomCode, room] of rooms.entries()) {
    if (room.updatedAt < roomCutoff) {
      rooms.delete(roomCode);
    }
  }

  for (const [key, value] of cache.entries()) {
    if (value.expiresAt < now || value.expiresAt < cacheCutoff) {
      cache.delete(key);
    }
  }
}, 15 * 60 * 1000);

pruneTimer.unref();
