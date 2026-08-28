import { DEFAULT_DESTINATION, DEFAULT_ORIGIN, sampleRoutePoints } from './utils';

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function reverseGeocode(latitude, longitude) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10`;
  const data = await fetchJson(url);
  return data.display_name || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

export async function geocodePlace(query) {
  if (!query?.trim()) return DEFAULT_DESTINATION;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const results = await fetchJson(url);
  if (!results.length) return DEFAULT_DESTINATION;
  const first = results[0];
  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    label: first.display_name,
  };
}

export async function fetchCurrentWeather(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,apparent_temperature,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=2&timezone=auto`;
  const data = await fetchJson(url);
  return data.current;
}

export async function fetchOvernightWeather(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=2&timezone=auto`;
  const data = await fetchJson(url);
  return data.hourly.time.slice(0, 10).map((time, index) => ({
    time,
    temperature: data.hourly.temperature_2m[index],
    wind: data.hourly.wind_speed_10m[index],
  }));
}

export async function fetchRouteBundle(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&alternatives=true&steps=true`;
  const data = await fetchJson(url);
  const routes = (data.routes || []).slice(0, 2);
  if (!routes.length) {
    throw new Error('Route service returned no routes.');
  }
  return routes.map((route, index) => ({
    id: index === 0 ? 'primary' : `alt-${index}`,
    distance: route.distance,
    duration: route.duration,
    coordinates: route.geometry.coordinates,
  }));
}

export async function fetchWeatherAlongRoute(route) {
  const points = sampleRoutePoints(route.coordinates, [0, 0.45, 1]);
  const snapshots = await Promise.all(
    points.map((point) => fetchCurrentWeather(point.latitude, point.longitude)),
  );
  return snapshots.map((snapshot, index) => ({
    label: index === 0 ? 'Start' : index === 1 ? 'Midpoint' : 'Arrival',
    temperature: snapshot.temperature_2m,
    wind: snapshot.wind_speed_10m,
    apparentTemperature: snapshot.apparent_temperature,
    weatherCode: snapshot.weather_code,
  }));
}

export async function fetchLore(latitude, longitude) {
  const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=geosearch&gscoord=${latitude}|${longitude}&gsradius=10000&gslimit=4`;
  const geoData = await fetchJson(geoUrl);
  const pages = geoData.query?.geosearch || [];
  if (!pages.length) {
    return [];
  }
  const ids = pages.map((page) => page.pageid).join('|');
  const detailsUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts|info&pageids=${ids}&inprop=url&exintro=1&explaintext=1`;
  const detailData = await fetchJson(detailsUrl);
  const pageMap = detailData.query?.pages || {};
  return pages.map((page, index) => {
    const details = pageMap[page.pageid];
    return {
      id: String(page.pageid),
      title: page.title,
      distanceMiles: page.dist ? (page.dist / 1609.344).toFixed(page.dist > 16093 ? 0 : 1) : `${index * 8 + 2}`,
      summary: details?.extract || 'A nearby stop with a story worth hearing on the road.',
      url: details?.fullurl || null,
    };
  });
}

export function fallbackRouteBundle() {
  return [
    {
      id: 'primary',
      distance: 236000,
      duration: 2.52 * 3600,
      coordinates: [
        [DEFAULT_ORIGIN.longitude, DEFAULT_ORIGIN.latitude],
        [-89.05, 42.98],
        [-88.68, 42.54],
        [-88.11, 42.31],
        [-87.72, 41.97],
        [DEFAULT_DESTINATION.longitude, DEFAULT_DESTINATION.latitude],
      ],
    },
    {
      id: 'alt-1',
      distance: 248000,
      duration: 2.63 * 3600,
      coordinates: [
        [DEFAULT_ORIGIN.longitude, DEFAULT_ORIGIN.latitude],
        [-89.2, 42.93],
        [-88.95, 42.61],
        [-88.57, 42.38],
        [-88.04, 42.08],
        [DEFAULT_DESTINATION.longitude, DEFAULT_DESTINATION.latitude],
      ],
    },
  ];
}
