import { Binoculars, Check, Lightbulb, Lock, MapPin, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { questStops } from '../data';

export default function PassengerQuest() {
  const [found, setFound] = useState(false);
  const [hint, setHint] = useState(false);
  const score = found ? 1490 : 1240;
  const stops = useMemo(() => questStops.map((stop, index) => {
    if (!found) return stop;
    if (index === 3) return { ...stop, active: false, done: true };
    if (index === 4) return { ...stop, active: true };
    return stop;
  }), [found]);

  return (
    <section className="module quest-module">
      <div className="quest-scene">
        <div className="quest-heading"><h1>Passenger Quest</h1><p>I-90 Field Guide</p></div>
        <div className="quest-card">
          <Binoculars />
          <div>
            <span>{found ? 'Next discovery' : 'Active challenge'}</span>
            <h2>{found ? 'Spot the Skyway' : 'Find the giant orange moose'}</h2>
            <p><MapPin /> {found ? 'Watch the skyline in 23 miles' : hint ? 'Look for the hill beyond the lake on your right' : 'Look right in 6 miles'}</p>
          </div>
          <button className="primary-button" onClick={() => { setFound(true); setHint(false); }} disabled={found}><Check /> {found ? 'Discovery logged' : 'Found it'}</button>
          <button className="secondary-button" onClick={() => setHint((value) => !value)}><Lightbulb /> {hint ? 'Hide hint' : 'Give me a hint'}</button>
        </div>

        <div className="quest-progress" aria-label={`${found ? 5 : 4} of 9 discoveries`}>
          {stops.map((stop) => (
            <div key={stop.label} className={`${stop.done ? 'done' : ''} ${stop.active ? 'active' : ''}`}>
              <i>{stop.done ? <Check /> : stop.active ? <Binoculars /> : <MapPin />}</i>
              <span>{stop.label}</span>
            </div>
          ))}
        </div>
        <div className="quest-status">Next discovery in <strong>{found ? '23' : '6'} miles</strong></div>
      </div>

      <aside className="score-panel">
        <Trophy />
        <span>Score</span>
        <strong>{score.toLocaleString()}</strong>
        <div className="score-players">
          <div><span>Ari</span><strong>{found ? 970 : 720}</strong></div>
          <div><span>Sam</span><strong>520</strong></div>
        </div>
        <p><Lock /> Passenger controls only</p>
      </aside>
    </section>
  );
}
