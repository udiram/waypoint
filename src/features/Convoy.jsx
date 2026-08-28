import { AlertTriangle, CarFront, Check, QrCode, Route, Send } from 'lucide-react';
import { useState } from 'react';
import { convoyMembers } from '../data';
import Modal from '../components/Modal';
import RouteMap from '../components/RouteMap';

export default function Convoy() {
  const [sent, setSent] = useState(false);
  const [showQr, setShowQr] = useState(false);

  return (
    <section className="module convoy-module">
      <div className="map-region"><RouteMap mode="convoy" /></div>
      <aside className="convoy-panel">
        <div className="panel-heading"><h1>Convoy</h1><h2>Lakefront Run</h2><p>Madison → Chicago</p></div>
        <div className="convoy-roster">
          {convoyMembers.map((member) => (
            <div key={member.name} className="convoy-row" style={{ '--member': member.color }}>
              <CarFront />
              <strong>{member.name}</strong>
              <span className={member.charge === 'Charging' ? 'amber' : ''}>{member.charge}</span>
              <time>{sent && member.name !== 'Jun' ? member.eta.replace('6:', '6:5') : member.eta}</time>
            </div>
          ))}
        </div>

        <div className={`route-alert ${sent ? 'resolved' : ''}`}>
          {sent ? <Check /> : <AlertTriangle />}
          <span>{sent ? 'Rockford stop synced in this demo' : 'Jun needs 11 min at Rockford'}</span>
        </div>

        <div className="group-decision">
          <span>Group decision</span>
          <h2>{sent ? 'Regroup in Rockford' : 'Wait in Rockford'}</h2>
          <button className="primary-button" onClick={() => setSent(true)} disabled={sent}><Send /> {sent ? 'Stop synced' : 'Sync group stop'}</button>
          <button className="secondary-button" onClick={() => setSent(false)}><Route /> Continue separately</button>
        </div>

        <button className="text-action" onClick={() => setShowQr(true)}><QrCode /> Invite with QR</button>
        <footer className="module-status"><span className="live-dot" /> 4 demo vehicles connected · Updated now</footer>
      </aside>

      {showQr && (
        <Modal title="Invite to Lakefront Run" onClose={() => setShowQr(false)}>
          <div className="qr-demo" aria-label="Demo invitation QR code">
            {Array.from({ length: 81 }, (_, index) => <i key={index} className={(index * 7 + index % 5) % 3 === 0 ? 'dark' : ''} />)}
          </div>
          <p className="modal-copy">Passengers scan this code to join the live convoy without sharing Tesla credentials.</p>
          <button className="primary-button" onClick={() => setShowQr(false)}>Done</button>
        </Modal>
      )}
    </section>
  );
}
