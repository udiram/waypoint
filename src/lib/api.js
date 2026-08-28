import { bearingDegrees, crosswindMph, sampleRoutePoints } from './utils';

async function fetchJson(url, timeoutMs = 18000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Request failed with ${response.status}`);
    return payload;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function reverseGeocode(latitude, longitude) {
  return fetchJson(`/api/reverse?lat=${latitude}&lon=${longitude}`);
}

export function geocodePlace(query) {
  if (!query?.trim()) return Promise.reject(new Error('Enter a place.'));
  return fetchJson(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
}

export async function fetchCurrentWeather(latitude, longitude) {
  const current = [
    'temperature_2m', 'apparent_temperature', 'precipitation', 'rain', 'weather_code',
    'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'is_day',
  ].join(',');
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current,
    temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch', timezone: 'auto' });
  const raw = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  return { ...raw.current, units: raw.current_units, timezone: raw.timezone, updatedAt: new Date().toISOString() };
}

export async function fetchOvernightWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m',
    daily: 'sunrise,sunset', temperature_unit: 'fahrenheit', wind_speed_unit: 'mph',
    timezone: 'auto', timeformat: 'unixtime', forecast_days: '2',
  });
  const raw = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  const start = Math.max(0, raw.hourly.time.findIndex((value) => value >= Date.now() / 1000));
  return {
    hours: raw.hourly.time.slice(start, start + 12).map((time, index) => ({
      time: time * 1000,
      temperature: raw.hourly.temperature_2m[start + index],
      apparentTemperature: raw.hourly.apparent_temperature[start + index],
      precipitationProbability: raw.hourly.precipitation_probability[start + index],
      code: raw.hourly.weather_code[start + index],
      wind: raw.hourly.wind_speed_10m[start + index],
      gust: raw.hourly.wind_gusts_10m[start + index],
    })),
    sunrise: raw.daily?.sunrise?.map((value) => value * 1000).find((value) => value > Date.now()) || null,
    sunset: raw.daily?.sunset?.map((value) => value * 1000).find((value) => value > Date.now()) || null,
    timezone: raw.timezone,
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchRouteBundle(origin, destination) {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const params = new URLSearchParams({ alternatives: 'true', overview: 'full', geometries: 'geojson', steps: 'false' });
  const raw = await fetchJson(`https://router.project-osrm.org/route/v1/driving/${coords}?${params}`, 22000);
  if (raw.code !== 'Ok' || !raw.routes?.length) throw new Error(raw.message || 'No drivable route found.');
  return raw.routes.slice(0, 2).map((route, index) => ({
    id: index === 0 ? 'primary' : `alternative-${index}`,
    distance: route.distance, duration: route.duration, coordinates: route.geometry.coordinates,
  }));
}

export async function fetchWeatherAlongRoute(route) {
  const fractions = [0, 0.45, 1];
  const samples = sampleRoutePoints(route.coordinates, fractions);
  if (!samples.length) return [];
  const params = new URLSearchParams({
    latitude: samples.map((point) => point.latitude).join(','),
    longitude: samples.map((point) => point.longitude).join(','),
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
    temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', timezone: 'GMT', forecast_days: '2',
  });
  const result = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  const results = Array.isArray(result) ? result : [result];
  return samples.map((point, sampleIndex) => {
    const raw = results[sampleIndex];
    const forecastAt = Date.now() + route.duration * fractions[sampleIndex] * 1000;
    const hour = new Date(forecastAt).toISOString().slice(0, 13);
    const hourIndex = Math.max(0, raw.hourly.time.findIndex((value) => value.startsWith(hour)));
    const before = route.coordinates[Math.max(0, point.index - 2)];
    const after = route.coordinates[Math.min(route.coordinates.length - 1, point.index + 2)];
    const roadBearing = bearingDegrees({ longitude: before[0], latitude: before[1] }, { longitude: after[0], latitude: after[1] });
    const wind = raw.hourly.wind_speed_10m[hourIndex];
    const windDirection = raw.hourly.wind_direction_10m[hourIndex];
    return {
      label: ['Start', 'Mid-route', 'Arrival'][sampleIndex], latitude: point.latitude, longitude: point.longitude, forecastAt,
      temperature: raw.hourly.temperature_2m[hourIndex], apparentTemperature: raw.hourly.apparent_temperature[hourIndex],
      precipitationProbability: raw.hourly.precipitation_probability[hourIndex], code: raw.hourly.weather_code[hourIndex],
      wind, gust: raw.hourly.wind_gusts_10m[hourIndex], windDirection, roadBearing,
      crosswind: crosswindMph(wind, windDirection, roadBearing),
    };
  });
}

export async function fetchLore(latitude, longitude) {
  const searchParams = new URLSearchParams({ action: 'query', list: 'geosearch', gscoord: `${latitude}|${longitude}`,
    gsradius: '10000', gslimit: '6', format: 'json', origin: '*' });
  const search = await fetchJson(`https://en.wikipedia.org/w/api.php?${searchParams}`);
  const pages = search.query?.geosearch || [];
  if (!pages.length) return [];
  const detailParams = new URLSearchParams({ action: 'query', pageids: pages.map((page) => page.pageid).join('|'),
    prop: 'extracts|info|pageimages', exintro: '1', explaintext: '1', inprop: 'url', piprop: 'thumbnail',
    pithumbsize: '1000', format: 'json', origin: '*' });
  const details = await fetchJson(`https://en.wikipedia.org/w/api.php?${detailParams}`);
  return pages.map((page) => {
    const detail = details.query?.pages?.[page.pageid] || {};
    return { id: String(page.pageid), title: page.title, distanceMeters: page.dist, latitude: page.lat, longitude: page.lon,
      summary: detail.extract || 'Open the source to learn more about this place.',
      url: detail.fullurl || `https://en.wikipedia.org/?curid=${page.pageid}`, thumbnail: detail.thumbnail?.source || null };
  });
}

export function fetchNearbyPlaces(latitude, longitude, radius = 25000) {
  return fetchJson(`/api/nearby?lat=${latitude}&lon=${longitude}&radius=${radius}`, 22000);
}
