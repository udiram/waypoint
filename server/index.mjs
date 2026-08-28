import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const app = express();
const bootedAt = new Date().toISOString();
const version = process.env.RAILWAY_GIT_COMMIT_SHA
  || process.env.SOURCE_VERSION
  || process.env.RAILWAY_DEPLOYMENT_ID
  || 'local-dev';

const rooms = new Map();

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureRoom(roomCode) {
  const normalized = roomCode.trim().toUpperCase();
  if (!rooms.has(normalized)) {
    rooms.set(normalized, {
      roomCode: normalized,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      decision: null,
      members: new Map(),
    });
  }
  return rooms.get(normalized);
}

function serializeRoom(room) {
  return {
    roomCode: room.roomCode,
    decision: room.decision,
    updatedAt: room.updatedAt,
    members: [...room.members.values()]
      .sort((left, right) => left.joinedAt - right.joinedAt)
      .map((member) => ({
        id: member.id,
        name: member.name,
        color: member.color,
        charge: member.charge,
        eta: member.eta,
        location: member.location,
        status: member.status,
        joinedAt: member.joinedAt,
        updatedAt: member.updatedAt,
      })),
  };
}

function broadcastRoom(room) {
  const payload = JSON.stringify({
    type: 'snapshot',
    room: serializeRoom(room),
  });
  for (const member of room.members.values()) {
    if (member.socket.readyState === member.socket.OPEN) {
      member.socket.send(payload);
    }
  }
}

function cleanupRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.members.size === 0) {
    rooms.delete(roomCode);
  }
}

app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'waypoint',
    version,
    bootedAt,
    rooms: rooms.size,
    now: new Date().toISOString(),
  });
});

app.get('/api/ready', (_request, response) => {
  response.json({
    ready: true,
    rooms: rooms.size,
    now: new Date().toISOString(),
  });
});

app.get('/api/version', (_request, response) => {
  response.json({
    name: 'waypoint-tesla-browser',
    version,
    bootedAt,
  });
});

app.get('/api/convoy/:roomCode', (request, response) => {
  const room = ensureRoom(request.params.roomCode);
  response.json({
    ok: true,
    room: serializeRoom(room),
  });
});

app.use(express.static(distDir, { index: false, maxAge: '1h' }));

app.use((request, response, next) => {
  if (request.path.startsWith('/api/')) {
    response.status(404).json({ ok: false, error: 'Not found' });
    return;
  }
  response.sendFile(path.join(distDir, 'index.html'));
});

const port = Number(process.env.PORT || 8080);
const server = app.listen(port, () => {
  console.log(JSON.stringify({ event: 'server_started', port, version, bootedAt }));
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (socket) => {
  let memberRef = null;

  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload.' }));
      return;
    }

    if (message.type === 'join') {
      const room = ensureRoom(message.roomCode || 'WAYPT');
      const existingMember = message.memberId ? room.members.get(message.memberId) : null;
      const memberId = existingMember?.id || randomId('member');
      const nextMember = {
        id: memberId,
        name: message.profile?.name || 'Vehicle',
        color: message.profile?.color || '#80bfff',
        charge: message.profile?.charge || 'Unknown',
        eta: message.profile?.eta || 'Calculating',
        location: message.profile?.location || null,
        status: message.profile?.status || 'Connected',
        joinedAt: existingMember?.joinedAt || Date.now(),
        updatedAt: Date.now(),
        socket,
      };
      room.updatedAt = Date.now();
      room.members.set(memberId, nextMember);
      memberRef = { roomCode: room.roomCode, memberId };
      socket.send(JSON.stringify({ type: 'joined', memberId, roomCode: room.roomCode }));
      broadcastRoom(room);
      return;
    }

    if (!memberRef) {
      socket.send(JSON.stringify({ type: 'error', message: 'Join a room before sending updates.' }));
      return;
    }

    const room = rooms.get(memberRef.roomCode);
    const member = room?.members.get(memberRef.memberId);
    if (!room || !member) {
      socket.send(JSON.stringify({ type: 'error', message: 'Room state expired.' }));
      return;
    }

    room.updatedAt = Date.now();

    if (message.type === 'state') {
      room.members.set(memberRef.memberId, {
        ...member,
        charge: message.payload?.charge || member.charge,
        eta: message.payload?.eta || member.eta,
        location: message.payload?.location || member.location,
        status: message.payload?.status || member.status,
        updatedAt: Date.now(),
        socket,
      });
      broadcastRoom(room);
      return;
    }

    if (message.type === 'decision') {
      room.decision = {
        title: message.payload?.title || 'Group decision',
        detail: message.payload?.detail || 'Decision updated',
        sentAt: Date.now(),
      };
      room.members.set(memberRef.memberId, {
        ...member,
        status: message.payload?.status || 'Shared a plan',
        updatedAt: Date.now(),
        socket,
      });
      broadcastRoom(room);
      return;
    }

    if (message.type === 'ping') {
      socket.send(JSON.stringify({ type: 'pong', at: Date.now() }));
    }
  });

  socket.on('close', () => {
    if (!memberRef) return;
    const room = rooms.get(memberRef.roomCode);
    if (!room) return;
    room.members.delete(memberRef.memberId);
    room.updatedAt = Date.now();
    if (room.members.size > 0) {
      broadcastRoom(room);
    }
    cleanupRoom(memberRef.roomCode);
  });
});

const pruneTimer = setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [roomCode, room] of rooms.entries()) {
    if (room.updatedAt < cutoff) {
      rooms.delete(roomCode);
    }
  }
}, 15 * 60 * 1000);

pruneTimer.unref();
