import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { DATA_DIR, getRoomPath } from '../src/utils.mjs';

test('room files always remain inside the data directory', () => {
  const roomPath = getRoomPath('../../private/board');
  assert.equal(path.dirname(roomPath), DATA_DIR);
  assert.ok(roomPath.endsWith('.._.._private_board.json'));
});
