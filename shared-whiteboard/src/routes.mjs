import express from 'express';
import fs from 'fs';
import path from 'path';
import { DATA_DIR, getRoomPath, safeWriteFile } from './utils.mjs';
import { rooms, getOrCreateRoom, getActiveUsersInRoom } from './roomManager.mjs';
import { getNickname, setNickname } from './profileManager.mjs';

const router = express.Router();

const isAuthenticated = (req, res, next) => {
  const userEmail = req.authenticatedUser;
  if (userEmail) {
    next();
  } else {
    res.status(401).send('Unauthorized: no authenticated user was supplied by the configured authentication mode.');
  }
};

router.use(isAuthenticated);

// SSE Clients for real-time updates
let sseClients = [];

export function notifyClients() {
  sseClients.forEach(client => {
    try {
      client.res.write('event: room_updated\ndata: {}\n\n');
    } catch (e) {
      // ignore
    }
  });
}

// SSE Endpoint
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client = { id: Date.now(), res };
  sseClients.push(client);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== client.id);
  });
});

// User Profile API
router.get('/me', async (req, res) => {
  const email = req.authenticatedUser;
  const nickname = await getNickname(email);
  res.json({ email, nickname });
});

router.post('/me', async (req, res) => {
  const email = req.authenticatedUser;
  const { nickname } = req.body;
  if (!nickname || nickname.trim() === '') return res.status(400).send('Nickname is required');
  await setNickname(email, nickname.trim());
  res.json({ success: true, nickname: nickname.trim() });
});

// API to create a room
router.post('/rooms', async (req, res) => {
  const { roomId } = req.body;
  if (!roomId) return res.status(400).send('roomId is required');

  const roomPath = getRoomPath(roomId);
  try {
    await fs.promises.access(roomPath);
    return res.status(400).send('Room already exists');
  } catch {
    try {
      const room = await getOrCreateRoom(roomId);
      const snapshot = room.getCurrentSnapshot();
      await safeWriteFile(roomPath, JSON.stringify(snapshot));
      notifyClients();
      res.json({ id: roomId });
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
});

// API to list rooms
router.get('/rooms', async (req, res) => {
  try {
    const files = await fs.promises.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'profiles.json');
    const roomList = await Promise.all(jsonFiles.map(async f => {
      const stats = await fs.promises.stat(path.join(DATA_DIR, f));
      const roomId = f.replace('.json', '');
      return {
        id: roomId,
        updatedAt: stats.mtime,
        size: stats.size,
        activeUsers: getActiveUsersInRoom(roomId)
      };
    }));
    roomList.sort((a, b) => b.updatedAt - a.updatedAt);
    res.json(roomList);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

// API to rename a room
router.post('/rooms/:roomId/rename', async (req, res) => {
  const roomId = decodeURIComponent(req.params.roomId);
  const { newName } = req.body;
  if (!newName) return res.status(400).send('newName is required');

  const activeUsers = getActiveUsersInRoom(roomId);
  if (activeUsers.length > 0) {
    return res.status(400).send(`現在 ${activeUsers.length} 人が編集中です。全員が退出するまで名前変更できません。`);
  }

  const dateMatch = roomId.match(/^(\d{4}-\d{2}-\d{2})-(.*)$/);
  if (!dateMatch) return res.status(400).send('Invalid room ID format');

  const datePrefix = dateMatch[1];
  const safeSuffix = newName.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_');
  const newRoomId = `${datePrefix}-${safeSuffix}`;

  const oldPath = getRoomPath(roomId);
  const newPath = getRoomPath(newRoomId);

  try {
    await fs.promises.access(newPath);
    return res.status(400).send('Room already exists');
  } catch { /* OK */ }

  try {
    try { await fs.promises.rename(oldPath, newPath); } catch (e) { if (e.code !== 'ENOENT') throw e; }

    const room = rooms.get(roomId);
    if (room) {
      room.isClosed = true;
      rooms.delete(roomId);
    }
    notifyClients();
    res.json({ id: newRoomId });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// API to delete a room
router.delete('/rooms/:roomId', async (req, res) => {
  const roomId = decodeURIComponent(req.params.roomId);

  const activeUsers = getActiveUsersInRoom(roomId);
  if (activeUsers.length > 0) {
    return res.status(400).send(`現在 ${activeUsers.length} 人が編集中です。全員が退出するまで削除できません。`);
  }

  const roomPath = getRoomPath(roomId);

  try {
    try { await fs.promises.unlink(roomPath); } catch (e) { if (e.code !== 'ENOENT') throw e; }

    const room = rooms.get(roomId);
    if (room) {
      room.isClosed = true;
      rooms.delete(roomId);
    }
    notifyClients();
    res.sendStatus(204);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default router;
export { isAuthenticated };
