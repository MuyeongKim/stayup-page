import assert from 'node:assert/strict';
import {
  createOAuthRequest,
  getOAuthConfig,
  renderOAuthResult,
  resolveOpenerOrigin,
  verifyOAuthCookie,
  verifyState
} from '../lib/oauth.js';

process.env.GITHUB_OAUTH_CLIENT_ID = 'test-client-id';
process.env.GITHUB_OAUTH_CLIENT_SECRET = 'test-client-secret';
process.env.GITHUB_OAUTH_CALLBACK_URL = 'https://www.stayup-ai.com/api/callback';
process.env.OAUTH_STATE_SECRET = 'test-state-secret-that-is-at-least-32-characters-long';
process.env.OAUTH_ALLOWED_ORIGINS = 'https://www.stayup-ai.com,https://stayup-page.vercel.app';
process.env.GITHUB_OAUTH_SCOPE = 'public_repo';
process.env.GITHUB_OAUTH_REPOSITORY = 'MuyeongKim/stayup-page';

const config = getOAuthConfig();
assert.equal(resolveOpenerOrigin('www.stayup-ai.com', config), 'https://www.stayup-ai.com');
assert.throws(() => resolveOpenerOrigin('stayup-page-attacker.vercel.app', config));

const request = createOAuthRequest('https://www.stayup-ai.com', config);
const payload = verifyState(request.state, config);
const context = verifyOAuthCookie(request.state, payload, request.cookieValue);
assert.equal(typeof context.codeVerifier, 'string');
assert.throws(() => verifyState(`${request.state}tampered`, config));
assert.throws(() => verifyOAuthCookie(request.state, payload, `${request.cookieValue}tampered`));

const result = renderOAuthResult({
  origin: 'https://www.stayup-ai.com',
  status: 'success',
  content: { token: 'test-token-value', provider: 'github' }
});
assert.match(result.html, /authorization:github:success/);
assert.match(result.html, /https:\/\/www\.stayup-ai\.com/);
assert.doesNotMatch(result.html, /targetOrigin\s*=\s*['"]\*['"]/);
