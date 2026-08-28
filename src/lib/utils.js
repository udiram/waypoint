export const STORAGE_KEYS = {
  settings: 'waypoint.v2.settings',
  capsule: 'waypoint.v2.capsule',
  convoy: 'waypoint.v2.convoy',
  quest: 'waypoint.v2.quest',
  camp: 'waypoint.v2.camp',
};

export function clamp(value, lower, upper) {
  return Math.min(upper, Math.max(lower, value));
}

export function formatDistanceMiles(distanceMeters) {
  const miles = distanceMeters / 1609.344;
  return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'No route';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function formatClock(input) {
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatTemp(value) {
  if (!Number.isFinite(value)) return 'Unavailable';
  return `${Math.round(value)}°F`;
}

export function formatCharge(value) {
  if (!Number.isFinite(value)) return 'Unset';
  return `${Math.round(value)}%`;
}

export function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function loadStoredValue(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  return safeJsonParse(window.localStorage.getItem(key), fallback);
}

export function saveStoredValue(key, value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function createRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function toEncodedPayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let encoded = '';
  bytes.forEach((byte) => {
    encoded += String.fromCharCode(byte);
  });
  return btoa(encoded).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromEncodedPayload(value) {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized);
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function minutesFromNow(seconds) {
  return Math.max(1, Math.round(seconds / 60));
}

export function estimateArrival(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Set destination';
  return formatClock(Date.now() + seconds * 1000);
}

export function haversineMeters(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(right.latitude - left.latitude);
  const dLon = radians(right.longitude - left.longitude);
  const lat1 = radians(left.latitude);
  const lat2 = radians(right.latitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function bearingDegrees(from, to) {
  const radians = (value) => value * Math.PI / 180;
  const degrees = (value) => value * 180 / Math.PI;
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

export function crosswindMph(wind, windDirection, roadBearing) {
  if (![wind, windDirection, roadBearing].every(Number.isFinite)) return null;
  return Math.abs(wind * Math.sin((windDirection - roadBearing) * Math.PI / 180));
}

export function sampleRoutePoints(coordinates, fractions) {
  if (!coordinates?.length) return [];
  return fractions.map((fraction) => {
    const index = Math.round(clamp(fraction, 0, 1) * (coordinates.length - 1));
    const [longitude, latitude] = coordinates[index];
    return { longitude, latitude, index };
  });
}

export function weatherCodeLabel(code) {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if (code >= 51 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Conditions';
}

export function summarizeRouteWeather(stops = []) {
  const max = (key) => {
    const values = stops.map((stop) => stop[key]).filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  };
  const maxWind = max('wind');
  const maxGust = max('gust');
  const maxCrosswind = max('crosswind');
  const maxPrecipitation = max('precipitationProbability');
  const risk = stops.length ? (maxCrosswind || maxWind || 0) + (maxGust || 0) * .25 + (maxPrecipitation || 0) * .08 : null;
  return { maxWind, maxGust, maxCrosswind, maxPrecipitation, risk };
}

export function routeBounds(coordinates = [], extraPoints = []) {
  const pairs = [
    ...coordinates.map(([longitude, latitude]) => ({ longitude, latitude })),
    ...extraPoints.filter((point) => Number.isFinite(point?.longitude) && Number.isFinite(point?.latitude)),
  ];

  if (!pairs.length) {
    return {
      minLon: -1,
      maxLon: 1,
      minLat: -1,
      maxLat: 1,
    };
  }

  const longitudes = pairs.map((point) => point.longitude);
  const latitudes = pairs.map((point) => point.latitude);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lonPad = Math.max(0.06, (maxLon - minLon) * 0.14);
  const latPad = Math.max(0.04, (maxLat - minLat) * 0.18);

  return {
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad,
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
  };
}

export function projectPoint(point, bounds) {
  const lonSpan = Math.max(0.0001, bounds.maxLon - bounds.minLon);
  const latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
  const x = 80 + ((point.longitude - bounds.minLon) / lonSpan) * 840;
  const y = 80 + ((bounds.maxLat - point.latitude) / latSpan) * 840;
  return { x, y };
}

export function routePathFromCoordinates(coordinates = [], bounds = routeBounds(coordinates)) {
  if (!coordinates.length) return '';
  return coordinates
    .map(([longitude, latitude], index) => {
      const { x, y } = projectPoint({ longitude, latitude }, bounds);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function viewportMarkers(points = [], bounds) {
  return points
    .filter((point) => Number.isFinite(point?.longitude) && Number.isFinite(point?.latitude))
    .map((point) => {
      const projected = projectPoint(point, bounds);
      return {
        ...point,
        x: (projected.x / 1000) * 100,
        y: (projected.y / 1000) * 100,
      };
    });
}

export function summarizeHazard(hazard) {
  if (!hazard) {
    return {
      title: 'Route loading',
      detail: 'Pulling live forecast',
      severity: 'subtle',
    };
  }

  if (hazard.primaryMaxPrecip >= 50) {
    return {
      title: 'Rain on route',
      detail: `${Math.round(hazard.primaryMaxPrecip)}% precip chance ahead`,
      severity: 'hazard',
    };
  }

  if (hazard.primaryMaxWind >= 18) {
    return {
      title: 'Wind on route',
      detail: `${Math.round(hazard.primaryMaxWind)} mph peak crosswind`,
      severity: 'hazard',
    };
  }

  return {
    title: 'Route looks clear',
    detail: 'No major weather spikes sampled',
    severity: 'subtle',
  };
}
