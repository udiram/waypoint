import { ExternalLink, Landmark, Pause, Play, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWaypointContext } from '../App';
import { formatDistanceMiles } from '../lib/utils';
import { getNarrationUrl, speakWithSystemVoice } from '../lib/voice';

const waveform = [12, 20, 29, 18, 36, 26, 44, 32, 51, 25, 41, 29, 18, 35, 22, 16, 27, 15, 12, 9];
const formatTime = (total) => `${Math.floor(total / 60).toString().padStart(2, '0')}:${Math.floor(total % 60).toString().padStart(2, '0')}`;

export default function RoadLore() {
  const { lore, loreState, originLabel } = useWaypointContext();
  const current = lore[0];
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engine, setEngine] = useState('idle');
  const [loadPct, setLoadPct] = useState(0);
  const audioRef = useRef(null);
  const duration = audioRef.current?.duration || Math.max(25, Math.round((current?.summary?.split(/\s+/).length || 80) / 2.4));
  useEffect(() => () => { audioRef.current?.pause(); window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { audioRef.current?.pause(); audioRef.current = null; setPlaying(false); setProgress(0); setEngine('idle'); }, [current?.id]);

  const toggle = async () => {
    if (!current) return;
    if (playing) { audioRef.current?.pause(); window.speechSynthesis?.pause(); setPlaying(false); return; }
    setPlaying(true);
    if (audioRef.current) { await audioRef.current.play(); return; }
    try {
      setEngine('loading');
      const url = await getNarrationUrl(current.title, current.summary, setLoadPct);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener('timeupdate', () => setProgress(audio.currentTime));
      audio.addEventListener('ended', () => setPlaying(false));
      setEngine('kokoro');
      await audio.play();
    } catch {
      setEngine('system');
      speakWithSystemVoice(current.summary, { onEnd: () => setPlaying(false) });
    }
  };

  if (!current) return <section className="module roadlore-module empty-module"><div className="empty-state"><Landmark /><span>RoadLore</span><h1>{loreState.status === 'loading' ? 'Finding nearby stories…' : 'No live stories yet'}</h1><p>{loreState.error || 'Set an origin so Waypoint can find real nearby Wikipedia stories.'}</p></div></section>;
  const excerpt = current.summary.split(/(?<=[.!?])\s+/).slice(0, 3);
  return (
    <section className="module roadlore-module">
      <div className="story-canvas" style={current.thumbnail ? { backgroundImage: `linear-gradient(90deg, rgba(6,12,17,.16), rgba(6,12,17,.82)), url("${current.thumbnail}")` } : undefined} role="img" aria-label={`View connected to ${current.title}`}>
        <div className="lore-route"><i /><i /><i /></div>
        <div className="lore-marker current"><Landmark /><span><strong>{current.title}</strong><small>{formatDistanceMiles(current.distanceMeters)} from {originLabel.split(',')[0]}</small></span></div>
        {lore[1] && <div className="lore-marker next"><Volume2 /><span><strong>{lore[1].title}</strong><small>{formatDistanceMiles(lore[1].distanceMeters)} away</small></span></div>}
      </div>
      <aside className="focus-panel story-focus">
        <div className="story-title"><i><Landmark /></i><div><h1>{current.title}</h1><p>Live nearby story · Wikipedia</p></div></div>
        <div className="story-player"><button className="story-play" onClick={toggle}>{playing ? <Pause /> : <Play fill="currentColor" />}</button><div className="waveform">{waveform.map((height, index) => <i key={index} style={{ height }} className={index < Math.round(progress / duration * waveform.length) ? 'played' : ''} />)}</div><div className="story-time"><span>{formatTime(progress)}</span><i>/</i><span>{formatTime(duration)}</span></div></div>
        <input className="story-seek" type="range" min="0" max={Math.ceil(duration)} value={Math.min(progress, duration)} onChange={(event) => { const value = Number(event.target.value); setProgress(value); if (audioRef.current) audioRef.current.currentTime = value; }} />
        <p className="voice-status">{engine === 'loading' ? `Preparing on-device voice${loadPct ? ` · ${loadPct}%` : ''}` : engine === 'kokoro' ? 'Natural voice · generated on-device' : engine === 'system' ? 'System voice' : 'Tap play for on-device narration'}</p>
        {excerpt.map((text, index) => <p key={text} className={`story-excerpt${index ? ' muted' : ''}`}>{text}</p>)}
        <div className="story-tools"><a href={current.url} target="_blank" rel="noreferrer"><ExternalLink /> Read source</a></div>
      </aside>
    </section>
  );
}
