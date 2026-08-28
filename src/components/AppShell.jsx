import { Battery, CarFront, CloudRain, Compass, Flag, Gauge, Landmark, LocateFixed, Settings2, Sparkles, TentTree, Users } from 'lucide-react';
import { useState } from 'react';
import { useWaypointContext } from '../App';
import { estimateArrival, formatDistanceMiles, formatDuration, formatTemp, summarizeRouteWeather } from '../lib/utils';
import Modal from './Modal';

const navItems = [
  ['routecast', 'RouteCast', CloudRain], ['roadlore', 'RoadLore', Landmark], ['campglass', 'Campglass', TentTree],
  ['convoy', 'Convoy', Users], ['quest', 'Quest', Sparkles], ['capsule', 'Capsule', Compass],
];

function JourneyRail({ originLabel, destination, routeState, nearbyState, locationStatus }) {
  const route = routeState.primary;
  const risk = summarizeRouteWeather(routeState.primaryWeather);
  if (!route) {
    return <aside className="journey-rail empty-rail"><Compass /><strong>{routeState.status === 'awaiting_location' ? 'Set your location' : 'Choose a destination'}</strong><span>Live trip events will appear here.</span><small>{locationStatus}</small></aside>;
  }
  const charger = nearbyState.chargers?.[0];
  return (
    <aside className="journey-rail" aria-label="Live trip timeline">
      <div className="journey-track" aria-hidden="true" />
      <div className="journey-stop current"><i /><div><strong>{originLabel.split(',')[0]}</strong><span>Now</span></div></div>
      {Number.isFinite(risk.maxCrosswind) && <div className="journey-event hazard"><CloudRain /><div><strong>{Math.round(risk.maxCrosswind)} mph</strong><span>Peak sampled crosswind</span></div></div>}
      {charger && <div className="journey-event"><Battery /><div><strong>{formatDistanceMiles(charger.distanceMeters)}</strong><span>{charger.name}</span></div></div>}
      <div className="journey-stop midpoint"><i /><div><strong>{routeState.midpointLabel?.split(',')[0] || 'Mid-route'}</strong><span>Forecast sampled</span></div></div>
      <div className="journey-stop destination"><i /><div><strong>{destination.label.split(',')[0]}</strong><span>{estimateArrival(route.duration)}</span></div></div>
      <footer><span>{formatDistanceMiles(route.distance)}</span><span>{formatDuration(route.duration)}</span><small>{locationStatus}</small></footer>
    </aside>
  );
}

export default function AppShell({ children }) {
  const app = useWaypointContext();
  const [showPlanner, setShowPlanner] = useState(false);
  const route = app.routeState.primary;
  return (
    <div className={`app-shell mode-${app.active}`}>
      <a className="skip-link" href="#main-content">Skip to trip view</a>
      <header className="topbar">
        <button className="wordmark" onClick={() => app.setActive('routecast')}><span className="brand-mark"><Compass /></span><span>Waypoint</span></button>
        <button className="trip-title" onClick={() => setShowPlanner(true)}><span>{app.originLabel.split(',')[0]}</span><b>→</b><span>{app.destination?.label?.split(',')[0] || 'Set destination'}</span></button>
        <div className="trip-summary">
          <div><strong>{route ? formatDuration(route.duration) : 'No route'}</strong><span>{route ? `ETA ${estimateArrival(route.duration)}` : 'Live route pending'}</span></div>
          <div><strong>{Number.isFinite(app.charge) ? `${app.charge}% manual` : 'Battery not set'}</strong><span>Tesla data not connected</span></div>
        </div>
        <button className="round-control" onClick={() => setShowPlanner(true)} aria-label="Open trip settings"><Settings2 /></button>
      </header>
      <JourneyRail {...app} />
      <main id="main-content" className="main-stage">{children}</main>
      <footer className="drive-dock">
        <div className="cabin-status"><strong>{app.weather ? formatTemp(app.weather.temperature_2m) : '—'}</strong><span><CarFront /> Browser companion</span></div>
        <nav className="mode-dock">{navItems.map(([id, label, Icon]) => <button key={id} className={app.active === id ? 'active' : ''} onClick={() => app.setActive(id)}><Icon /><span>{label}</span></button>)}</nav>
        <div className="dock-utilities"><span className="live-pill">LIVE</span></div>
      </footer>
      {showPlanner && <Modal title="Live trip setup" onClose={() => setShowPlanner(false)}>
        <form className="planner-form" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="origin">Origin</label>
          <div className="inline-field"><input id="origin" value={app.originQuery} onChange={(event) => app.setOriginQuery(event.target.value)} placeholder="e.g. Madison, WI" /><button type="button" onClick={app.applyOriginQuery}>Use</button></div>
          <button className="secondary-button" type="button" onClick={app.requestLiveLocation}><LocateFixed /> Use live GPS</button>
          <small className="field-status">{app.locationStatus}</small>
          <label htmlFor="destination">Destination</label>
          <input id="destination" value={app.destinationQuery} onChange={(event) => app.setDestinationQuery(event.target.value)} placeholder="e.g. Minneapolis, MN" />
          <label htmlFor="charge">Starting battery <small>(manual)</small></label>
          <div className="inline-field"><Battery /><input id="charge" type="number" min="1" max="100" value={app.charge ?? ''} onChange={(event) => app.setCharge(event.target.value === '' ? null : Number(event.target.value))} placeholder="Optional" /></div>
          <div className="planner-hint"><Gauge /><span>Waypoint reads browser location and public data. It does not control or read your Tesla without Fleet API authorization.</span></div>
          <button className="primary-button" type="button" onClick={() => setShowPlanner(false)}><Flag /> View live trip</button>
        </form>
      </Modal>}
    </div>
  );
}
