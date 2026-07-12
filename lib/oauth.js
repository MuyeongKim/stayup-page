import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const STATE_LIFETIME_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const COOKIE_PREFIX = 'stayup_oauth_';
const CALLBACK_COOKIE_PATH = '/api/callback';
const DEFAULT_ALLOWED_ORIGINS =
  'https://stayup-ai.com,https://www.stayup-ai.com,https://stayup-page.vercel.app';
const DEFAULT_REPOSITORY = 'MuyeongKim/stayup-page';

class OAuthError extends Error {
  constructor(message, code = 'oauth_error') {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
  }
}

const base64url = value => Buffer.from(value).toString('base64url');

const sha256 = value => createHash('sha256').update(value).digest('base64url');

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const getRequiredEnv = name => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new OAuthError(`서버 환경 변수 ${name} 설정이 필요합니다.`, 'server_config');
  }
  return value;
};

const parseHttpsUrl = (value, label) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new OAuthError(`${label} 값이 올바른 URL이 아닙니다.`, 'server_config');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new OAuthError(`${label}에는 안전한 HTTPS URL을 입력해야 합니다.`, 'server_config');
  }
  return url;
};

export const getOAuthConfig = () => {
  const clientId = getRequiredEnv('GITHUB_OAUTH_CLIENT_ID');
  const clientSecret = getRequiredEnv('GITHUB_OAUTH_CLIENT_SECRET');
  const stateSecret = getRequiredEnv('OAUTH_STATE_SECRET');
  if (stateSecret.length < 32) {
    throw new OAuthError('OAUTH_STATE_SECRET은 32자 이상이어야 합니다.', 'server_config');
  }

  const callbackUrl = parseHttpsUrl(
    getRequiredEnv('GITHUB_OAUTH_CALLBACK_URL'),
    'GITHUB_OAUTH_CALLBACK_URL',
  );
  const allowedOrigins = new Set(
    (process.env.OAUTH_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => {
        const url = parseHttpsUrl(value, 'OAUTH_ALLOWED_ORIGINS');
        if (url.pathname !== '/') {
          throw new OAuthError(
            'OAUTH_ALLOWED_ORIGINS에는 경로 없이 origin만 입력해야 합니다.',
            'server_config',
          );
        }
        return url.origin;
      }),
  );

  const repository = process.env.GITHUB_OAUTH_REPOSITORY?.trim() || DEFAULT_REPOSITORY;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new OAuthError('GITHUB_OAUTH_REPOSITORY 형식이 올바르지 않습니다.', 'server_config');
  }

  const scope = process.env.GITHUB_OAUTH_SCOPE?.trim() || 'public_repo';
  if (!['public_repo', 'repo'].includes(scope)) {
    throw new OAuthError(
      'GITHUB_OAUTH_SCOPE은 public_repo 또는 repo만 사용할 수 있습니다.',
      'server_config',
    );
  }

  return {
    allowedOrigins,
    callbackUrl: callbackUrl.toString(),
    clientId,
    clientSecret,
    repository,
    scope,
    stateSecret,
  };
};

export const getQueryValue = (req, name) => {
  const value = req.query?.[name];
  return Array.isArray(value) ? value[0] : value;
};

export const resolveOpenerOrigin = (siteId, config) => {
  if (!siteId || typeof siteId !== 'string' || siteId.length > 253) {
    throw new OAuthError('허용된 관리 화면에서 다시 로그인해 주세요.', 'invalid_origin');
  }

  let url;
  try {
    url = new URL(siteId.includes('://') ? siteId : `https://${siteId}`);
  } catch {
    throw new OAuthError('허용된 관리 화면에서 다시 로그인해 주세요.', 'invalid_origin');
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new OAuthError('허용된 관리 화면에서 다시 로그인해 주세요.', 'invalid_origin');
  }

  const origin = url.origin;
  if (config.allowedOrigins.has(origin)) {
    return origin;
  }

  throw new OAuthError('허용된 관리 화면에서 다시 로그인해 주세요.', 'invalid_origin');
};

