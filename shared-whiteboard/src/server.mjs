import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getRoomPath } from './utils.mjs';
import { getOrCreateRoom, addSessionToRoom, removeSessionFromRoom } from './roomManager.mjs';
import apiRouter, { isAuthenticated, notifyClients } from './routes.mjs';
import { getNickname } from './profileManager.mjs';
import { attachAuthenticatedUser, describeAuthMode, getAuthenticatedUser } from './auth.mjs';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(attachAuthenticatedUser);

// KubernetesのreadinessProbe/livenessProbeから使用する。
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Middleware for logging
app.use((req, res, next) => {
  const user = req.authenticatedUser || 'anonymous';
  console.log(`[ACCESS] ${new Date().toISOString()} | ${user} | ${req.method} ${req.url}`);
  next();
});

// Migration: Rename URI-encoded filenames
(function migrate() {
  try {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.includes('%')) {
        try {
          const decoded = decodeURIComponent(file);
          if (decoded !== file) {
            const oldPath = path.join(DATA_DIR, file);
            const newPath = path.join(DATA_DIR, decoded);
            if (!fs.existsSync(newPath)) {
              fs.renameSync(oldPath, newPath);
              console.log(`[MIGRATION] Renamed ${file} to ${decoded}`);
            }
          }
        } catch (e) {}
      }
    }
  } catch (err) {}
})();

// API
app.use('/api', apiRouter);

// Static
const PUBLIC_DIR = path.join(__dirname, '../public');
app.use(express.static(PUBLIC_DIR, { index: false }));

app.get('/', isAuthenticated, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/v/:roomId', isAuthenticated, async (req, res) => {
  const roomId = decodeURIComponent(req.params.roomId);
  const roomPath = getRoomPath(roomId);
  try {
    await fs.promises.access(roomPath);
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.redirect('/');
    } else {
      console.error(`[ERROR] Failed to access room ${roomId}:`, err);
      res.status(500).send('Internal Server Error');
    }
  }
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Shared Whiteboard listening on http://0.0.0.0:${port} (${describeAuthMode()})`);
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const userEmail = getAuthenticatedUser(req);
  if (!userEmail) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let roomId = url.pathname.split('/').pop() || 'shared-room';
  try { roomId = decodeURIComponent(roomId); } catch (e) {}
  const sessionId = url.searchParams.get('sessionId') || `session-${Date.now()}`;

  if (!ws.addEventListener) {
    ws.addEventListener = (name, handler) => ws.on(name, handler);
    ws.removeEventListener = (name, handler) => ws.off(name, handler);
  }

  try {
    const room = await getOrCreateRoom(roomId);
    room.handleSocketConnect({ sessionId, socket: ws });
    const userEmail = getAuthenticatedUser(req);
    const nickname = await getNickname(userEmail);
    console.log(`[WS-ACCESS] ${new Date().toISOString()} | User: ${nickname} (${userEmail}) connected to Room: ${roomId} (Session: ${sessionId})`);

    addSessionToRoom(roomId, sessionId, userEmail, nickname);
    notifyClients();

    ws.on('close', () => {
      console.log(`[WS-ACCESS] ${new Date().toISOString()} | User: ${nickname} (${userEmail}) disconnected from Room: ${roomId} (Session: ${sessionId})`);
      removeSessionFromRoom(roomId, sessionId);
      notifyClients();
    });
  } catch (err) {
    console.error('[CONN-ERROR]', err);
    ws.close();
  }
});
