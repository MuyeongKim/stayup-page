import assert from 'node:assert/strict';
import { handleVisitorRequest } from '../api/visitors.js';
import {
  fingerprintVisitor,
  getSeoulDateKey,
  getVisitorConfig,
  recordVisitor,
  serializeVisitorCookie,
} from '../lib/visitors.js';

process.env.KV_REST_API_URL = 'https://example.invalid';
process.env.KV_REST_API_TOKEN = 'test-rest-token';
process.env.VISITOR_COOKIE_SECRET = 'test-visitor-secret-that-is-at-least-32-characters';
process.env.VERCEL_ENV = 'production';

const visitorId = 'abcdefghijklmnopqrstuvwxABCDEFGH';

assert.deepEqual(getVisitorConfig(), {
  cookieSecret: process.env.VISITOR_COOKIE_SECRET,
  keyPrefix: 'stayup-page:visitors:v1:production',
  redisRestToken: process.env.KV_REST_API_TOKEN,
  redisRestUrl: process.env.KV_REST_API_URL,
});
assert.equal(getSeoulDateKey(new Date('2026-09-01T14:59:59.999Z')), '2026-09-01');
assert.equal(getSeoulDateKey(new Date('2026-09-01T15:00:00.000Z')), '2026-09-02');

const firstFingerprint = fingerprintVisitor(visitorId, process.env.VISITOR_COOKIE_SECRET);
assert.notEqual(firstFingerprint, visitorId);
assert.equal(firstFingerprint, fingerprintVisitor(visitorId, process.env.VISITOR_COOKIE_SECRET));
assert.notEqual(firstFingerprint, fingerprintVisitor(visitorId, `${process.env.VISITOR_COOKIE_SECRET}-other`));

const cookie = serializeVisitorCookie(visitorId);
assert.match(cookie, /^__Host-stayup_visitor=/);
assert.match(cookie, /; Path=\//);
assert.match(cookie, /; HttpOnly/);
assert.match(cookie, /; Secure/);
assert.match(cookie, /; SameSite=Lax/);

const evalCalls = [];
const redisClient = {
  async eval(script, keys, args) {
    evalCalls.push({ args, keys, script });
    return [7, 128];
  },
};
assert.deepEqual(await recordVisitor(
  redisClient,
  firstFingerprint,
  '2026-09-02',
  'stayup-page:visitors:v1:production',
), {
  today: 7,
  total: 128,
});
assert.deepEqual(evalCalls[0].keys, [
  '{stayup-page:visitors:v1:production}:daily:2026-09-02',
  '{stayup-page:visitors:v1:production}:all',
]);
assert.equal(evalCalls[0].args[0], firstFingerprint);
assert.equal(evalCalls[0].args[1], String(3 * 24 * 60 * 60));
assert.doesNotMatch(evalCalls[0].args[0], /abcdefghijklmnopqrstuvwxABCDEFGH/);
assert.match(evalCalls[0].script, /PFADD/);
assert.match(evalCalls[0].script, /PFCOUNT/);
assert.match(evalCalls[0].script, /EXPIRE/);

const normalizedCounts = await recordVisitor({
  async eval() { return [9, 8]; },
}, firstFingerprint, '2026-09-02', 'stayup-page:visitors:v1:production');
assert.deepEqual(normalizedCounts, { today: 9, total: 9 });
await assert.rejects(() => recordVisitor({
  async eval() { return ['invalid', 10]; },
}, firstFingerprint, '2026-09-02', 'stayup-page:visitors:v1:production'));

const createResponse = () => ({
  body: undefined,
  headers: new Map(),
  statusCode: undefined,
  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value);
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(value) {
    this.body = value;
    return this;
  },
});

const methodResponse = createResponse();
await handleVisitorRequest({ method: 'GET', headers: {} }, methodResponse);
assert.equal(methodResponse.statusCode, 405);
assert.equal(methodResponse.headers.get('allow'), 'POST');

const originResponse = createResponse();
await handleVisitorRequest({
  method: 'POST',
  headers: { host: 'www.stayup-ai.com', origin: 'https://example.com' },
}, originResponse);
assert.equal(originResponse.statusCode, 403);

const missingOriginResponse = createResponse();
await handleVisitorRequest({
  method: 'POST',
  headers: { host: 'www.stayup-ai.com' },
}, missingOriginResponse);
assert.equal(missingOriginResponse.statusCode, 403);

const insecureOriginResponse = createResponse();
await handleVisitorRequest({
  method: 'POST',
  headers: { host: 'www.stayup-ai.com', origin: 'http://www.stayup-ai.com' },
}, insecureOriginResponse);
assert.equal(insecureOriginResponse.statusCode, 403);

const successCalls = [];
const successResponse = createResponse();
await handleVisitorRequest({
  method: 'POST',
  headers: {
    cookie: `__Host-stayup_visitor=${visitorId}`,
    host: 'www.stayup-ai.com',
    origin: 'https://www.stayup-ai.com',
  },
}, successResponse, {
  now: new Date('2026-09-01T15:00:00.000Z'),
  redisClient: {
    async eval(script, keys, args) {
      successCalls.push({ args, keys, script });
      return [12, 3456];
    },
  },
});
assert.equal(successResponse.statusCode, 200);
assert.deepEqual(successResponse.body, {
  today: 12,
  total: 3456,
  basis: 'browser_estimate',
  timeZone: 'Asia/Seoul',
  since: '2026-09',
});
assert.match(successResponse.headers.get('set-cookie'), new RegExp(visitorId));
assert.equal(successResponse.headers.get('cache-control'), 'no-store, max-age=0');
assert.deepEqual(successCalls[0].keys, [
  '{stayup-page:visitors:v1:production}:daily:2026-09-02',
  '{stayup-page:visitors:v1:production}:all',
]);
assert.notEqual(successCalls[0].args[0], visitorId);

const replacementVisitorId = 'ZYXWVUTSRQPONMLKJIHGFEDCBA987654';
const replacementResponse = createResponse();
await handleVisitorRequest({
  method: 'POST',
  headers: {
    cookie: '__Host-stayup_visitor=malformed',
    host: 'www.stayup-ai.com',
    origin: 'https://www.stayup-ai.com',
  },
}, replacementResponse, {
  createVisitorId: () => replacementVisitorId,
  redisClient: { async eval() { return [1, 1]; } },
});
assert.equal(replacementResponse.statusCode, 200);
assert.match(replacementResponse.headers.get('set-cookie'), new RegExp(replacementVisitorId));
assert.doesNotMatch(replacementResponse.headers.get('set-cookie'), /malformed/);

const unavailableResponse = createResponse();
await handleVisitorRequest({
  method: 'POST',
  headers: { host: 'www.stayup-ai.com', origin: 'https://www.stayup-ai.com' },
}, unavailableResponse, {
  createVisitorId: () => visitorId,
  redisClient: { async eval() { throw new Error('private Redis detail'); } },
});
assert.equal(unavailableResponse.statusCode, 503);
assert.deepEqual(unavailableResponse.body, { error: 'visitor_counter_unavailable' });
assert.equal(unavailableResponse.headers.has('set-cookie'), false);
