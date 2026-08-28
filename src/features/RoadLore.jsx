import { Bookmark, Landmark, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { stories } from '../data';

function formatTime(total) {
  const minutes = Math.floor(total / 60).toString().padStart(2, '0');
  const seconds = Math.floor(total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const waveform = [12, 20, 29, 18, 36, 26, 44, 32, 51, 25, 41, 29, 18, 35, 22, 16, 27, 15, 12, 9];

export default function RoadLore() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(198);
  const [saved, setSaved] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [quiet, setQuiet] = useState(true);
  const speechRef = useRef(null);
  const current = stories[0];

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setProgress((value) => Math.min(value + 1, current.duration)), 1000);
    return () => window.clearInterval(timer);
  }, [playing, current.duration]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const togglePlayback = () => {
    if (playing) {
      window.speechSynthesis?.pause();
      setPlaying(false);
      return;
    }
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused && speechRef.current) {
        window.speechSynthesis.resume();
      } else {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(current.body);
        utterance.rate = 0.9;
        utterance.pitch = 0.9;
        utterance.onend = () => setPlaying(false);
        speechRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    }
    setPlaying(true);
  };

  return (
    <section className="module roadlore-module">
      <div className="story-canvas" role="img" aria-label="Glacial landscape connected to the current route">
        <div className="lore-route" aria-hidden="true"><i /><i /><i /></div>
        <div className="lore-marker current"><Landmark /><span><strong>The ice that shaped Wisconsin</strong><small>Playing near Janesville</small></span></div>
        <div className="lore-marker next"><Volume2 /><span><strong>Driftless roots</strong><small>Near Beloit</small></span></div>
      </div>

      <aside className="focus-panel story-focus">
        <div className="story-title">
          <i><Landmark /></i>
          <div><h1>The ice that shaped Wisconsin</h1><p>Playing near Janesville</p></div>
        </div>

        <div className="story-player">
          <button className="story-play" onClick={togglePlayback} aria-label={playing ? 'Pause story' : 'Play story'}>
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          </button>
          <div className="waveform" aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{ height }} className={index < 11 ? 'played' : ''} />)}</div>
          <div className="story-time"><span>{formatTime(progress)}</span><i>/</i><span>{formatTime(current.duration)}</span></div>
        </div>

        <input className="story-seek" aria-label="Story progress" type="range" min="0" max={current.duration} value={progress} onChange={(event) => setProgress(Number(event.target.value))} />

        <p className="story-excerpt">Long before highways and towns, ice moved like a slow river across the land.</p>
        <p className="story-excerpt muted">It carved valleys, left behind ridges, and shaped the Wisconsin we know today.</p>

        <div className="story-tools">
          <button className={saved ? 'active' : ''} onClick={() => setSaved((value) => !value)}><Bookmark fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save story'}</button>
          <button className={autoPlay ? 'active' : ''} onClick={() => setAutoPlay((value) => !value)}><Play /> Auto-play</button>
          <button className={quiet ? 'active' : ''} onClick={() => setQuiet((value) => !value)}>{quiet ? <VolumeX /> : <Volume2 />} Quiet for directions</button>
        </div>
      </aside>
    </section>
  );
}
