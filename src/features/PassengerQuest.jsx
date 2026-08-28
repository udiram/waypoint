import { Binoculars, Check, ExternalLink, Lightbulb, MapPin, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWaypointContext } from '../App';
import { STORAGE_KEYS, formatDistanceMiles, loadStoredValue, saveStoredValue } from '../lib/utils';

export default function PassengerQuest() {
  const { lore, loreState } = useWaypointContext();
  const [foundIds, setFoundIds] = useState(() => loadStoredValue(STORAGE_KEYS.quest, []));
  const [hint, setHint] = useState(false);
  useEffect(() => saveStoredValue(STORAGE_KEYS.quest, foundIds), [foundIds]);
  const current = lore.find((item) => !foundIds.includes(item.id));
  if (!lore.length) return <section className="module quest-module empty-module"><div className="empty-state"><Binoculars /><span>Passenger Quest</span><h1>{loreState.status === 'loading' ? 'Building live discoveries…' : 'No nearby discoveries yet'}</h1><p>{loreState.error || 'Set an origin to create challenges from real nearby places.'}</p></div></section>;
  const complete = !current;
  return <section className="module quest-module">
    <div className="quest-scene"><div className="quest-heading"><h1>Passenger Quest</h1><p>Live local field guide</p></div>
      <div className="quest-card"><Binoculars /><div><span>{complete ? 'Route discoveries complete' : 'Nearby discovery'}</span><h2>{complete ? 'You found every live place' : `Find out: ${current.title}`}</h2><p><MapPin /> {complete ? `${lore.length} places logged on this device` : `${formatDistanceMiles(current.distanceMeters)} from the selected origin`}</p>{hint && current && <p>{current.summary.split(/(?<=[.!?])\s+/)[0]}</p>}</div>
        <button className="primary-button" disabled={complete} onClick={() => { setFoundIds((ids) => [...ids, current.id]); setHint(false); }}><Check /> {complete ? 'All logged' : 'I found it'}</button>
        {!complete && <button className="secondary-button" onClick={() => setHint((value) => !value)}><Lightbulb /> {hint ? 'Hide hint' : 'Show a real clue'}</button>}
        {!complete && <a className="quiet-action" href={current.url} target="_blank" rel="noreferrer"><ExternalLink /> Verify source</a>}
      </div>
      <div className="quest-progress">{lore.map((item) => <div key={item.id} className={`${foundIds.includes(item.id) ? 'done' : ''} ${item.id === current?.id ? 'active' : ''}`}><i>{foundIds.includes(item.id) ? <Check /> : <MapPin />}</i><span>{item.title}</span></div>)}</div>
      <div className="quest-status">Actual progress <strong>{foundIds.filter((id) => lore.some((item) => item.id === id)).length} / {lore.length}</strong></div>
    </div>
    <aside className="score-panel"><Trophy /><span>Discoveries</span><strong>{foundIds.length}</strong><div className="score-players"><div><span>This device</span><strong>{foundIds.length * 100}</strong></div></div><p>Derived from live Wikipedia places</p></aside>
  </section>;
}
