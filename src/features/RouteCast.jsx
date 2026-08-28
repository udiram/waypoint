import { AlertTriangle, Check, CloudRain, Navigation, Wind } from 'lucide-react';
import { useState } from 'react';
import RouteMap from '../components/RouteMap';

const weatherStops = [
  { city: 'Madison', temp: '72°', wind: '10 mph' },
  { city: 'Rockford', temp: '69°', wind: '16 mph', warning: true },
  { city: 'Chicago', temp: '67°', wind: '13 mph' },
];

export default function RouteCast() {
  const [safer, setSafer] = useState(false);
  const [sent, setSent] = useState(false);

  const chooseSafer = () => {
    setSafer(true);
    setSent(true);
    window.setTimeout(() => setSent(false), 3000);
  };

  return (
    <section className="module routecast-module">
      <div className="map-region"><RouteMap safer={safer} /></div>
      <aside className="insight-panel">
        <div className="panel-heading">
          <h1>RouteCast</h1>
          <p>Madison → Chicago</p>
        </div>

        <div className="route-metrics">
          <div><span>Arrive</span><strong>{safer ? '6:46' : '6:42'} PM</strong></div>
          <div><span>At arrival</span><strong>{safer ? '27%' : '23%'}</strong></div>
          <div><span>Travel</span><strong>{safer ? '2h 35m' : '2h 31m'}</strong></div>
          <div><span>Headwind</span><strong className={safer ? '' : 'amber'}>{safer ? '+1%' : '+4%'}</strong></div>
        </div>

        <div className="weather-rail" aria-label="Weather along route">
          {weatherStops.map((stop) => (
            <div key={stop.city} className={stop.warning && !safer ? 'weather-warning' : ''}>
              <span>{stop.city}</span>
              <CloudRain size={30} />
              <strong>{stop.temp}</strong>
              <small><Wind size={15} /> {stop.wind}</small>
            </div>
          ))}
        </div>

        <div className={`route-alert ${safer ? 'resolved' : ''}`}>
          {safer ? <Check /> : <AlertTriangle />}
          <span>{safer ? 'Crosswind avoided via US-20' : 'Crosswind near Rockford · 18 mi'}</span>
        </div>

        <button className="primary-button" onClick={chooseSafer} disabled={safer}>
          <Navigation size={20} fill="currentColor" />
          {safer ? 'Safer route active' : 'Send safer route'}
        </button>
        <button className="secondary-button" onClick={() => { setSafer(false); setSent(false); }}>
          Keep current route
        </button>

        <footer className="module-status">
          <span className="live-dot" />
          {sent ? 'Safer route staged in this demo' : 'Demo vehicle data · Updated now'}
        </footer>
      </aside>
    </section>
  );
}
