import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const moduleUrl = new URL('../src/auth.mjs', import.meta.url).href;

function evaluateAuth(env, headers = {}) {
  const source = `
    import { getAuthenticatedUser } from ${JSON.stringify(moduleUrl)};
    process.stdout.write(getAuthenticatedUser({ headers: ${JSON.stringify(headers)} }));
  `;
  return spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('local mode uses the configured local identity', () => {
  const result = evaluateAuth({ AUTH_MODE: 'local', LOCAL_USER_EMAIL: 'local@example.invalid' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'local@example.invalid');
});

test('header mode reads only the configured header', () => {
  const result = evaluateAuth(
    { AUTH_MODE: 'header', AUTH_HEADER: 'x-user-id' },
    { 'x-user-id': 'person@example.invalid' },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'person@example.invalid');
});

test('invalid authentication mode fails at startup', () => {
  const result = evaluateAuth({ AUTH_MODE: 'unsupported' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AUTH_MODE must be either/);
});
