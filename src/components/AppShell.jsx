import {
  Battery,
  CarFront,
  CloudRain,
  Compass,
  Flag,
  Flame,
  Gauge,
  Landmark,
  Settings2,
  Sparkles,
  TentTree,
  Users,
  Volume2,
  Wind,
} from 'lucide-react';
import { useState } from 'react';
import { useWaypointContext } from '../App';
import { estimateArrival, formatDistanceMiles, formatDuration } from '../lib/utils';
import Modal from './Modal';

const navItems = [
  { id: 'routecast', label: 'RouteCast', icon: CloudRain },
  { id: 'roadlore', label: 'RoadLore', icon: Landmark },
  { id: 'campglass', label: 'Campglass', icon: TentTree },
  { id: 'convoy', label: 'Convoy', icon: Users },
  { id: 'quest', label: 'Quest', icon: Sparkles },
  { id: 'capsule', label: 'Capsule', icon: Compass },
];

function JourneyRail({ originLabel, destination, route, locationStatus }) {
  const destinationName = destination.label.split(',')[0];
  const originName = originLabel.split(',')[0];
  const arrival = estimateArrival(route.duration);

  return (
    <aside className="journey-rail" aria-label="Trip timeline">
      <div className="journey-track" aria-hidden="true" />
      <div className="journey-stop current">
        <i />
        <div><strong>{originName}</strong><span>Now</span></div>
      </div>
      <div className="journey-event hazard">
        <Wind />
        <div><strong>18 mi</strong><span>Crosswind ahead</span></div>
      </div>
      <div className="journey-event">
        <Landmark />
        <div><strong>64 mi</strong><span>Fuel & food planned</span></div>
      </div>
      <div className="journey-stop midpoint">
        <i />
        <div><strong>Rockford</strong><span>1:32 PM</span></div>
      </div>
      <div className="journey-event subtle">
        <CloudRain />
        <div><strong>Heavy rain</strong><span>Ending near 1:45</span></div>
      </div>
      <div className="journey-stop destination">
        <i />
        <div><strong>{destinationName}</strong><span>{arrival}</span></div>
      </div>
      <footer>
        <span>{formatDistanceMiles(route.distance)}</span>
        <span>{formatDuration(route.duration)}</span>
        <small>{locationStatus}</small>
      </footer>
    </aside>
  );
}

export default function AppShell({ children }) {
  const {
    active,
    setActive,
    originLabel,
    destination,
    destinationQuery,
    setDestinationQuery,
    charge,
    setCharge,
    weather,
    locationStatus,
    routeState,
  } = useWaypointContext();
  const [showPlanner, setShowPlanner] = useState(false);
  const route = routeState.primary;

  return (
    <div className={`app-shell mode-${active}`}>
      <a className="skip-link" href="#main-content">Skip to trip view</a>

      <header className="topbar">
        <button className="wordmark" onClick={() => setActive('routecast')} aria-label="Open RouteCast">
          <span className="brand-mark"><Compass size={20} /></span>
          <span>Waypoint</span>
        </button>

        <button className="trip-title" onClick={() => setShowPlanner(true)} aria-label="Edit trip">
          <span>{originLabel.split(',')[0]}</span>
          <b>→</b>
          <span>{destination.label.split(',')[0]}</span>
        </button>

        <div className="trip-summary" aria-label="Trip summary">
          <div><strong>{formatDuration(route.duration)}</strong><span>ETA {estimateArrival(route.duration)}</span></div>
          <div><strong>{Math.max(8, charge - 45)}% <em>on arrival</em></strong><span>~58 mi reserve</span></div>
        </div>

        <button className="round-control" onClick={() => setShowPlanner(true)} aria-label="Open trip settings">
          <Settings2 />
        </button>
      </header>

      <JourneyRail originLabel={originLabel} destination={destination} route={route} locationStatus={locationStatus} />

      <main id="main-content" className="main-stage">{children}</main>

      <footer className="drive-dock">
        <div className="cabin-status">
          <strong>{Math.round(weather.temperature_2m)}°</strong>
          <span><CarFront /> Browser companion</span>
        </div>

        <nav className="mode-dock" aria-label="Waypoint modes">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={active === id ? 'active' : ''}
              onClick={() => setActive(id)}
              aria-label={label === 'Quest' ? 'Passenger Quest' : label === 'Capsule' ? 'Trip Capsule' : label}
              aria-current={active === id ? 'page' : undefined}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="dock-utilities"><Volume2 /><Flame /></div>
      </footer>

      {showPlanner && (
        <Modal title="Trip settings" onClose={() => setShowPlanner(false)}>
          <form className="planner-form" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="destination">Destination</label>
            <input id="destination" value={destinationQuery} onChange={(event) => setDestinationQuery(event.target.value)} placeholder="Chicago, IL" />
            <div className="planner-hint">
              <Gauge />
              <span>Route planning stays in the browser. Waypoint never sends commands to your Tesla without Fleet API authorization.</span>
            </div>
            <label htmlFor="charge">Starting battery</label>
            <div className="planner-range">
              <Battery />
              <input id="charge" type="range" min="20" max="95" value={charge} onChange={(event) => setCharge(Number(event.target.value))} />
              <strong>{charge}%</strong>
            </div>
            <button className="primary-button" type="button" onClick={() => setShowPlanner(false)}>
              <Flag /> Apply trip view
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
