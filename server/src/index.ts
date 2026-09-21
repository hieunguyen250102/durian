import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type { ChatMessage, ClientAction, JoinPayload, JoinResult } from '../../shared/types';
import { GameError, Room } from './game';
import { nextBotMove } from './bot';

const PORT = Number(process.env.PORT) || 3210;
// Comma-separated list of allowed client origins, e.g. "https://durian.vercel.app". Empty = allow all.
const ORIGINS = (process.env.CLIENT_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const LOBBY_GRACE_MS = 20_000;
const ROOM_IDLE_MS = 30 * 60_000;

const app = express();
app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

// When the client has been built next to the server (single-service deploy), serve it too.
const clientDist = path.resolve(process.env.CLIENT_DIST ?? path.join(__dirname, '../../client/dist'));
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/socket\.io).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ORIGINS.length ? ORIGINS : true },
  pingInterval: 10_000,
  pingTimeout: 8_000,
});

const rooms = new Map<string, Room>();
// playerId -> the socket currently holding that seat, so a replaced tab's disconnect is ignored.
const seatSocket = new Map<string, string>();
interface SocketData {
  roomCode?: string;
  playerId?: string;
  /** Timestamps of recent chat messages, for rate limiting. */
  chatTimes?: number[];
}

const CHAT_BURST = 5;
const CHAT_WINDOW_MS = 5_000;

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!rooms.has(code)) return code;
  }
}

async function broadcast(room: Room) {
  const sockets = await io.in(room.code).fetchSockets();
  for (const s of sockets) {
    const data = s.data as SocketData;
    if (!data.playerId) continue;
    if (!room.get(data.playerId)) {
      // Removed by the host or after the lobby grace period.
      s.emit('kicked', 'Bạn đã bị mời ra khỏi phòng.');
      s.leave(room.code);
      data.roomCode = undefined;
      data.playerId = undefined;
      continue;
    }
    s.emit('state', room.viewFor(data.playerId));
  }
  scheduleBots(room);
}

// One pending bot move per room. The move is recomputed when the timer fires; if the game moved on
// in the meantime (a human acted), a fresh move with a fresh delay is scheduled instead.
const botTimers = new Map<string, NodeJS.Timeout>();
function botKey(room: Room) {
  return `${room.phase}:${room.activeId}:${room.event?.seq}:${room.reveal?.readyIds.length}`;
}
function scheduleBots(room: Room) {
  if (botTimers.has(room.code)) return;
  const move = nextBotMove(room);
  if (!move) return;
  const key = botKey(room);
  const timer = setTimeout(() => {
    botTimers.delete(room.code);
    if (rooms.get(room.code) !== room) return;
    if (botKey(room) === key) {
      const now = nextBotMove(room);
      if (now) {
        try {
          room.act(now.botId, now.action);
          if (now.action.type === 'call') botReactions(room);
        } catch (err) {
          console.error('Bot move failed', err);
        }
      }
    }
    void broadcast(room);
  }, move.delay);
  botTimers.set(room.code, timer);
}

const BOT_LINES = {
  won: ['😎', 'Bắt được rồi nhé!', '👏', 'Dễ mà~'],
  lost: ['😭', 'Oan quá!', '😡', 'Lần sau nhé…', 'Sao lại là tôi 😱'],
};

function sendBotChat(room: Room, botId: string, text: string, delay: number) {
  setTimeout(() => {
    if (rooms.get(room.code) !== room || !room.get(botId)) return;
    io.to(room.code).emit('chat', room.addChat(botId, text));
  }, delay);
}

/** Bots comment on the outcome once the reveal animation has played out. */
function botReactions(room: Room) {
  const r = room.reveal;
  if (!r) return;
  const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];
  const loser = room.get(r.loserId);
  const winnerId = r.loserId === r.callerId ? r.calledId : r.callerId;
  const winner = room.get(winnerId);
  if (loser?.isBot && Math.random() < 0.8) sendBotChat(room, loser.id, pick(BOT_LINES.lost), 4200 + Math.random() * 800);
  if (winner?.isBot && Math.random() < 0.6) sendBotChat(room, winner.id, pick(BOT_LINES.won), 4600 + Math.random() * 1200);
}

function deleteRoom(code: string) {
  rooms.delete(code);
  clearTimeout(botTimers.get(code));
  botTimers.delete(code);
}

