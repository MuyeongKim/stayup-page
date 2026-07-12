import {
  OAuthError,
  clearOAuthCookie,
  exchangeCodeForToken,
  getCookieName,
  getOAuthConfig,
  getQueryValue,
  parseCookies,
  renderOAuthResult,
  renderStaticError,
  sendMethodNotAllowed,
  setOAuthHtmlHeaders,
  verifyOAuthCookie,
  verifyRepositoryAccess,
  verifyState,
} from '../lib/oauth.js';

const githubErrorMessage = error => {
  if (error === 'access_denied') {
    return 'GitHub 권한 승인이 취소되었습니다.';
  }
  return 'GitHub 인증을 완료하지 못했습니다. 다시 시도해 주세요.';
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res);
  }

  let origin;
  let cookieName;
  try {
    const config = getOAuthConfig();
    const state = getQueryValue(req, 'state');
    const statePayload = verifyState(state, config);
    origin = statePayload.origin;
    cookieName = getCookieName(statePayload.nonce);

    const cookieValue = parseCookies(req)[cookieName];
    const oauthContext = verifyOAuthCookie(state, statePayload, cookieValue);
    res.setHeader('Set-Cookie', clearOAuthCookie(cookieName));

    const githubError = getQueryValue(req, 'error');
    if (githubError) {
      throw new OAuthError(githubErrorMessage(githubError), 'github_denied');
    }

    const code = getQueryValue(req, 'code');
    if (!code || typeof code !== 'string' || code.length > 512) {
      throw new OAuthError('GitHub 인증 코드가 없습니다. 다시 로그인해 주세요.', 'missing_code');
    }

    const token = await exchangeCodeForToken(code, oauthContext.codeVerifier, config);
    await verifyRepositoryAccess(token, config);

    const result = renderOAuthResult({
      origin,
      status: 'success',
      content: { token, provider: 'github' },
    });
    setOAuthHtmlHeaders(res, result.nonce);
    return res.status(200).send(result.html);
  } catch (error) {
    const message =
      error instanceof OAuthError
        ? error.message
        : 'GitHub 인증 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

    if (origin) {
      if (cookieName && !res.getHeader('Set-Cookie')) {
        res.setHeader('Set-Cookie', clearOAuthCookie(cookieName));
      }
      const result = renderOAuthResult({
        origin,
        status: 'error',
        content: { message },
      });
      setOAuthHtmlHeaders(res, result.nonce);
      return res.status(200).send(result.html);
    }

    setOAuthHtmlHeaders(res);
    return res.status(400).send(renderStaticError(message));
  }
}
