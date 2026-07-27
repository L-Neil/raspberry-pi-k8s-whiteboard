import fs from 'fs';
import path from 'path';
import { DATA_DIR, safeWriteFile } from './utils.mjs';

const profilesPath = path.join(DATA_DIR, 'profiles.json');

let profilesCache = null;

async function loadProfiles() {
  if (profilesCache) return profilesCache;
  try {
    const data = await fs.promises.readFile(profilesPath, 'utf-8');
    profilesCache = JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      profilesCache = {};
    } else {
      console.error('Failed to load profiles:', err);
      profilesCache = {};
    }
  }
  return profilesCache;
}

async function saveProfiles() {
  if (!profilesCache) return;
  try {
    await safeWriteFile(profilesPath, JSON.stringify(profilesCache, null, 2));
  } catch (err) {
    console.error('Failed to save profiles:', err);
  }
}

export async function getNickname(email) {
  const profiles = await loadProfiles();
  return profiles[email] || email.split('@')[0];
}

export async function setNickname(email, nickname) {
  const profiles = await loadProfiles();
  profiles[email] = nickname;
  await saveProfiles();
}
