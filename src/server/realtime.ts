import { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { and, eq } from 'drizzle-orm';
import { gamePlayers, gameRooms, teamMembers, users } from '../db/schema.ts';

interface ClientMeta {
  ws: WebSocket;
  userId: number | null;
  username: string | null;
  role: string;
  teamIds: number[];
  captainTeamIds: number[];
  competitionIds: number[];
  subscribedGameRooms: Set<string>;
}

const clients = new Set<ClientMeta>();

export function getOnlineUserIds(): number[] {
  const ids = new Set<number>();
  for (const c of clients) {
    if (c.userId !== null && c.ws.readyState === WebSocket.OPEN) {
      ids.add(c.userId);
    }
  }
  return Array.from(ids);
}

export function initRealtimeServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('error', (err) => {
    console.error('KALI3977 WebSocket server error:', err);
  });

  wss.on('connection', async (ws, req) => {
    const meta: ClientMeta = {
      ws,
      userId: null,
      username: null,
      role: 'guest',
      teamIds: [],
      captainTeamIds: [],
      competitionIds: [],
      subscribedGameRooms: new Set<string>(),
    };
    clients.add(meta);

    try {
      const url = new URL(req.url || '/ws', 'http://localhost:3000');
      const token = url.searchParams.get('token');
      if (token) {
        const decoded = await adminAuth.verifyIdToken(token);
        const [u] = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
        if (u && !u.isBanned && !u.isSuspended) {
          meta.userId = u.id;
          meta.username = u.username;
          meta.role = u.role;
          const memberships = await db
            .select({
              teamId: teamMembers.teamId,
              competitionId: teamMembers.competitionId,
              roleInTeam: teamMembers.roleInTeam,
            })
            .from(teamMembers)
            .where(eq(teamMembers.userId, u.id));
          meta.teamIds = memberships.map((m) => m.teamId);
          meta.captainTeamIds = memberships
            .filter((m) => m.roleInTeam === 'captain' || m.roleInTeam === 'deputy')
            .map((m) => m.teamId);
          meta.competitionIds = memberships
            .map((m) => m.competitionId)
            .filter((id): id is number => id !== null);
        }
      }
    } catch {
      // Fall back to guest read-only public broadcasts
    }

    ws.send(
      JSON.stringify({
        type: 'connected',
        authenticated: meta.userId !== null,
        onlineCount: clients.size,
      }),
    );

    broadcastPresence();

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; roomCode?: string };
        const roomCode = typeof msg.roomCode === 'string' ? msg.roomCode.trim().toUpperCase().slice(0, 32) : '';
        if (!roomCode) return;

        if (msg.type === 'games:subscribe_room') {
          meta.subscribedGameRooms.add(roomCode);
          if (meta.userId) {
            const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, roomCode)).limit(1);
            if (room) {
              await db
                .update(gamePlayers)
                .set({ connected: true, disconnectedAt: null, lastHeartbeatAt: new Date() })
                .where(and(eq(gamePlayers.roomId, room.id), eq(gamePlayers.userId, meta.userId)));
              broadcastGameRoomEvent(roomCode, 'games:player_reconnected', {
                userId: meta.userId,
                username: meta.username,
              });
            }
          }
          ws.send(JSON.stringify({ type: 'games:subscribed', roomCode }));
        } else if (msg.type === 'games:unsubscribe_room') {
          meta.subscribedGameRooms.delete(roomCode);
        } else if (msg.type === 'games:heartbeat' && meta.userId) {
          const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, roomCode)).limit(1);
          if (room) {
            await db
              .update(gamePlayers)
              .set({ connected: true, lastHeartbeatAt: new Date() })
              .where(and(eq(gamePlayers.roomId, room.id), eq(gamePlayers.userId, meta.userId)));
          }
        }
      } catch {
        // Ignore malformed client WS messages safely
      }
    });

    ws.on('close', async () => {
      const roomsLeft = Array.from(meta.subscribedGameRooms);
      const userId = meta.userId;
      const username = meta.username;
      clients.delete(meta);
      broadcastPresence();

      if (userId && roomsLeft.length > 0) {
        // Only mark disconnected if user has no other open socket in the same room
        for (const roomCode of roomsLeft) {
          const stillConnected = Array.from(clients).some(
            (c) =>
              c.userId === userId &&
              c.ws.readyState === WebSocket.OPEN &&
              c.subscribedGameRooms.has(roomCode),
          );
          if (!stillConnected) {
            try {
              const [room] = await db.select().from(gameRooms).where(eq(gameRooms.roomCode, roomCode)).limit(1);
              if (room) {
                await db
                  .update(gamePlayers)
                  .set({ connected: false, disconnectedAt: new Date() })
                  .where(and(eq(gamePlayers.roomId, room.id), eq(gamePlayers.userId, userId)));
                broadcastGameRoomEvent(roomCode, 'games:player_disconnected', {
                  userId,
                  username,
                });
              }
            } catch {
              // Ignore disconnect update failure on shutdown
            }
          }
        }
      }
    });

    ws.on('error', () => {
      clients.delete(meta);
    });
  });

  return wss;
}

function broadcastPresence() {
  const payload = JSON.stringify({
    type: 'presence:update',
    onlineCount: clients.size,
  });
  for (const c of clients) {
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(payload);
    }
  }
}

export function broadcastGameRoomEvent(
  roomCode: string,
  type: string,
  data: Record<string, unknown> = {},
) {
  const normalizedCode = roomCode.trim().toUpperCase();
  const payload = JSON.stringify({ type, roomCode: normalizedCode, ...data });
  for (const c of clients) {
    if (c.ws.readyState === WebSocket.OPEN && c.subscribedGameRooms.has(normalizedCode)) {
      c.ws.send(payload);
    }
  }
}

export function broadcastPublicEvent(type: string, data: Record<string, unknown>) {
  const payload = JSON.stringify({ type, ...data });
  for (const c of clients) {
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(payload);
    }
  }
}

export function broadcastChannelMessage(params: {
  channelType: string;
  teamId: number | null;
  message: Record<string, unknown>;
  eventType?: string;
}) {
  const payload = JSON.stringify({
    type: params.eventType || 'chat:message',
    message: params.message,
  });

  for (const c of clients) {
    if (c.ws.readyState !== WebSocket.OPEN) continue;

    if (params.channelType === 'announcements') {
      c.ws.send(payload);
      continue;
    }

    if (c.userId === null) continue;

    if (params.channelType === 'team') {
      if (c.role === 'owner' || (params.teamId && c.teamIds.includes(params.teamId))) {
        c.ws.send(payload);
      }
    } else if (params.channelType === 'captain') {
      if (
        c.role === 'owner' ||
        c.role === 'event_admin' ||
        c.role === 'moderator' ||
        (params.teamId && c.captainTeamIds.includes(params.teamId))
      ) {
        c.ws.send(payload);
      }
    } else if (params.channelType === 'organizer') {
      if (c.role === 'owner' || c.role === 'event_admin' || c.role === 'moderator') {
        c.ws.send(payload);
      }
    }
  }
}

export function broadcastUserNotification(userId: number, notification: Record<string, unknown>) {
  const payload = JSON.stringify({
    type: 'notification:new',
    notification,
  });
  for (const c of clients) {
    if (c.ws.readyState === WebSocket.OPEN && c.userId === userId) {
      c.ws.send(payload);
    }
  }
}
