import { Check, Eye, Lock, Pause, Play, Plus, QrCode } from 'lucide-react';
import { useState } from 'react';
import { initialMoments } from '../data';
import Modal from '../components/Modal';

function MomentPhoto({ frame }) {
  return <div className="moment-photo" style={{ '--frame': frame }} role="img" aria-label="Trip moment photograph" />;
}

export default function TripCapsule() {
  const [moments, setMoments] = useState(initialMoments);
  const [recording, setRecording] = useState(true);
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState('Lakefront arrival');

  const addMoment = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setMoments((items) => [...items, { title: draft.trim(), time: 'Now', frame: items.length % 4 }]);
    setDraft('');
    setModal(null);
  };

  return (
    <section className="module capsule-module">
      <div className="capsule-timeline">
        <div className="capsule-route-line" />
        {moments.slice(0, 5).map((moment, index) => (
          <article key={`${moment.title}-${index}`} className="moment-row">
            <div className="moment-copy"><span>{index + 1}</span><div><strong>{moment.title}</strong><time>{moment.time}</time></div></div>
            <MomentPhoto frame={moment.frame} />
            <i className="timeline-dot" />
          </article>
        ))}
      </div>

      <aside className="capsule-panel">
        <div className="panel-heading"><h1>Trip Capsule</h1><h2>Lake Michigan Weekend</h2><p>142 miles · {moments.length} moments · Today</p></div>
        <button className={`recording-row ${recording ? 'active' : ''}`} onClick={() => setRecording((value) => !value)}>
          <i />
          <span>{recording ? 'Recording automatically' : 'Recording paused'}</span>
          {recording ? <Pause /> : <Play />}
        </button>

        <div className="capsule-actions">
          <button onClick={() => setModal('add')}><Plus /> Add a moment</button>
          <button onClick={() => setModal('preview')}><Eye /> Preview capsule</button>
          <button onClick={() => setModal('share')}><QrCode /> Share with QR</button>
        </div>

        <div className="capsule-preview">
          {[0,1,2,3].map((frame) => <MomentPhoto key={frame} frame={frame} />)}
        </div>
        <p className="privacy-line"><Lock /> Location stays private until you share</p>
        <footer className="module-status"><Check /> Last moment saved {moments.length > 4 ? 'now' : '11 min ago'}</footer>
      </aside>

      {modal === 'add' && (
        <Modal title="Add a moment" onClose={() => setModal(null)}>
          <form className="moment-form" onSubmit={addMoment}>
            <label htmlFor="moment-title">Moment title</label>
            <input id="moment-title" value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
            <button className="primary-button" type="submit"><Plus /> Save moment</button>
          </form>
        </Modal>
      )}
      {modal === 'preview' && (
        <Modal title="Lake Michigan Weekend" onClose={() => setModal(null)} wide>
          <div className="preview-hero" />
          <div className="preview-summary"><strong>142 miles</strong><span>{moments.length} moments</span><span>Madison → Chicago</span></div>
          <button className="primary-button" onClick={() => setModal(null)}>Looks good</button>
        </Modal>
      )}
      {modal === 'share' && (
        <Modal title="Share trip capsule" onClose={() => setModal(null)}>
          <div className="qr-demo">{Array.from({ length: 81 }, (_, index) => <i key={index} className={(index * 5 + index % 7) % 3 === 0 ? 'dark' : ''} />)}</div>
          <p className="modal-copy">This demo code shares the capsule preview, not your private live location.</p>
          <button className="primary-button" onClick={() => setModal(null)}>Done</button>
        </Modal>
      )}
    </section>
  );
}
