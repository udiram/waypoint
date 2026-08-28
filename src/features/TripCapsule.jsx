import { Check, Eye, Lock, Pause, Play, Plus, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { useWaypointContext } from '../App';
import Modal from '../components/Modal';
import { toEncodedPayload } from '../lib/utils';

function MomentPhoto({ frame }) {
  return <div className="moment-photo" style={{ '--frame': frame }} role="img" aria-label="Trip moment photograph" />;
}

export default function TripCapsule() {
  const { capsuleMoments: moments, setCapsuleMoments, destination, originLabel } = useWaypointContext();
  const [recording, setRecording] = useState(true);
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState('Lakefront arrival');
  const [qrSource, setQrSource] = useState('');

  const shareUrl = useMemo(() => {
    const next = new URL(window.location.href);
    next.search = '';
    next.searchParams.set('capsule', toEncodedPayload({ destination, moments }));
    return next.toString();
  }, [destination, moments]);

  useEffect(() => {
    if (modal !== 'share') return undefined;
    let ignore = false;
    QRCode.toDataURL(shareUrl, { width: 360, margin: 1, color: { dark: '#081017', light: '#f4f7f8' } })
      .then((source) => { if (!ignore) setQrSource(source); });
    return () => { ignore = true; };
  }, [modal, shareUrl]);

  const addMoment = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setCapsuleMoments((items) => [...items, { title: draft.trim(), time: 'Now', frame: items.length % 4 }]);
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

      <aside className="focus-panel capsule-focus">
        <div className="capsule-heading"><span>Trip Capsule</span><h1>Lake Michigan weekend</h1><p>{originLabel.split(',')[0]} → {destination.label.split(',')[0]} · {moments.length} moments</p></div>
        <button className={`recording-row ${recording ? 'active' : ''}`} onClick={() => setRecording((value) => !value)}>
          <i /><span>{recording ? 'Recording the trip' : 'Recording paused'}</span>{recording ? <Pause /> : <Play />}
        </button>
        <div className="capsule-actions">
          <button onClick={() => setModal('add')}><Plus /> Add a moment</button>
          <button onClick={() => setModal('preview')}><Eye /> Preview story</button>
          <button onClick={() => setModal('share')}><QrCode /> Share privately</button>
        </div>
        <div className="capsule-preview">{[0, 1, 2, 3].map((frame) => <MomentPhoto key={frame} frame={frame} />)}</div>
        <p className="privacy-line"><Lock /> Location stays private until you share</p>
        <footer className="focus-footer"><Check /><span>Saved locally</span><small>{moments.length > 4 ? 'Last moment saved now' : 'Ready for the next moment'}</small></footer>
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
        <Modal title="Lake Michigan weekend" onClose={() => setModal(null)} wide>
          <div className="preview-hero" />
          <div className="preview-summary"><strong>{moments.length} moments</strong><span>{originLabel.split(',')[0]} → {destination.label.split(',')[0]}</span><span>Saved on this device</span></div>
          <button className="primary-button" onClick={() => setModal(null)}>Looks good</button>
        </Modal>
      )}
      {modal === 'share' && (
        <Modal title="Share trip capsule" onClose={() => setModal(null)}>
          {qrSource ? <img className="qr-image" src={qrSource} alt="QR code for this trip capsule" /> : <div className="qr-loading" />}
          <p className="modal-copy">This private link contains a copy of the capsule moments, not your live location.</p>
          <button className="primary-button" onClick={() => setModal(null)}>Done</button>
        </Modal>
      )}
    </section>
  );
}
