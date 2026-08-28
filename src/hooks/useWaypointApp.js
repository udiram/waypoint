import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  fetchCurrentWeather,
  fetchLore,
  fetchOvernightWeather,
  fetchRouteBundle,
  fetchWeatherAlongRoute,
  fallbackRouteBundle,
  geocodePlace,
  reverseGeocode,
} from '../lib/api';
import {
  DEFAULT_DESTINATION,
  DEFAULT_ORIGIN,
  STORAGE_KEYS,
  buildFallbackMoments,
  createRoomCode,
  formatCharge,
  fromEncodedPayload,
  loadStoredValue,
  saveStoredValue,
} from '../lib/utils';

const fallbackWeather = {
  temperature_2m: 72,
  apparent_temperature: 72,
  wind_speed_10m: 11,
  weather_code: 3,
};

export function useWaypointApp() {
  const url = typeof window === 'undefined' ? new URL('https://waypoint.local') : new URL(window.location.href);
  const sharedCapsule = fromEncodedPayload(url.searchParams.get('capsule'));
  const initialSettings = loadStoredValue(STORAGE_KEYS.settings, {
    destinationQuery: sharedCapsule?.destination?.label || DEFAULT_DESTINATION.label,
    charge: 68,
  });
  const initialCapsule = loadStoredValue(
    STORAGE_KEYS.capsule,
    sharedCapsule?.moments || buildFallbackMoments(DEFAULT_ORIGIN.label, DEFAULT_DESTINATION.label),
  );
  const initialConvoy = loadStoredValue(STORAGE_KEYS.convoy, {
    roomCode: url.searchParams.get('room') || createRoomCode(),
  });

  const [active, setActive] = useState(url.searchParams.get('room') ? 'convoy' : sharedCapsule ? 'capsule' : 'routecast');
  const [position, setPosition] = useState(DEFAULT_ORIGIN);
  const [originLabel, setOriginLabel] = useState(DEFAULT_ORIGIN.label);
  const [destinationQuery, setDestinationQuery] = useState(initialSettings.destinationQuery);
  const [destination, setDestination] = useState(sharedCapsule?.destination || DEFAULT_DESTINATION);
  const [charge, setCharge] = useState(initialSettings.charge);
  const [weather, setWeather] = useState(fallbackWeather);
  const [locationStatus, setLocationStatus] = useState('Locating');
  const [routeState, setRouteState] = useState({
    status: 'loading',
    primary: fallbackRouteBundle()[0],
    safer: fallbackRouteBundle()[1],
    primaryWeather: [],
    saferWeather: [],
    error: null,
  });
  const [overnight, setOvernight] = useState([]);
  const [lore, setLore] = useState([]);
  const [capsuleMoments, setCapsuleMoments] = useState(initialCapsule);
  const [roomCode, setRoomCode] = useState(initialConvoy.roomCode);
  const deferredDestinationQuery = useDeferredValue(destinationQuery);

  useEffect(() => {
    saveStoredValue(STORAGE_KEYS.settings, { destinationQuery, charge });
  }, [destinationQuery, charge]);

  useEffect(() => {
    saveStoredValue(STORAGE_KEYS.capsule, capsuleMoments);
  }, [capsuleMoments]);

  useEffect(() => {
    saveStoredValue(STORAGE_KEYS.convoy, { roomCode });
  }, [roomCode]);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('Browser location unavailable');
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (nextPosition) => {
        startTransition(() => {
          setPosition({
            latitude: nextPosition.coords.latitude,
            longitude: nextPosition.coords.longitude,
            label: 'Live position',
          });
          setLocationStatus('Live location ready');
        });
      },
      () => {
        setLocationStatus('Using fallback location');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 12000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      reverseGeocode(position.latitude, position.longitude).catch(() => DEFAULT_ORIGIN.label),
      fetchCurrentWeather(position.latitude, position.longitude).catch(() => fallbackWeather),
      fetchOvernightWeather(position.latitude, position.longitude).catch(() => []),
      fetchLore(position.latitude, position.longitude).catch(() => []),
    ]).then(([placeLabel, currentWeather, nextOvernight, nextLore]) => {
      if (ignore) return;
      startTransition(() => {
        setOriginLabel(placeLabel.split(',').slice(0, 2).join(','));
        setWeather(currentWeather);
        setOvernight(nextOvernight);
        setLore(nextLore);
      });
    });
    return () => {
      ignore = true;
    };
  }, [position.latitude, position.longitude]);

  useEffect(() => {
    let ignore = false;
    geocodePlace(deferredDestinationQuery)
      .then((nextDestination) => {
        if (!ignore) {
          startTransition(() => setDestination(nextDestination));
        }
      })
      .catch(() => {
        if (!ignore) {
          setDestination(DEFAULT_DESTINATION);
        }
      });
    return () => {
      ignore = true;
    };
  }, [deferredDestinationQuery]);

  useEffect(() => {
    let ignore = false;
    const fallbackRoutes = fallbackRouteBundle();
    setRouteState((current) => ({ ...current, status: 'loading', error: null }));
    fetchRouteBundle(position, destination)
      .then(async (routes) => {
        const [primary, alternative] = routes;
        const [primaryWeather, saferWeather] = await Promise.all([
          fetchWeatherAlongRoute(primary).catch(() => []),
          fetchWeatherAlongRoute(alternative || primary).catch(() => []),
        ]);
        if (ignore) return;
        setRouteState({
          status: 'ready',
          primary,
          safer: alternative || primary,
          primaryWeather,
          saferWeather,
          error: null,
        });
      })
      .catch((error) => {
        if (ignore) return;
        setRouteState({
          status: 'error',
          primary: fallbackRoutes[0],
          safer: fallbackRoutes[1],
          primaryWeather: [
            { label: 'Start', temperature: 72, wind: 10 },
            { label: 'Midpoint', temperature: 69, wind: 16 },
            { label: 'Arrival', temperature: 67, wind: 13 },
          ],
          saferWeather: [
            { label: 'Start', temperature: 72, wind: 9 },
            { label: 'Midpoint', temperature: 68, wind: 11 },
            { label: 'Arrival', temperature: 67, wind: 10 },
          ],
          error: error.message,
        });
      });
    return () => {
      ignore = true;
    };
  }, [position.latitude, position.longitude, destination.latitude, destination.longitude]);

  const value = useMemo(() => ({
    active,
    setActive,
    position,
    originLabel,
    destination,
    destinationQuery,
    setDestinationQuery,
    charge,
    setCharge,
    weather,
    locationStatus,
    routeState,
    overnight,
    lore,
    capsuleMoments,
    setCapsuleMoments,
    roomCode,
    setRoomCode,
    vehicleProfile: {
      name: 'You',
      color: '#83bdff',
      charge: formatCharge(charge),
    },
  }), [
    active,
    charge,
    destination,
    destinationQuery,
    locationStatus,
    lore,
    originLabel,
    overnight,
    position,
    routeState,
    capsuleMoments,
    roomCode,
  ]);

  return value;
}