const signState = (encodedPayload, stateSecret) =>
  createHmac('sha256', stateSecret).update(encodedPayload).digest('base64url');

export const createOAuthRequest = (origin, config) => {
  const now = Date.now();
  const nonce = randomBytes(18).toString('base64url');
  const codeVerifier = randomBytes(48).toString('base64url');
  const codeChallenge = sha256(codeVerifier);
  const payload = {
    v: 1,
    nonce,
    origin,
    iat: now,
    exp: now + STATE_LIFETIME_MS,
    challenge: codeChallenge,
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  const state = `${encodedPayload}.${signState(encodedPayload, config.stateSecret)}`;
  const cookieName = `${COOKIE_PREFIX}${nonce}`;
  const cookieValue = base64url(
    JSON.stringify({ stateHash: sha256(state), codeVerifier }),
  );

  return {
    codeChallenge,
    cookieName,
    cookieValue,
    state,
  };
};

export const verifyState = (state, config) => {
  if (!state || typeof state !== 'string' || state.length > 2048) {
    throw new OAuthError('인증 요청이 만료되었거나 올바르지 않습니다.', 'invalid_state');
  }

  const parts = state.split('.');
  if (parts.length !== 2) {
    throw new OAuthError('인증 요청이 만료되었거나 올바르지 않습니다.', 'invalid_state');
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = signState(encodedPayload, config.stateSecret);
  if (!safeEqual(signature, expectedSignature)) {
    throw new OAuthError('인증 요청이 만료되었거나 올바르지 않습니다.', 'invalid_state');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new OAuthError('인증 요청이 만료되었거나 올바르지 않습니다.', 'invalid_state');
  }

  const now = Date.now();
  if (
    payload?.v !== 1 ||
    typeof payload.nonce !== 'string' ||
    !/^[A-Za-z0-9_-]{20,64}$/.test(payload.nonce) ||
    typeof payload.origin !== 'string' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.challenge !== 'string' ||
    payload.iat > now + CLOCK_SKEW_MS ||
    payload.exp < now ||
    payload.exp - payload.iat > STATE_LIFETIME_MS
  ) {
    throw new OAuthError('인증 요청이 만료되었거나 올바르지 않습니다.', 'invalid_state');
  }

  resolveOpenerOrigin(payload.origin, config);
  return payload;
};

export const parseCookies = req => {
  const cookies = {};
  const header = req.headers?.cookie;
  if (!header) return cookies;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
};

export const verifyOAuthCookie = (state, payload, cookieValue) => {
  if (!cookieValue || typeof cookieValue !== 'string' || cookieValue.length > 1024) {
    throw new OAuthError('인증 쿠키가 만료되었습니다. 다시 로그인해 주세요.', 'invalid_cookie');
  }

  let context;
  try {
    context = JSON.parse(Buffer.from(cookieValue, 'base64url').toString('utf8'));
  } catch {
    throw new OAuthError('인증 쿠키가 올바르지 않습니다. 다시 로그인해 주세요.', 'invalid_cookie');
  }

  if (
    typeof context.stateHash !== 'string' ||
    !safeEqual(context.stateHash, sha256(state)) ||
    typeof context.codeVerifier !== 'string' ||
    context.codeVerifier.length < 43 ||
    context.codeVerifier.length > 128 ||
    !safeEqual(sha256(context.codeVerifier), payload.challenge)
  ) {
    throw new OAuthError('인증 쿠키가 올바르지 않습니다. 다시 로그인해 주세요.', 'invalid_cookie');
  }

  return context;
};

export const getCookieName = nonce => `${COOKIE_PREFIX}${nonce}`;

export const serializeOAuthCookie = (name, value) =>
  `${name}=${value}; Path=${CALLBACK_COOKIE_PATH}; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;

export const clearOAuthCookie = name =>
  `${name}=; Path=${CALLBACK_COOKIE_PATH}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

const githubHeaders = token => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'User-Agent': 'stayup-page-cms-oauth',
  'X-GitHub-Api-Version': '2022-11-28',
});

const fetchWithTimeout = (url, options) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });

