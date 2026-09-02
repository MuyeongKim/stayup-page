import {
  createVisitorId,
  fingerprintVisitor,
  getRedisClient,
  getSeoulDateKey,
  getVisitorConfig,
  getVisitorId,
  recordVisitor,
  serializeVisitorCookie,
} from '../lib/visitors.js';

const getHeader = (req, name) => {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
};

const isSameOriginRequest = req => {
  const origin = getHeader(req, 'origin');
  if (!origin) return false;

  const host = getHeader(req, 'host');
  if (!host) return false;

  try {
    const originUrl = new URL(origin);
    const isLocalDevelopment = /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host);
    const allowedProtocol = originUrl.protocol === 'https:'
      || (isLocalDevelopment && originUrl.protocol === 'http:');
    return allowedProtocol && originUrl.host === host;
  } catch {
    return false;
  }
};

const setResponseHeaders = res => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
};

export const handleVisitorRequest = async (req, res, dependencies = {}) => {
  setResponseHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ error: 'origin_not_allowed' });
  }

  try {
    const config = getVisitorConfig();
    const visitorId = getVisitorId(req) || (dependencies.createVisitorId || createVisitorId)();
    const fingerprint = fingerprintVisitor(visitorId, config.cookieSecret);
    const dateKey = getSeoulDateKey(dependencies.now || new Date());
    const redisClient = dependencies.redisClient
      || getRedisClient(config.redisRestUrl, config.redisRestToken);
    const counts = await recordVisitor(redisClient, fingerprint, dateKey, config.keyPrefix);

    res.setHeader('Set-Cookie', serializeVisitorCookie(visitorId));
    return res.status(200).json({
      ...counts,
      basis: 'browser_estimate',
      timeZone: 'Asia/Seoul',
      since: '2026-09',
    });
  } catch {
    return res.status(503).json({ error: 'visitor_counter_unavailable' });
  }
};

export default async function handler(req, res) {
  return handleVisitorRequest(req, res);
}
