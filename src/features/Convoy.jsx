import { Check, Copy, QrCode, Radio, Route, Send, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWaypointContext } from '../App';
import Modal from '../components/Modal';
import RouteMap from '../components/RouteMap';
import { convoyMembers } from '../data';

export default function Convoy() {
  const { destination, position, roomCode, routeState, vehicleProfile } = useWaypointContext();
  const [sent, setSent] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [connection, setConnection] = useState('connecting');
  const [liveRoom, setLiveRoom] = useState(null);
  const [qrSource, setQrSource] = useState('');
  const socketRef = useRef(null);

  const inviteUrl = useMemo(() => {
    const next = new URL(window.location.href);
    next.search = '';
    next.searchParams.set('room', roomCode);
    return next.toString();
  }, [roomCode]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      setConnection('live');
      socket.send(JSON.stringify({
        type: 'join',
        roomCode,
        profile: {
          ...vehicleProfile,
          eta: '6:42 PM',
          location: { latitude: position.latitude, longitude: position.longitude },
          status: 'On route',
        },
      }));
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'snapshot') setLiveRoom(message.room);
    });
    socket.addEventListener('close', () => setConnection('offline'));
    socket.addEventListener('error', () => setConnection('offline'));
    return () => socket.close();
  }, [position.latitude, position.longitude, roomCode, vehicleProfile]);

  useEffect(() => {
    if (!showQr) return undefined;
    let ignore = false;
    QRCode.toDataURL(inviteUrl, { width: 360, margin: 1, color: { dark: '#081017', light: '#f4f7f8' } })
      .then((source) => { if (!ignore) setQrSource(source); });
    return () => { ignore = true; };
  }, [inviteUrl, showQr]);

  const roster = liveRoom?.members?.length
    ? liveRoom.members.map((member, index) => ({ ...member, x: 28 + index * 14, y: 25 + index * 14 }))
    : convoyMembers.map((member, index) => ({ ...member, id: member.name, x: 28 + index * 14, y: 25 + index * 14 }));

  const syncStop = () => {
    setSent(true);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'decision', payload: { title: 'Regroup in Rockford', detail: '11-minute charging stop', status: 'Rockford stop synced' } }));
    }
  };

  return (
    <section className="module convoy-module">
      <div className="map-region">
        <RouteMap mode="convoy" route={routeState.primary} comparisonRoute={routeState.safer} members={roster} labels={['Madison', 'Rockford', destination.label.split(',')[0]]} />
      </div>

      <aside className="focus-panel convoy-focus">
        <div className="convoy-heading"><div><span>Live room {roomCode}</span><h1>Lakefront run</h1></div><i className={connection}><Radio /></i></div>
        <div className="convoy-roster">
          {roster.slice(0, 5).map((member) => (
            <div key={member.id || member.name} className="convoy-row" style={{ '--member': member.color }}>
              <i />
              <div><strong>{member.name}</strong><span>{member.status || (member.name === 'Jun' ? 'Charging' : 'On route')}</span></div>
              <b>{member.charge}</b>
              <time>{member.eta || '6:42 PM'}</time>
            </div>
          ))}
        </div>

        <div className={`convoy-decision ${sent ? 'resolved' : ''}`}>
          {sent ? <Check /> : <Users />}
          <div><span>Group decision</span><strong>{sent ? 'Regroup in Rockford' : 'Jun needs 11 minutes'}</strong><small>{sent ? 'Shared with everyone in the room' : 'A short stop keeps the group together'}</small></div>
        </div>

        <button className="primary-button" onClick={syncStop} disabled={sent}><Send /> {sent ? 'Stop synced' : 'Sync the Rockford stop'}</button>
        <button className="quiet-action" onClick={() => setSent(false)}><Route /> Continue separately</button>
        <button className="invite-action" onClick={() => setShowQr(true)}><QrCode /> Invite passengers</button>

        <footer className="focus-footer"><span>{roster.length} connected</span><small>{connection === 'live' ? 'Live room connected' : 'Demo roster · reconnecting'}</small></footer>
      </aside>

      {showQr && (
        <Modal title={`Join room ${roomCode}`} onClose={() => setShowQr(false)}>
          {qrSource ? <img className="qr-image" src={qrSource} alt={`QR code to join Convoy room ${roomCode}`} /> : <div className="qr-loading" />}
          <p className="modal-copy">Scan from another phone or Tesla browser. The room shares trip status, not Tesla credentials.</p>
          <button className="copy-link" onClick={() => navigator.clipboard?.writeText(inviteUrl)}><Copy /> Copy invite link</button>
          <button className="primary-button" onClick={() => setShowQr(false)}>Done</button>
        </Modal>
      )}
    </section>
  );
}
