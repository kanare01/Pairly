import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import jwt from 'jsonwebtoken';
import { queryOne, run } from '../db.js';
import { User } from '../types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pairly_secure_jwt_secret_production_key_2026';

interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const userSockets = new Map<string, Set<AuthenticatedSocket>>();

export function setupWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: AuthenticatedSocket, req) => {
    const parsedUrl = url.parse(req.url || '', true);
    const queryToken = parsedUrl.query.token as string;

    const authenticateUser = (token: string): boolean => {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
        const user = queryOne<User>('SELECT id, status FROM users WHERE id = ?', [payload.id]);

        if (!user || user.status === 'BANNED' || user.status === 'SUSPENDED') {
          ws.close(4003, 'Account not authorized');
          return false;
        }

        ws.userId = user.id;
        ws.isAlive = true;

        // Register socket in user pool
        if (!userSockets.has(user.id)) {
          userSockets.set(user.id, new Set());
        }
        userSockets.get(user.id)!.add(ws);

        // Update user presence
        run('UPDATE users SET is_online = 1, last_active_at = ? WHERE id = ?', [
          new Date().toISOString(),
          user.id,
        ]);

        try {
          ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', payload: { userId: user.id } }));
        } catch {}
        return true;
      } catch {
        ws.close(4002, 'Invalid token');
        return false;
      }
    };

    let authTimer: any = null;

    if (queryToken) {
      authenticateUser(queryToken);
    } else {
      // Allow client to authenticate via AUTH message within 10 seconds
      authTimer = setTimeout(() => {
        if (!ws.userId && ws.readyState === WebSocket.OPEN) {
          ws.close(4001, 'Authentication token required');
        }
      }, 10000);
    }

    // Heartbeat ping-pong
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'AUTH') {
          if (authTimer) {
            clearTimeout(authTimer);
            authTimer = null;
          }
          const token = message.payload?.token;
          if (token) {
            authenticateUser(token);
          } else {
            ws.close(4001, 'Authentication token required');
          }
          return;
        }
        handleSocketMessage(ws, message);
      } catch (err) {
        console.error('Invalid WS payload:', err);
      }
    });

    ws.on('close', () => {
      if (authTimer) {
        clearTimeout(authTimer);
        authTimer = null;
      }
      if (ws.userId && userSockets.has(ws.userId)) {
        const set = userSockets.get(ws.userId)!;
        set.delete(ws);
        if (set.size === 0) {
          userSockets.delete(ws.userId);
          run('UPDATE users SET is_online = 0, last_active_at = ? WHERE id = ?', [
            new Date().toISOString(),
            ws.userId,
          ]);
        }
      }
    });
  });

  // Interval heartbeat check
  const interval = setInterval(() => {
    wss.clients.forEach((client) => {
      const authClient = client as AuthenticatedSocket;
      if (authClient.isAlive === false) {
        return authClient.terminate();
      }
      authClient.isAlive = false;
      authClient.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

function handleSocketMessage(ws: AuthenticatedSocket, message: any) {
  if (!ws.userId) return;

  switch (message.type) {
    case 'TYPING': {
      const { conversationId, partnerId, isTyping } = message.payload || {};
      if (partnerId) {
        broadcastToUser(partnerId, {
          type: 'TYPING',
          payload: { conversationId, senderId: ws.userId, isTyping: !!isTyping },
        });
      }
      break;
    }
    case 'PING': {
      ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      break;
    }
    default:
      break;
  }
}

export function broadcastToUser(userId: string, data: any): void {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return;

  const payloadString = JSON.stringify(data);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payloadString);
    }
  }
}
