import { AlertTriangle, Check, Moon, Save, Sunrise, TentTree, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWaypointContext } from '../App';
import { STORAGE_KEYS, formatClock, loadStoredValue, saveStoredValue } from '../lib/utils';

function ForecastChart({ hours }) {
  const values = hours.map((hour) => hour.temperature);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const points = values.map((value, index) => `${45 + index * 72},${320 - ((value - low) / Math.max(1, high - low)) * 180}`).join(' ');
  return <div className="camp-chart live-camp-chart"><svg viewBox="0 0 900 430" preserveAspectRatio="none"><defs><linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#79c8ff" stopOpacity=".32"/><stop offset="1" stopColor="#79c8ff" stopOpacity="0"/></linearGradient></defs><polyline className="outside-path" points={points} /><polygon className="forecast-area" points={`45,370 ${points} ${45 + (hours.length - 1) * 72},370`} /></svg><div className="forecast-labels">{hours.map((hour, index) => <div key={hour.time} style={{ left: `${5 + index * 8}%` }}><strong>{Math.round(hour.temperature)}°</strong><span>{index % 2 === 0 ? formatClock(hour.time) : ''}</span></div>)}</div></div>;
}

export default function Campglass() {
  const { charge, overnightState, nearbyState, originLabel } = useWaypointContext();
  const [target, setTarget] = useState(() => loadStoredValue(STORAGE_KEYS.camp, { target: 68 }).target);
  const [saved, setSaved] = useState(false);
  useEffect(() => saveStoredValue(STORAGE_KEYS.camp, { target }), [target]);
  const hours = overnightState.hours || [];
  if (!hours.length) return <section className="module campglass-module empty-module"><div className="empty-state"><Moon /><span>Campglass</span><h1>{overnightState.status === 'loading' ? 'Loading the overnight forecast…' : 'No forecast yet'}</h1><p>{overnightState.error || 'Set an origin to plan with real local weather and nearby campsites.'}</p></div></section>;
  const low = Math.round(Math.min(...hours.map((hour) => hour.temperature)));
  const maxGust = Math.round(Math.max(...hours.map((hour) => hour.gust || 0)));
  const camp = nearbyState.campsites?.[0];
  return <section className="module campglass-module">
    <div className="camp-main"><div className="panel-heading"><span>Campglass</span><h1>Plan until sunrise</h1><p>{camp?.name || originLabel} · public forecast</p></div>
      <div className="camp-metrics"><div><strong>{Number.isFinite(charge) ? `${charge}%` : 'Unset'}</strong><span>manual battery</span></div><div><strong>{target}°F</strong><span>comfort assumption</span></div><div><strong>{low}°F</strong><span>forecast low</span></div></div>
      <ForecastChart hours={hours} /><div className="sunrise-label"><Sunrise /> {overnightState.sunrise ? formatClock(overnightState.sunrise) : 'Sunrise unavailable'}</div>
    </div>
    <aside className="focus-panel camp-controls"><div className="camp-active"><TentTree /><div><strong>Planning only</strong><span>Waypoint cannot see or change Tesla Camp Mode.</span></div></div>
      <div className="reserve-control"><label htmlFor="target">Cabin target assumption <strong>{target}°F</strong></label><input id="target" type="range" min="58" max="76" value={target} onChange={(event) => { setTarget(Number(event.target.value)); setSaved(false); }} /><p>No battery reserve is predicted without vehicle consumption data.</p></div>
      <div className="route-alert"><AlertTriangle /><span>Peak forecast gust: {maxGust} mph.</span></div>
      <button className="primary-button" onClick={() => setSaved(true)}>{saved ? <Check /> : <Save />}{saved ? 'Scenario saved locally' : 'Save planning scenario'}</button>
      <footer className="camp-footer"><Wind /> {hours.length} live forecast hours <span>•</span> Updated {formatClock(overnightState.updatedAt || Date.now())}</footer>
    </aside>
  </section>;
}
