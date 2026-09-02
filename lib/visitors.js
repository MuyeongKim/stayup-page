import { createHmac, randomBytes } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { parseCookies } from './oauth.js';

const COOKIE_NAME = '__Host-stayup_visitor';
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const DAILY_KEY_TTL_SECONDS = 3 * 24 * 60 * 60;
const REDIS_KEY_PREFIX = 'stayup-page:visitors:v1';
const REDIS_KEY_SCOPES = new Set(['production', 'preview', 'development']);
const REDIS_KEY_PREFIX_PATTERN = /^stayup-page:visitors:v1:(?:production|preview|development)$/;
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;

const RECORD_VISITOR_SCRIPT = `
redis.call('PFADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
redis.call('PFADD', KEYS[2], ARGV[1])
local today = redis.call('PFCOUNT', KEYS[1])
local total = redis.call('PFCOUNT', KEYS[2])
return {today, total}
`;

export class VisitorCounterError extends Error {
  constructor(message, code = 'visitor_counter_error') {
    super(message);
    this.name = 'VisitorCounterError';
    this.code = code;
  }
}

export const getVisitorConfig = () => {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const vercelUrl = process.env.KV_REST_API_URL?.trim();
  const vercelToken = process.env.KV_REST_API_TOKEN?.trim();
  const redisRestUrl = upstashUrl || vercelUrl;
  const redisRestToken = upstashUrl ? upstashToken : vercelToken;
  const cookieSecret = process.env.VISITOR_COOKIE_SECRET?.trim();

  if (!redisRestUrl || !redisRestToken || !cookieSecret) {
    throw new VisitorCounterError('방문 현황 서버 설정이 필요합니다.', 'server_config');
  }
  if (cookieSecret.length < 32) {
    throw new VisitorCounterError(
      'VISITOR_COOKIE_SECRET은 32자 이상이어야 합니다.',
      'server_config',
    );
  }

  let parsedRedisUrl;
  try {
    parsedRedisUrl = new URL(redisRestUrl);
  } catch {
    throw new VisitorCounterError('Redis REST URL 형식이 올바르지 않습니다.', 'server_config');
  }
  if (parsedRedisUrl.protocol !== 'https:' || parsedRedisUrl.username || parsedRedisUrl.password) {
    throw new VisitorCounterError('Redis REST URL은 안전한 HTTPS URL이어야 합니다.', 'server_config');
  }

  const requestedScope = process.env.VERCEL_ENV?.trim();
  const keyScope = REDIS_KEY_SCOPES.has(requestedScope) ? requestedScope : 'development';
  return {
    cookieSecret,
    keyPrefix: `${REDIS_KEY_PREFIX}:${keyScope}`,
    redisRestToken,
    redisRestUrl,
  };
};

export const getSeoulDateKey = (date = new Date()) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new VisitorCounterError('집계 날짜를 계산할 수 없습니다.', 'invalid_date');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const createVisitorId = () => randomBytes(24).toString('base64url');

export const getVisitorId = req => {
  const value = parseCookies(req)[COOKIE_NAME];
  return typeof value === 'string' && VISITOR_ID_PATTERN.test(value) ? value : null;
};

export const fingerprintVisitor = (visitorId, cookieSecret) => {
  if (!VISITOR_ID_PATTERN.test(visitorId)) {
    throw new VisitorCounterError('방문 식별자 형식이 올바르지 않습니다.', 'invalid_visitor');
  }
  return createHmac('sha256', cookieSecret).update(visitorId).digest('base64url');
};

export const serializeVisitorCookie = visitorId => {
  if (!VISITOR_ID_PATTERN.test(visitorId)) {
    throw new VisitorCounterError('방문 식별자 형식이 올바르지 않습니다.', 'invalid_visitor');
  }
  return [
    `${COOKIE_NAME}=${visitorId}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
};

export const recordVisitor = async (redisClient, fingerprint, dateKey, keyPrefix) => {
  if (!REDIS_KEY_PREFIX_PATTERN.test(keyPrefix)) {
    throw new VisitorCounterError('방문 현황 키 범위가 올바르지 않습니다.', 'invalid_key_prefix');
  }
  const hashTag = `{${keyPrefix}}`;
  const result = await redisClient.eval(
    RECORD_VISITOR_SCRIPT,
    [
      `${hashTag}:daily:${dateKey}`,
      `${hashTag}:all`,
    ],
    [fingerprint, String(DAILY_KEY_TTL_SECONDS)],
  );
  const today = Number(result?.[0]);
  const total = Number(result?.[1]);

  if (
    !Number.isSafeInteger(today) ||
    !Number.isSafeInteger(total) ||
    today < 0 ||
    total < 0
  ) {
    throw new VisitorCounterError('방문 현황 응답이 올바르지 않습니다.', 'invalid_redis_response');
  }
  return { today, total: Math.max(today, total) };
};

let redisClient;

export const getRedisClient = (redisRestUrl, redisRestToken) => {
  if (!redisClient) {
    redisClient = new Redis({
      url: redisRestUrl,
      token: redisRestToken,
      retry: { retries: 0 },
      signal: () => AbortSignal.timeout(5000),
    });
  }
  return redisClient;
};
