import {
  Battery,
  BookOpen,
  Bluetooth,
  CarFront,
  Compass,
  Flame,
  Gauge,
  MapPinned,
  Menu,
  Radio,
  Settings,
  Signal,
  Sparkles,
  Users,
  Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { useWaypointContext } from '../App';
import Modal from './Modal';

const navItems = [
  { id: 'routecast', label: 'RouteCast', icon: Radio },
  { id: 'roadlore', label: 'RoadLore', icon: BookOpen },
  { id: 'campglass', label: 'Campglass', icon: Flame },
  { id: 'convoy', label: 'Convoy', icon: Users },
  { id: 'quest', label: 'Passenger Quest', icon: Sparkles },
  { id: 'capsule', label: 'Trip Capsule', icon: MapPinned },
];

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
  } = useWaypointContext();
  const [showPlanner, setShowPlanner] = useState(false);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => setActive('routecast')} aria-label="Open RouteCast">
          <span className="brand-mark"><Compass size={21} /></span>
          Waypoint
        </button>
        <button className="location location-button" onClick={() => setShowPlanner(true)}>
          <MapPinned size={20} />
          <span>{originLabel.split(',')[0]} → {destination.label.split(',')[0]}</span>
        </button>
        <div className="vehicle-meta" aria-label="Vehicle connection status">
          <span>{Math.round(weather.temperature_2m)}°F</span>
          <span>{new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          <Signal size={19} />
          <Bluetooth size={19} />
          <Wifi size={19} />
          <CarFront size={21} />
        </div>
        <button className="icon-button planner-button" onClick={() => setShowPlanner(true)} aria-label="Open trip planner">
          <Menu />
        </button>
      </header>

      <nav className="side-nav" aria-label="Waypoint modules">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${active === id ? 'active' : ''}`}
            onClick={() => setActive(id)}
            aria-label={label}
            aria-current={active === id ? 'page' : undefined}
          >
            <Icon size={26} strokeWidth={1.7} />
            <span>{label}</span>
          </button>
        ))}
        <div className="nav-foot">
          <span className="live-dot" />
          {locationStatus}
        </div>
        <button className="nav-settings" onClick={() => setShowPlanner(true)}>
          <Settings size={24} />
          <span>Trip settings</span>
        </button>
      </nav>

      <main className="main-stage">{children}</main>

      {showPlanner && (
        <Modal title="Trip planner" onClose={() => setShowPlanner(false)}>
          <form className="planner-form" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="destination">Destination</label>
            <input
              id="destination"
              value={destinationQuery}
              onChange={(event) => setDestinationQuery(event.target.value)}
              placeholder="Chicago, IL"
            />
            <div className="planner-hint">
              <Gauge size={16} />
              Browser-safe route planning only. This app does not control Tesla native navigation.
            </div>

            <label htmlFor="charge">Starting battery</label>
            <div className="planner-range">
              <Battery size={18} />
              <input
                id="charge"
                type="range"
                min="20"
                max="95"
                value={charge}
                onChange={(event) => setCharge(Number(event.target.value))}
              />
              <strong>{charge}%</strong>
            </div>

            <button className="primary-button" type="button" onClick={() => setShowPlanner(false)}>
              Keep driving
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
