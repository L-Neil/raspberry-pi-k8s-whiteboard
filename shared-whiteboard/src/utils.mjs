import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '../data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

export function getRoomPath(roomId) {
  const decodedId = decodeURIComponent(roomId);
  const safeRoomId = decodedId.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_');
  return path.join(DATA_DIR, `${safeRoomId}.json`);
}

export async function safeWriteFile(filePath, data) {
  const tmpPath = `${filePath}.tmp.${crypto.randomUUID()}`;
  await fs.promises.writeFile(tmpPath, data, 'utf8');
  await fs.promises.rename(tmpPath, filePath);
}
