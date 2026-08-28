import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchCurrentWeather, fetchLore, fetchNearbyPlaces, fetchOvernightWeather,
  fetchRouteBundle, fetchWeatherAlongRoute, geocodePlace, reverseGeocode,
} from '../lib/api';
import {
  STORAGE_KEYS, createRoomCode, estimateArrival, formatCharge, fromEncodedPayload,
  haversineMeters, loadStoredValue, saveStoredValue,
} from '../lib/utils';

const EMPTY_NEARBY = { campsites: [], chargers: [], updatedAt: null };
const EMPTY_ROUTE = { status: 'awaiting_location', primary: null, safer: null, primaryWeather: [], saferWeather: [], midpointLabel: null, error: null };

export function useWaypointApp() {
  const url = typeof window === 'undefined' ? new URL('https://waypoint.local') : new URL(window.location.href);
  const sharedCapsule = fromEncodedPayload(url.searchParams.get('capsule'));
  const settings = loadStoredValue(STORAGE_KEYS.settings, { originQuery: '', destinationQuery: '', charge: null });
  const convoy = loadStoredValue(STORAGE_KEYS.convoy, { roomCode: url.searchParams.get('room') || createRoomCode() });
  const [active, setActive] = useState(url.searchParams.get('room') ? 'convoy' : sharedCapsule ? 'capsule' : 'routecast');
  const [position, setPosition] = useState(settings.origin || null);
  const [manualOrigin, setManualOrigin] = useState(settings.origin || null);
  const [originLabel, setOriginLabel] = useState(settings.origin?.label || 'Location not set');
  const [originQuery, setOriginQuery] = useState(settings.originQuery || '');
  const [destinationQuery, setDestinationQuery] = useState(sharedCapsule?.destination?.label || settings.destinationQuery || '');
  const [destination, setDestination] = useState(sharedCapsule?.destination || null);
  const [charge, setCharge] = useState(Number.isFinite(settings.charge) ? settings.charge : null);
  const [locationState, setLocationState] = useState(settings.origin
    ? { status: 'ready', source: 'manual', error: null, accuracy: null, updatedAt: Date.now() }
    : { status: 'locating', source: null, error: null, accuracy: null, updatedAt: null });
  const [weatherState, setWeatherState] = useState({ status: 'idle', data: null, error: null });
  const [overnightState, setOvernightState] = useState({ status: 'idle', hours: [], sunrise: null, sunset: null, error: null });
  const [loreState, setLoreState] = useState({ status: 'idle', items: [], error: null });
  const [nearbyState, setNearbyState] = useState({ status: 'idle', ...EMPTY_NEARBY, error: null });
  const [routeState, setRouteState] = useState(EMPTY_ROUTE);
  const [capsuleMoments, setCapsuleMoments] = useState(loadStoredValue(STORAGE_KEYS.capsule, sharedCapsule?.moments || []));
  const [roomCode, setRoomCode] = useState(convoy.roomCode);
  const deferredDestination = useDeferredValue(destinationQuery);
  const lastGps = useRef(null);

  useEffect(() => saveStoredValue(STORAGE_KEYS.settings, { originQuery, destinationQuery, charge, origin: manualOrigin }), [originQuery, destinationQuery, charge, manualOrigin]);
  useEffect(() => saveStoredValue(STORAGE_KEYS.capsule, capsuleMoments), [capsuleMoments]);
  useEffect(() => saveStoredValue(STORAGE_KEYS.convoy, { roomCode }), [roomCode]);

  const useLivePosition = (coords) => {
    const next = { latitude: coords.latitude, longitude: coords.longitude };
    if (lastGps.current && haversineMeters(lastGps.current, next) < 100) return;
    lastGps.current = next;
    startTransition(() => {
      setManualOrigin(null);
      setPosition(next);
      setOriginLabel('Live position');
      setLocationState({ status: 'ready', source: 'gps', error: null, accuracy: coords.accuracy || null, updatedAt: Date.now() });
    });
  };

  const locationError = (error) => setLocationState((current) => current.source === 'manual' ? current : ({
    status: error?.code === 1 ? 'denied' : 'unavailable', source: null,
    error: error?.code === 1 ? 'Location permission denied. Enter an origin instead.' : 'Live location is unavailable. Enter an origin instead.',
    accuracy: null, updatedAt: null,
  }));

  useEffect(() => {
    if (!navigator.geolocation) { locationError(); return undefined; }
    const id = navigator.geolocation.watchPosition((result) => useLivePosition(result.coords), locationError,
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const requestLiveLocation = () => {
    if (!navigator.geolocation) { locationError(); return; }
    setLocationState((current) => ({ ...current, status: 'locating', error: null }));
    navigator.geolocation.getCurrentPosition((result) => useLivePosition(result.coords), locationError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  };

  const applyOriginQuery = async () => {
    if (originQuery.trim().length < 3) return;
    setLocationState((current) => ({ ...current, status: 'locating', error: null }));
    try {
      const place = await geocodePlace(originQuery);
      const nextOrigin = { latitude: place.latitude, longitude: place.longitude, label: place.label };
      setManualOrigin(nextOrigin);
      setPosition(nextOrigin);
      setOriginLabel(place.label);
      setLocationState({ status: 'ready', source: 'manual', error: null, accuracy: null, updatedAt: Date.now() });
    } catch (error) {
      setLocationState({ status: 'unavailable', source: 'manual', error: error.message, accuracy: null, updatedAt: null });
    }
  };

  useEffect(() => {
    const query = deferredDestination.trim();
    if (query.length < 3) { setDestination(null); return undefined; }
    let ignore = false;
    const id = window.setTimeout(() => geocodePlace(query).then((place) => { if (!ignore) setDestination(place); }).catch(() => { if (!ignore) setDestination(null); }), 500);
    return () => { ignore = true; window.clearTimeout(id); };
  }, [deferredDestination]);

  useEffect(() => {
    if (!position) return undefined;
    let ignore = false;
    setWeatherState({ status: 'loading', data: null, error: null });
    setOvernightState((current) => ({ ...current, status: 'loading', error: null }));
    setLoreState({ status: 'loading', items: [], error: null });
    setNearbyState({ status: 'loading', ...EMPTY_NEARBY, error: null });
    Promise.allSettled([
      reverseGeocode(position.latitude, position.longitude),
      fetchCurrentWeather(position.latitude, position.longitude),
      fetchOvernightWeather(position.latitude, position.longitude),
      fetchLore(position.latitude, position.longitude),
      fetchNearbyPlaces(position.latitude, position.longitude),
    ]).then(([place, weather, overnight, lore, nearby]) => {
      if (ignore) return;
      if (place.status === 'fulfilled' && locationState.source === 'gps') setOriginLabel(place.value.label);
      setWeatherState(weather.status === 'fulfilled' ? { status: 'ready', data: weather.value, error: null } : { status: 'error', data: null, error: weather.reason.message });
      setOvernightState(overnight.status === 'fulfilled' ? { status: 'ready', ...overnight.value, error: null } : { status: 'error', hours: [], sunrise: null, sunset: null, error: overnight.reason.message });
      setLoreState(lore.status === 'fulfilled' ? { status: 'ready', items: lore.value, error: null } : { status: 'error', items: [], error: lore.reason.message });
      setNearbyState(nearby.status === 'fulfilled' ? { status: 'ready', ...nearby.value, error: null } : { status: 'error', ...EMPTY_NEARBY, error: nearby.reason.message });
    });
    return () => { ignore = true; };
  }, [position?.latitude, position?.longitude, locationState.source]);

  useEffect(() => {
    if (!position) { setRouteState({ ...EMPTY_ROUTE, status: 'awaiting_location' }); return undefined; }
    if (!destination) { setRouteState({ ...EMPTY_ROUTE, status: 'awaiting_destination' }); return undefined; }
    let ignore = false;
    setRouteState({ ...EMPTY_ROUTE, status: 'loading' });
    fetchRouteBundle(position, destination).then(async ([primary, alternative]) => {
      const safer = alternative || null;
      const midpoint = primary.coordinates[Math.round(primary.coordinates.length * 0.45)];
      const [primaryWeather, saferWeather, midpointPlace] = await Promise.allSettled([
        fetchWeatherAlongRoute(primary), safer ? fetchWeatherAlongRoute(safer) : Promise.resolve([]),
        reverseGeocode(midpoint[1], midpoint[0]),
      ]);
      if (ignore) return;
      setRouteState({ status: 'ready', primary, safer,
        primaryWeather: primaryWeather.status === 'fulfilled' ? primaryWeather.value : [],
        saferWeather: saferWeather.status === 'fulfilled' ? saferWeather.value : [],
        midpointLabel: midpointPlace.status === 'fulfilled' ? midpointPlace.value.label : 'Mid-route', error: null });
    }).catch((error) => { if (!ignore) setRouteState({ ...EMPTY_ROUTE, status: 'error', error: error.message }); });
    return () => { ignore = true; };
  }, [position?.latitude, position?.longitude, destination?.latitude, destination?.longitude]);

  return useMemo(() => ({
    active, setActive, position, originLabel, originQuery, setOriginQuery, applyOriginQuery, requestLiveLocation,
    destination, destinationQuery, setDestinationQuery, charge, setCharge, locationState,
    locationStatus: locationState.error || (locationState.source === 'gps' ? 'Live GPS' : locationState.source === 'manual' ? 'Manual origin' : 'Waiting for location'),
    weather: weatherState.data, weatherState, overnight: overnightState.hours, overnightState,
    lore: loreState.items, loreState, nearbyState, routeState,
    capsuleMoments, setCapsuleMoments, roomCode, setRoomCode,
    vehicleProfile: { name: 'You', color: '#83bdff', charge: formatCharge(charge), eta: routeState.primary ? estimateArrival(routeState.primary.duration) : 'Calculating' },
  }), [active, position, originLabel, originQuery, destination, destinationQuery, charge, locationState, weatherState, overnightState, loreState, nearbyState, routeState, capsuleMoments, roomCode]);
}
