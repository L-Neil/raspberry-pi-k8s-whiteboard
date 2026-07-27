const authMode = (process.env.AUTH_MODE || 'local').toLowerCase();
const localUserEmail = process.env.LOCAL_USER_EMAIL || 'user@example.invalid';
const authHeader = (process.env.AUTH_HEADER || 'x-authenticated-user-email').toLowerCase();

if (!['local', 'header'].includes(authMode)) {
  throw new Error('AUTH_MODE must be either "local" or "header"');
}

export function getAuthenticatedUser(req) {
  if (authMode === 'local') return localUserEmail;

  const value = req.headers[authHeader];
  if (Array.isArray(value)) return value[0]?.trim() || '';
  return typeof value === 'string' ? value.trim() : '';
}

export function attachAuthenticatedUser(req, _res, next) {
  req.authenticatedUser = getAuthenticatedUser(req);
  next();
}

export function describeAuthMode() {
  return authMode === 'local' ? 'local user' : `trusted header: ${authHeader}`;
}
