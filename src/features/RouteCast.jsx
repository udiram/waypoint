import { AlertTriangle, CloudRain, Navigation, Route, ShieldCheck, Wind } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useWaypointContext } from '../App';
import RouteMap from '../components/RouteMap';
import { formatDistanceMiles, formatDuration, summarizeRouteWeather, weatherCodeLabel } from '../lib/utils';

function EmptyRoute({ status, error }) {
  return <section className="module routecast-module empty-module"><div className="empty-state"><Navigation /><span>RouteCast</span><h1>{status === 'loading' ? 'Building your live route…' : status === 'error' ? 'Live route unavailable' : 'Set a live origin and destination'}</h1><p>{error || 'Open trip settings to use GPS or enter an origin, then choose any destination.'}</p></div></section>;
}

export default function RouteCast() {
  const { routeState, destination, charge } = useWaypointContext();
  const [choice, setChoice] = useState('primary');
  const primarySummary = useMemo(() => summarizeRouteWeather(routeState.primaryWeather), [routeState.primaryWeather]);
  const saferSummary = useMemo(() => summarizeRouteWeather(routeState.saferWeather), [routeState.saferWeather]);
  if (!routeState.primary) return <EmptyRoute status={routeState.status} error={routeState.error} />;
  const lowerRiskAlternative = routeState.safer && Number.isFinite(saferSummary.risk) && Number.isFinite(primarySummary.risk) && saferSummary.risk < primarySummary.risk;
  const route = choice === 'alternative' && routeState.safer ? routeState.safer : routeState.primary;
  const weather = choice === 'alternative' ? routeState.saferWeather : routeState.primaryWeather;
  const summary = choice === 'alternative' ? saferSummary : primarySummary;
  const peak = weather.reduce((best, stop) => (stop.crosswind || 0) > (best?.crosswind || 0) ? stop : best, weather[0]);
  return (
    <section className="module routecast-module">
      <div className="map-region"><RouteMap route={route} comparisonRoute={choice === 'primary' ? routeState.safer : routeState.primary} weatherStops={weather} labels={['Start', routeState.midpointLabel?.split(',')[0] || 'Mid-route', destination?.label?.split(',')[0] || 'Arrival']} /></div>
      <aside className="focus-panel route-focus">
        <div className="route-focus-heading"><span>Live route forecast</span><h1>{destination?.label || 'Destination'}</h1><p>Forecast sampled at your projected arrival time</p></div>
        <div className="condition-hero"><i><Wind /></i><div><span>Peak crosswind</span><strong>{Number.isFinite(summary.maxCrosswind) ? `${Math.round(summary.maxCrosswind)} mph` : 'Unavailable'}</strong><small>{peak ? `${weatherCodeLabel(peak.code)} · ${Math.round(peak.precipitationProbability)}% precipitation` : 'Forecast service did not return samples'}</small></div></div>
        <div className="route-facts">
          <div><Route /><span>Distance</span><strong>{formatDistanceMiles(route.distance)}</strong></div>
          <div><CloudRain /><span>Peak precip</span><strong>{Number.isFinite(summary.maxPrecipitation) ? `${Math.round(summary.maxPrecipitation)}%` : '—'}</strong></div>
          <div><AlertTriangle /><span>Peak gust</span><strong>{Number.isFinite(summary.maxGust) ? `${Math.round(summary.maxGust)} mph` : '—'}</strong></div>
        </div>
        {routeState.safer ? <div className={`route-choice ${lowerRiskAlternative ? 'recommended' : ''}`}><ShieldCheck /><div><span>Alternative · {formatDuration(routeState.safer.duration)}</span><strong>{lowerRiskAlternative ? 'Lower sampled weather risk' : 'No lower-risk advantage detected'}</strong><small>{formatDistanceMiles(routeState.safer.distance)} · based on current public forecast</small></div></div> : <p className="modal-copy">The router returned one viable route.</p>}
        {routeState.safer && <button className="primary-button" onClick={() => setChoice((value) => value === 'primary' ? 'alternative' : 'primary')}><Navigation /> {choice === 'primary' ? 'Compare alternate route' : 'Return to primary route'}</button>}
        <footer className="focus-footer"><span>{Number.isFinite(charge) ? `${charge}% battery entered manually` : 'Battery not set'}</span><small>Preview only · does not change Tesla navigation</small></footer>
      </aside>
    </section>
  );
}
