import { Bookmark, ChevronRight, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { stories } from '../data';

function formatTime(total) {
  const minutes = Math.floor(total / 60).toString().padStart(2, '0');
  const seconds = Math.floor(total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

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
      <div className="story-canvas" role="img" aria-label="Glacial topographic landscape with route marker">
        <div className="story-canvas-label"><Volume2 size={18} /> Listening along I-90 East</div>
      </div>
      <aside className="story-panel">
        <div className="panel-heading"><h1>RoadLore</h1></div>
        <h2>{current.title}</h2>
        <p className="accent-copy">Plays automatically in <strong>{current.distance}</strong></p>

        <div className="play-progress">
          <span>{formatTime(progress)}</span>
          <input aria-label="Story progress" type="range" min="0" max={current.duration} value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
          <span>{formatTime(current.duration)}</span>
        </div>
        <div className="playback-controls">
          <button className="icon-button" aria-label="Previous story"><SkipBack /></button>
          <button className="play-button" onClick={togglePlayback} aria-label={playing ? 'Pause story' : 'Play story'}>
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          </button>
          <button className="icon-button" aria-label="Next story"><SkipForward /></button>
        </div>

        <button className="primary-button outline" onClick={togglePlayback}>{playing ? <Pause /> : <Play fill="currentColor" />} {playing ? 'Pause story' : 'Play now'}</button>
        <button className={`secondary-button save-button ${saved ? 'saved' : ''}`} onClick={() => setSaved((value) => !value)}><Bookmark fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved for later' : 'Save for later'}</button>

        <div className="upcoming-stories">
          <h3>Upcoming stories</h3>
          {stories.slice(1).map((story) => (
            <button key={story.title}><span>{story.title}</span><small>{story.distance}</small><ChevronRight /></button>
          ))}
        </div>

        <div className="toggle-row">
          <span><Play size={18} /> Auto-play stories</span>
          <button className={`switch ${autoPlay ? 'on' : ''}`} onClick={() => setAutoPlay((value) => !value)} aria-label="Toggle auto-play"><i /></button>
        </div>
        <div className="toggle-row">
          <span>{quiet ? <VolumeX size={18} /> : <Volume2 size={18} />} Quiet during directions</span>
          <button className={`switch ${quiet ? 'on' : ''}`} onClick={() => setQuiet((value) => !value)} aria-label="Toggle quiet during directions"><i /></button>
        </div>
      </aside>
    </section>
  );
}
