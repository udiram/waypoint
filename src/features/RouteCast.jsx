import { ArrowRight, Check, CloudRain, Navigation, Wind } from 'lucide-react';
import { useState } from 'react';
import { useWaypointContext } from '../App';
import RouteMap from '../components/RouteMap';
import { estimateArrival, formatDuration } from '../lib/utils';

export default function RouteCast() {
  const { charge, destination, originLabel, routeState, weather } = useWaypointContext();
  const [safer, setSafer] = useState(false);
  const [view, setView] = useState('now');
  const [confirmed, setConfirmed] = useState(false);

  const route = safer ? routeState.safer : routeState.primary;
  const comparisonRoute = safer ? routeState.primary : routeState.safer;
  const weatherStops = safer ? routeState.saferWeather : routeState.primaryWeather;
  const arrivalReserve = Math.max(8, charge - (safer ? 41 : 45));
  const destinationName = destination.label.split(',')[0];

  const chooseSafer = () => {
    setSafer(true);
    setConfirmed(true);
  };

  return (
    <section className="module routecast-module">
      <h1 className="sr-only">RouteCast</h1>
      <div className="map-region">
        <RouteMap
          route={route}
          comparisonRoute={comparisonRoute}
          weatherStops={weatherStops}
          labels={[originLabel.split(',')[0], 'Rockford', destinationName]}
        />
        <div className={`map-hazard ${safer ? 'resolved' : ''}`}>
          {safer ? <Check /> : <Wind />}
          <div><strong>{safer ? 'Calmer route selected' : 'Crosswind ahead'}</strong><span>{safer ? '18 mph less crosswind' : '18 miles'}</span></div>
        </div>
      </div>

      <aside className="focus-panel route-focus">
        <div className="focus-tabs" role="tablist" aria-label="Route forecast timing">
          <button className={view === 'now' ? 'active' : ''} onClick={() => setView('now')} role="tab" aria-selected={view === 'now'}>Now</button>
          <button className={view === 'next' ? 'active' : ''} onClick={() => setView('next')} role="tab" aria-selected={view === 'next'}>Next</button>
        </div>

        <div className="weather-pair">
          <div><CloudRain /><span>Rain</span><strong>{Math.round(weather.temperature_2m)}°F</strong><small>Feels like {Math.round(weather.apparent_temperature)}°</small></div>
          <div><Wind /><span>Crosswind</span><strong>{safer ? 8 : Math.max(18, Math.round(weather.wind_speed_10m + 12))}<em> mph</em></strong><small>{safer ? 'Sheltered route' : 'Gusts near Rockford'}</small></div>
        </div>

        <div className="arrival-reserve">
          <span>Arrival reserve</span>
          <div><strong>{arrivalReserve}%</strong><em>~58 mi</em></div>
          <i><b style={{ width: `${Math.min(100, arrivalReserve * 2.35)}%` }} /></i>
        </div>

        <button className="route-option" onClick={chooseSafer} disabled={safer}>
          <Navigation />
          <span><strong>{safer ? 'Calmer route active' : 'Calmer route available'}</strong><small>+{Math.max(1, Math.round((routeState.safer.duration - routeState.primary.duration) / 60))} min · 18 mph less crosswind</small></span>
          <ArrowRight />
        </button>

        <button className="primary-button" onClick={chooseSafer} disabled={safer}>
          {safer ? <Check /> : <Navigation />}
          {safer ? 'Calmer route selected' : 'Take the calmer route'}
        </button>

        <button className="quiet-action" onClick={() => { setSafer(false); setConfirmed(false); }} disabled={!safer}>Return to fastest route</button>

        <footer className="focus-footer">
          <span>{formatDuration(route.duration)}</span>
          <span>ETA {estimateArrival(route.duration)}</span>
          <small>{confirmed ? 'Saved in Waypoint' : routeState.status === 'ready' ? 'Live route forecast' : 'Using reliable fallback data'}</small>
        </footer>
      </aside>
    </section>
  );
}
