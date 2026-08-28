import 'leaflet/dist/leaflet.css';
import { Wind } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function RouteMap({ mode = 'solo', route, comparisonRoute = null, weatherStops = [], members = [], labels = ['Start', 'Mid-route', 'Arrival'] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);
  const [mapStatus, setMapStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !containerRef.current) return;
      if (!mapRef.current) {
        const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        mapRef.current = map;
        layersRef.current = L.layerGroup().addTo(map);
      }
      const map = mapRef.current;
      const layers = layersRef.current;
      layers.clearLayers();
      const routePoints = (route?.coordinates || []).map(([lon, lat]) => [lat, lon]);
      const alternate = (comparisonRoute?.coordinates || []).map(([lon, lat]) => [lat, lon]);
      if (alternate.length) L.polyline(alternate, { color: '#7f8e99', weight: 4, opacity: .65, dashArray: '8 10' }).addTo(layers);
      if (routePoints.length) L.polyline(routePoints, { color: '#57b9ff', weight: 6, opacity: .94 }).addTo(layers);
      const points = [];
      if (routePoints.length) {
        const routeMarkers = [routePoints[0], routePoints[Math.round((routePoints.length - 1) * .45)], routePoints.at(-1)];
        routeMarkers.forEach((point, index) => {
          points.push(point);
          L.circleMarker(point, { radius: index === 2 ? 8 : 6, color: '#d9f2ff', fillColor: index === 2 ? '#8be59f' : '#57b9ff', fillOpacity: 1, weight: 3 })
            .bindTooltip(labels[index], { permanent: true, direction: 'top', className: 'map-tooltip' }).addTo(layers);
        });
      }
      weatherStops.forEach((stop) => {
        const point = [stop.latitude, stop.longitude];
        points.push(point);
        L.circleMarker(point, { radius: 11, color: '#f5c96a', fillColor: '#1b2630', fillOpacity: .95, weight: 2 })
          .bindPopup(`<strong>${stop.label}</strong><br>${Math.round(stop.temperature)}°F · ${Math.round(stop.wind)} mph wind<br>${Math.round(stop.precipitationProbability)}% precipitation`).addTo(layers);
      });
      members.filter((member) => Number.isFinite(member.location?.latitude) && Number.isFinite(member.location?.longitude)).forEach((member) => {
        const point = [member.location.latitude, member.location.longitude];
        points.push(point);
        L.circleMarker(point, { radius: 9, color: '#fff', fillColor: member.color || '#c4a8ff', fillOpacity: 1, weight: 3 })
          .bindTooltip(member.name, { permanent: true, className: 'map-tooltip' }).addTo(layers);
      });
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 13 });
      else map.setView([39.5, -98.35], 4);
      window.setTimeout(() => map.invalidateSize(), 50);
      setMapStatus('ready');
    }).catch(() => setMapStatus('error'));
    return () => { cancelled = true; };
  }, [route, comparisonRoute, weatherStops, members, labels]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);
  return (
    <div className={`route-map live-route-map ${mode === 'convoy' ? 'convoy-map' : ''}`} aria-label="Live route map">
      <div className="leaflet-host" ref={containerRef} />
      {mapStatus !== 'ready' && <div className="map-loading">{mapStatus === 'error' ? 'Map tiles unavailable' : 'Loading live map…'}</div>}
      <div className="map-key"><span><i className="key-line blue" /> Current route</span>{comparisonRoute && <span><i className="key-line dashed" /> Alternate</span>}</div>
      {mode !== 'convoy' && weatherStops.length > 0 && <div className="weather-strip">{weatherStops.map((stop) => <div key={stop.label}><small>{stop.label}</small><strong>{Math.round(stop.temperature)}°</strong><span><Wind size={13} /> {Math.round(stop.wind)} mph</span></div>)}</div>}
    </div>
  );
}