export const exchangeCodeForToken = async (code, codeVerifier, config) => {
  const response = await fetchWithTimeout('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.callbackUrl,
      code_verifier: codeVerifier,
    }),
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new OAuthError('GitHub 인증 응답을 확인할 수 없습니다.', 'token_exchange');
  }

  if (!response.ok || !result.access_token) {
    throw new OAuthError('GitHub 인증을 완료하지 못했습니다. 다시 시도해 주세요.', 'token_exchange');
  }
  return result.access_token;
};

export const verifyRepositoryAccess = async (token, config) => {
  const headers = githubHeaders(token);
  const [userResponse, repositoryResponse] = await Promise.all([
    fetchWithTimeout('https://api.github.com/user', { headers }),
    fetchWithTimeout(`https://api.github.com/repos/${config.repository}`, { headers }),
  ]);

  if (!userResponse.ok) {
    throw new OAuthError('GitHub 사용자 정보를 확인할 수 없습니다.', 'identity_check');
  }

  if (!repositoryResponse.ok) {
    throw new OAuthError(
      '활동 관리 저장소에 접근할 수 없습니다. GitHub 권한을 확인해 주세요.',
      'repository_access',
    );
  }

  const repository = await repositoryResponse.json();
  const permissions = repository.permissions || {};
  if (!(permissions.push || permissions.maintain || permissions.admin)) {
    throw new OAuthError(
      '이 GitHub 계정에는 활동을 게시할 권한이 없습니다.',
      'repository_access',
    );
  }
};

const htmlEscape = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const scriptValue = value => JSON.stringify(value).replaceAll('<', '\\u003c');

export const renderOAuthResult = ({ origin, status, content }) => {
  const nonce = randomBytes(18).toString('base64url');
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  const title = status === 'success' ? 'GitHub 인증 완료' : 'GitHub 인증 실패';
  const description =
    status === 'success'
      ? '활동 관리 화면으로 돌아가는 중입니다.'
      : content.message || '인증을 완료하지 못했습니다.';

  return {
    nonce,
    html: `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${htmlEscape(title)}</title>
    <style nonce="${nonce}">
      body { display: grid; min-height: 100vh; margin: 0; place-items: center; background: #f4f7fb; color: #172033; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(30rem, calc(100% - 2rem)); padding: 2rem; border: 1px solid #d7deea; border-radius: 1rem; background: #fff; box-sizing: border-box; text-align: center; }
      h1 { margin: 0 0 0.75rem; font-size: 1.35rem; }
      p { margin: 0; color: #526075; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>${htmlEscape(title)}</h1>
      <p id="status">${htmlEscape(description)}</p>
    </main>
    <script nonce="${nonce}">
      (() => {
        const openerOrigin = ${scriptValue(origin)};
        const resultMessage = ${scriptValue(message)};
        const handshake = 'authorizing:github';
        const statusElement = document.getElementById('status');

        if (!window.opener) {
          statusElement.textContent = '관리 화면이 닫혔습니다. 이 창을 닫고 다시 로그인해 주세요.';
          return;
        }

        window.addEventListener('message', event => {
          if (
            event.source !== window.opener ||
            event.origin !== openerOrigin ||
            event.data !== handshake
          ) {
            return;
          }
          window.opener.postMessage(resultMessage, openerOrigin);
          window.setTimeout(() => window.close(), 100);
        });

        window.opener.postMessage(handshake, openerOrigin);
      })();
    </script>
  </body>
</html>`,
  };
};

export const renderStaticError = message => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GitHub 인증 오류</title>
  </head>
  <body>
    <main>
      <h1>GitHub 인증 오류</h1>
      <p>${htmlEscape(message)}</p>
    </main>
  </body>
</html>`;

export const setOAuthHtmlHeaders = (res, nonce) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader(
    'Content-Security-Policy',
    nonce
      ? `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
      : "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
};

export const sendMethodNotAllowed = res => {
  res.setHeader('Allow', 'GET');
  res.status(405).json({ error: 'method_not_allowed' });
};

export { OAuthError };