io.on('connection', (socket: Socket) => {
  const data = socket.data as SocketData;

  socket.on('join', async (payload: JoinPayload, ack: (r: JoinResult) => void) => {
    try {
      if (data.roomCode) leaveCurrent(socket, false);
      const code = payload.roomCode?.trim().toUpperCase();
      let room = code ? rooms.get(code) : undefined;
      if (code && !room) return ack({ ok: false, error: `Không tìm thấy phòng ${code}.` });
      if (!room) {
        room = new Room(makeCode());
        rooms.set(room.code, room);
      }

      let player = payload.sessionId ? room.findBySession(payload.sessionId) : undefined;
      if (player) {
        // Only one live socket per seat: kick the older tab.
        for (const s of await io.in(room.code).fetchSockets()) {
          if ((s.data as SocketData).playerId === player.id && s.id !== socket.id) {
            s.emit('kicked', 'Bạn đã mở game ở một tab khác.');
            s.disconnect(true);
          }
        }
        if (payload.name?.trim() && room.phase === 'lobby') player.name = payload.name.trim().slice(0, 16);
        room.setConnected(player.id, true);
      } else {
        player = room.addPlayer(payload.name);
      }

      data.roomCode = room.code;
      data.playerId = player.id;
      seatSocket.set(player.id, socket.id);
      await socket.join(room.code);
      ack({ ok: true, roomCode: room.code, playerId: player.id, sessionId: player.sessionId });
      socket.emit('chatHistory', room.chat);
      await broadcast(room);
    } catch (err) {
      ack({ ok: false, error: err instanceof GameError ? err.message : 'Lỗi máy chủ.' });
      if (!(err instanceof GameError)) console.error(err);
    }
  });

  socket.on('action', async (action: ClientAction, ack?: (r: { ok: boolean; error?: string }) => void) => {
    const room = data.roomCode ? rooms.get(data.roomCode) : undefined;
    if (!room || !data.playerId) return ack?.({ ok: false, error: 'Bạn chưa vào phòng.' });
    try {
      room.act(data.playerId, action);
      if (action.type === 'call') botReactions(room);
      ack?.({ ok: true });
      await broadcast(room);
    } catch (err) {
      ack?.({ ok: false, error: err instanceof GameError ? err.message : 'Lỗi máy chủ.' });
      if (!(err instanceof GameError)) console.error(err);
    }
  });

  socket.on('chat', (text: unknown, ack?: (r: { ok: boolean; error?: string }) => void) => {
    const room = data.roomCode ? rooms.get(data.roomCode) : undefined;
    if (!room || !data.playerId) return ack?.({ ok: false, error: 'Bạn chưa vào phòng.' });
    const now = Date.now();
    data.chatTimes = (data.chatTimes ?? []).filter((t) => now - t < CHAT_WINDOW_MS);
    if (data.chatTimes.length >= CHAT_BURST) return ack?.({ ok: false, error: 'Bạn nhắn nhanh quá, chờ chút nhé!' });
    try {
      const msg = room.addChat(data.playerId, text);
      data.chatTimes.push(now);
      io.to(room.code).emit('chat', msg);
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: err instanceof GameError ? err.message : 'Lỗi máy chủ.' });
    }
  });

  socket.on('leave', () => leaveCurrent(socket, true));
  socket.on('disconnect', () => leaveCurrent(socket, false));
});

function leaveCurrent(socket: Socket, explicit: boolean) {
  const data = socket.data as SocketData;
  const room = data.roomCode ? rooms.get(data.roomCode) : undefined;
  const playerId = data.playerId;
  socket.leave(data.roomCode ?? '');
  data.roomCode = undefined;
  data.playerId = undefined;
  if (!room || !playerId || !room.get(playerId)) return;
  if (seatSocket.get(playerId) !== socket.id) return;
  seatSocket.delete(playerId);

  if (explicit && (room.phase === 'lobby' || room.phase === 'gameOver')) {
    room.removePlayer(playerId);
  } else {
    room.setConnected(playerId, false);
    if (room.phase === 'lobby') {
      // Give a refreshing browser a moment to reclaim the seat before freeing it.
      setTimeout(() => {
        const p = room.get(playerId);
        if (p && !p.connected && room.phase === 'lobby') {
          room.removePlayer(playerId);
          if (!room.hasHumans) deleteRoom(room.code);
          else void broadcast(room);
        }
      }, LOBBY_GRACE_MS);
    }
  }
  if (!room.hasHumans) deleteRoom(room.code);
  else void broadcast(room);
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.isEmpty && now - room.lastActivity > ROOM_IDLE_MS) deleteRoom(code);
  }
}, 60_000).unref();

httpServer.listen(PORT, () => {
  console.log(`Durian server listening on :${PORT}`);
});
