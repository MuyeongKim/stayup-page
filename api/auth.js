import {
  OAuthError,
  createOAuthRequest,
  getOAuthConfig,
  getQueryValue,
  resolveOpenerOrigin,
  serializeOAuthCookie,
  sendMethodNotAllowed,
} from '../lib/oauth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res);
  }

  try {
    const config = getOAuthConfig();
    const provider = getQueryValue(req, 'provider');
    if (provider !== 'github') {
      return res.status(400).json({ error: 'unsupported_provider' });
    }

    const requestedScope = getQueryValue(req, 'scope');
    if (requestedScope && requestedScope !== config.scope) {
      return res.status(400).json({ error: 'invalid_scope' });
    }

    const openerOrigin = resolveOpenerOrigin(getQueryValue(req, 'site_id'), config);
    const oauthRequest = createOAuthRequest(openerOrigin, config);
    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      scope: config.scope,
      state: oauthRequest.state,
      code_challenge: oauthRequest.codeChallenge,
      code_challenge_method: 'S256',
    }).toString();

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader(
      'Set-Cookie',
      serializeOAuthCookie(oauthRequest.cookieName, oauthRequest.cookieValue),
    );
    res.setHeader('Location', authorizeUrl.toString());
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.status(302).end();
  } catch (error) {
    const status = error instanceof OAuthError && error.code !== 'server_config' ? 400 : 500;
    const message =
      error instanceof OAuthError ? error.message : 'GitHub 로그인을 시작할 수 없습니다.';
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(status).json({ error: message });
  }
}
