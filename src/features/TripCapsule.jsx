import { Clock, Eye, Lock, MapPin, Plus, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { useWaypointContext } from '../App';
import Modal from '../components/Modal';
import { formatClock, toEncodedPayload } from '../lib/utils';

export default function TripCapsule() {
  const { capsuleMoments: moments, setCapsuleMoments, destination, originLabel, position } = useWaypointContext();
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState('');
  const [includePlace, setIncludePlace] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [qrSource, setQrSource] = useState('');
  const title = `${destination?.label?.split(',')[0] || 'Open road'} · ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date())}`;
  const shareUrl = useMemo(() => { const next = new URL(location.href); next.search = ''; const portableMoments = moments.map(({ photo: _photo, ...moment }) => moment); next.searchParams.set('capsule', toEncodedPayload({ destination, moments: portableMoments })); return next.toString(); }, [destination, moments]);
  useEffect(() => { if (modal !== 'share') return undefined; let ignore = false; QRCode.toDataURL(shareUrl, { width: 360, margin: 1, color: { dark: '#081017', light: '#f4f7f8' } }).then((source) => { if (!ignore) setQrSource(source); }); return () => { ignore = true; }; }, [modal, shareUrl]);
  const preparePhoto = (file) => {
    if (!file) { setPhoto(null); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        setPhoto(canvas.toDataURL('image/jpeg', .78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
  const addMoment = (event) => { event.preventDefault(); if (!draft.trim()) return; const createdAt = new Date().toISOString(); setCapsuleMoments((items) => [...items, { id: crypto.randomUUID(), title: draft.trim(), createdAt, place: includePlace ? originLabel : null, coordinates: includePlace && position ? position : null, photo }]); setDraft(''); setIncludePlace(false); setPhoto(null); setModal(null); };
  return <section className="module capsule-module">
    <div className="capsule-timeline"><div className="capsule-route-line" />{moments.length ? moments.slice(-8).map((moment, index) => <article key={moment.id || `${moment.title}-${index}`} className="moment-row"><div className="moment-copy"><span>{index + 1}</span><div><strong>{moment.title}</strong><time>{moment.createdAt ? `${new Date(moment.createdAt).toLocaleDateString()} · ${formatClock(moment.createdAt)}` : moment.time}</time>{moment.place && <small><MapPin /> {moment.place}</small>}</div></div>{moment.photo ? <img className="moment-photo captured-photo" src={moment.photo} alt="Captured trip moment" /> : <div className="moment-photo text-moment"><Clock /><span>Saved by you</span></div>}<i className="timeline-dot" /></article>) : <div className="capsule-empty"><Clock /><h2>No moments yet</h2><p>Trip Capsule starts empty. Add only what actually happened.</p></div>}</div>
    <aside className="focus-panel capsule-focus"><div className="capsule-heading"><span>Trip Capsule</span><h1>{title}</h1><p>{originLabel} {destination ? `→ ${destination.label}` : ''} · {moments.length} real moments</p></div>
      <div className="recording-row"><i /><span>Nothing is recorded automatically</span><Lock /></div>
      <div className="capsule-actions"><button onClick={() => setModal('add')}><Plus /> Add a moment</button><button onClick={() => setModal('preview')} disabled={!moments.length}><Eye /> Preview story</button><button onClick={() => setModal('share')} disabled={!moments.length}><QrCode /> Share a copy</button></div>
      <p className="privacy-line"><Lock /> Saved locally until you explicitly share</p><footer className="focus-footer"><span>{moments.length} saved on this device</span><small>Real timestamps · no stock moments</small></footer>
    </aside>
    {modal === 'add' && <Modal title="Add a real moment" onClose={() => setModal(null)}><form className="moment-form" onSubmit={addMoment}><label htmlFor="moment-title">What happened?</label><input id="moment-title" value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus placeholder="e.g. Saw the sunset over the lake" /><label htmlFor="moment-photo">Optional photo from this trip</label><input id="moment-photo" className="photo-input" type="file" accept="image/*" capture="environment" onChange={(event) => preparePhoto(event.target.files?.[0])} />{photo && <img className="photo-preview" src={photo} alt="Moment preview" />}<label className="check-row"><input type="checkbox" checked={includePlace} onChange={(event) => setIncludePlace(event.target.checked)} /> Include the current place in this moment</label><button className="primary-button" type="submit"><Plus /> Save with current time</button></form></Modal>}
    {modal === 'preview' && <Modal title={title} onClose={() => setModal(null)} wide><div className="preview-summary"><strong>{moments.length} moments</strong><span>{moments[0]?.createdAt ? new Date(moments[0].createdAt).toLocaleString() : 'Imported moment'} → now</span><span>Saved on this device</span></div>{moments.map((moment) => <p key={moment.id || moment.title}><strong>{moment.title}</strong> · {moment.createdAt ? formatClock(moment.createdAt) : moment.time}</p>)}<button className="primary-button" onClick={() => setModal(null)}>Done</button></Modal>}
    {modal === 'share' && <Modal title="Share trip capsule" onClose={() => setModal(null)}>{qrSource ? <img className="qr-image" src={qrSource} alt="QR code for this trip capsule" /> : <div className="qr-loading" />}<p className="modal-copy">This link contains a static text copy of the moments you created—not your live location. Photos stay on this device.</p><button className="primary-button" onClick={() => setModal(null)}>Done</button></Modal>}
  </section>;
}
