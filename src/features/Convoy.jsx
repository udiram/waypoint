import { Copy, QrCode, Radio, Route, Send, Users } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWaypointContext } from '../App';
import Modal from '../components/Modal';
import RouteMap from '../components/RouteMap';

export default function Convoy() {
  const { destination, position, roomCode, routeState, vehicleProfile } = useWaypointContext();
  const [showQr, setShowQr] = useState(false);
  const [connection, setConnection] = useState('connecting');
  const [liveRoom, setLiveRoom] = useState(null);
  const [qrSource, setQrSource] = useState('');
  const socketRef = useRef(null);
  const profileRef = useRef(vehicleProfile);
  profileRef.current = vehicleProfile;
  const inviteUrl = useMemo(() => { const next = new URL(window.location.href); next.search = ''; next.searchParams.set('room', roomCode); return next.toString(); }, [roomCode]);

  useEffect(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws`);
    socketRef.current = socket;
    socket.addEventListener('open', () => { setConnection('live'); socket.send(JSON.stringify({ type: 'join', roomCode, profile: { ...profileRef.current, location: position } })); });
    socket.addEventListener('message', (event) => { try { const message = JSON.parse(event.data); if (message.type === 'snapshot') setLiveRoom(message.room); } catch { /* ignore malformed server message */ } });
    socket.addEventListener('close', () => setConnection('offline'));
    socket.addEventListener('error', () => setConnection('offline'));
    return () => socket.close();
  }, [roomCode]);

  useEffect(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: 'state', payload: { ...vehicleProfile, location: position, status: position ? 'Sharing current trip status' : 'Location not shared' } }));
  }, [position, vehicleProfile]);

  useEffect(() => {
    if (!showQr) return undefined;
    let ignore = false;
    QRCode.toDataURL(inviteUrl, { width: 360, margin: 1, color: { dark: '#081017', light: '#f4f7f8' } }).then((source) => { if (!ignore) setQrSource(source); });
    return () => { ignore = true; };
  }, [inviteUrl, showQr]);

  const roster = liveRoom?.members || [];
  const shareRoute = () => {
    if (socketRef.current?.readyState !== WebSocket.OPEN || !destination) return;
    socketRef.current.send(JSON.stringify({ type: 'decision', payload: { title: `Route to ${destination.label}`, detail: routeState.primary ? `${Math.round(routeState.primary.distance / 1609.344)} miles on the current live route` : 'Destination shared' } }));
  };

  return <section className="module convoy-module">
    <div className="map-region"><RouteMap mode="convoy" route={routeState.primary} comparisonRoute={routeState.safer} members={roster} labels={['Start', routeState.midpointLabel?.split(',')[0] || 'Mid-route', destination?.label?.split(',')[0] || 'Arrival']} /></div>
    <aside className="focus-panel convoy-focus"><div className="convoy-heading"><div><span>Live room {roomCode}</span><h1>{destination ? `Trip to ${destination.label.split(',')[0]}` : 'Convoy room'}</h1></div><i className={connection}><Radio /></i></div>
      <div className="convoy-roster">{roster.length ? roster.map((member) => <div key={member.id} className="convoy-row" style={{ '--member': member.color }}><i /><div><strong>{member.name}</strong><span>{member.status}</span></div><b>{member.charge}</b><time>{member.eta}</time></div>) : <div className="empty-roster"><Users /><strong>{connection === 'live' ? 'Joining the room…' : 'Room offline'}</strong><span>No placeholder passengers are shown.</span></div>}</div>
      <div className="convoy-decision"><Users /><div><span>Latest shared plan</span><strong>{liveRoom?.decision?.title || (roster.length <= 1 ? 'Only you are connected' : 'No decision shared')}</strong><small>{liveRoom?.decision?.detail || 'Invite another passenger to coordinate live.'}</small></div></div>
      <button className="primary-button" onClick={shareRoute} disabled={!destination}><Send /> Share current route</button>
      <button className="invite-action" onClick={() => setShowQr(true)}><QrCode /> Invite passengers</button>
      <footer className="focus-footer"><span>{roster.length} connected now</span><small>{connection === 'live' ? 'Live Railway WebSocket' : 'Reconnecting'}</small></footer>
    </aside>
    {showQr && <Modal title={`Join room ${roomCode}`} onClose={() => setShowQr(false)}>{qrSource ? <img className="qr-image" src={qrSource} alt={`QR code to join ${roomCode}`} /> : <div className="qr-loading" />}<p className="modal-copy">This link shares room status and optional browser location—not Tesla credentials.</p><button className="copy-link" onClick={() => navigator.clipboard?.writeText(inviteUrl)}><Copy /> Copy invite link</button><button className="primary-button" onClick={() => setShowQr(false)}>Done</button></Modal>}
  </section>;
}
