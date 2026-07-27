import fs from 'fs';
import { TLSocketRoom } from '@tldraw/sync-core';
import { createTLSchema, defaultShapeSchemas } from '@tldraw/tlschema';
import { getRoomPath, safeWriteFile } from './utils.mjs';

const schema = createTLSchema({ shapes: defaultShapeSchemas });
export const rooms = new Map();

export async function getOrCreateRoom(roomId) {
  const decodedId = decodeURIComponent(roomId);
  if (rooms.has(decodedId)) {
    const existingRoom = rooms.get(decodedId);
    if (!existingRoom.isClosed) return existingRoom;
    rooms.delete(decodedId);
  }

  console.log(`[${new Date().toISOString()}] Creating/Loading room: ${decodedId}`);

  const roomPath = getRoomPath(decodedId);
  let initialSnapshot = undefined;

  try {
    const data = await fs.promises.readFile(roomPath, 'utf-8');
    initialSnapshot = JSON.parse(data);
    console.log(`[${new Date().toISOString()}] Loaded existing room: ${decodedId}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[${new Date().toISOString()}] Error loading room ${decodedId}:`, err);
    }
  }

  let saveTimeout = null;
  const room = new TLSocketRoom({
    id: decodedId,
    schema,
    initialSnapshot,
    onDataChange: () => {
      if (room.isClosed) return;
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        if (room.isClosed) return;
        try {
          const currentRoomPath = getRoomPath(decodedId);
          const snapshot = room.getCurrentSnapshot();
          await safeWriteFile(currentRoomPath, JSON.stringify(snapshot));
          console.log(`[${new Date().toISOString()}] Saved room: ${decodedId}`);
        } catch (err) {
          console.error(`[${new Date().toISOString()}] Error saving room ${decodedId}:`, err);
        }
      }, 2000);
    }
  });

  room.isClosed = false;
  rooms.set(decodedId, room);
  return room;
}

export const roomActiveSessions = new Map(); // roomId -> Map<sessionId, { email, nickname }>

export function addSessionToRoom(roomId, sessionId, email, nickname) {
  if (!roomActiveSessions.has(roomId)) {
    roomActiveSessions.set(roomId, new Map());
  }
  roomActiveSessions.get(roomId).set(sessionId, { email, nickname });
}

export function removeSessionFromRoom(roomId, sessionId) {
  const sessions = roomActiveSessions.get(roomId);
  if (sessions) {
    sessions.delete(sessionId);
    if (sessions.size === 0) {
      roomActiveSessions.delete(roomId);
    }
  }
}

export function getActiveUsersInRoom(roomId) {
  const sessions = roomActiveSessions.get(roomId);
  if (!sessions) return [];
  const users = Array.from(sessions.values());
  const uniqueNicknames = new Set(users.map(u => u.nickname));
  return Array.from(uniqueNicknames);
}
