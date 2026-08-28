export const DEFAULT_ORIGIN = {
  latitude: 43.0731,
  longitude: -89.4012,
  label: 'Madison, WI',
};

export const DEFAULT_DESTINATION = {
  latitude: 41.8781,
  longitude: -87.6298,
  label: 'Chicago, IL',
};

export const STORAGE_KEYS = {
  settings: 'waypoint.v1.settings',
  capsule: 'waypoint.v1.capsule',
  convoy: 'waypoint.v1.convoy',
};

export const FEATURE_COPY = {
  convoyNames: ['Maya', 'Theo', 'Jun'],
  convoyColors: ['#c4a8ff', '#a2e686', '#ffcb58'],
};

export function clamp(value, lower, upper) {
  return Math.min(upper, Math.max(lower, value));
}

export function formatDistanceMiles(distanceMeters) {
  return `${(distanceMeters / 1609.344).toFixed(distanceMeters > 16093 ? 0 : 1)} mi`;
}

export function formatDuration(seconds) {
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
  return `${Math.round(value)}°F`;
}

export function formatCharge(value) {
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

export function sampleRoutePoints(coordinates, fractions) {
  if (!coordinates?.length) return [];
  return fractions.map((fraction) => {
    const index = Math.round(clamp(fraction, 0, 1) * (coordinates.length - 1));
    const [longitude, latitude] = coordinates[index];
    return { longitude, latitude };
  });
}

export function routePathFromCoordinates(coordinates) {
  if (!coordinates?.length) return '';
  const longs = coordinates.map(([longitude]) => longitude);
  const lats = coordinates.map(([, latitude]) => latitude);
  const minLon = Math.min(...longs);
  const maxLon = Math.max(...longs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lonSpan = Math.max(0.0001, maxLon - minLon);
  const latSpan = Math.max(0.0001, maxLat - minLat);

  return coordinates
    .map(([longitude, latitude], index) => {
      const x = 80 + ((longitude - minLon) / lonSpan) * 840;
      const y = 80 + ((maxLat - latitude) / latSpan) * 840;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function routeMarkersFromCoordinates(coordinates, labels) {
  if (!coordinates?.length) return [];
  const longs = coordinates.map(([longitude]) => longitude);
  const lats = coordinates.map(([, latitude]) => latitude);
  const minLon = Math.min(...longs);
  const maxLon = Math.max(...longs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lonSpan = Math.max(0.0001, maxLon - minLon);
  const latSpan = Math.max(0.0001, maxLat - minLat);

  return sampleRoutePoints(coordinates, [0, 0.5, 1]).map((point, index) => ({
    label: labels[index],
    x: ((80 + ((point.longitude - minLon) / lonSpan) * 840) / 1000) * 100,
    y: ((80 + ((maxLat - point.latitude) / latSpan) * 840) / 1000) * 100,
  }));
}

export function minutesFromNow(seconds) {
  return Math.max(1, Math.round(seconds / 60));
}

export function estimateArrival(seconds) {
  return formatClock(Date.now() + seconds * 1000);
}

export function buildFallbackMoments(originLabel, destinationLabel) {
  return [
    { title: `Departed ${originLabel.split(',')[0]}`, time: formatClock(Date.now() - 2 * 60 * 60 * 1000), frame: 0 },
    { title: 'Storm over Rockford', time: formatClock(Date.now() - 78 * 60 * 1000), frame: 1 },
    { title: 'First skyline view', time: formatClock(Date.now() - 11 * 60 * 1000), frame: 2 },
    { title: `Arrived ${destinationLabel.split(',')[0]}`, time: formatClock(Date.now()), frame: 3 },
  ];
}
