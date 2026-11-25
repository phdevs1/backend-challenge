// Fake messaging provider (WhatsApp/SMS-like). Do not modify: the grading uses this same code.
//
// Public API (what your service calls):
//   POST /messages            headers: Idempotency-Key (required)   body: { to, text }
//     202 { id }                 accepted and delivered to the patient
//     200 { id, duplicate }      a message with this Idempotency-Key was already delivered: not sent again
//     400 { error }              invalid request (missing key, `to` not E.164, empty text)
//     422 { error }              rejected by the carrier (do not retry)
//     503 { error }              temporarily unavailable (retry later)
//     504 { error }              gateway timeout: the message MAY have been delivered
//
// Admin API (for your own tests and for ours):
//   GET  /admin/messages?to=+34...   delivered messages
//   GET  /admin/requests?to=+34...   every request received, with its outcome
//   POST /admin/rules                { to, mode, count } -> the next `count` requests to `to` behave as `mode`:
//                                      "unavailable"   -> 503, nothing delivered
//                                      "lost-response" -> delivered, but answers 504
//                                      "reject"        -> 422, nothing delivered
//   POST /admin/reset                forget everything
//   GET  /health

import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 4010);
const E164 = /^\+[1-9]\d{7,14}$/;

let delivered = []; // { id, to, text, idempotencyKey, deliveredAt }
let requests = []; // { idempotencyKey, to, text, receivedAt, status }
let rules = new Map(); // to -> [{ mode, count }]

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function nextRule(to) {
  const list = rules.get(to);
  if (!list || list.length === 0) return null;
  const rule = list[0];
  rule.count -= 1;
  if (rule.count <= 0) list.shift();
  return rule.mode;
}

function deliver(key, to, text) {
  const existing = delivered.find((m) => m.idempotencyKey === key);
  if (existing) return { message: existing, duplicate: true };
  const message = { id: randomUUID(), to, text, idempotencyKey: key, deliveredAt: new Date().toISOString() };
  delivered.push(message);
  return { message, duplicate: false };
}

async function postMessage(req, res) {
  const key = req.headers['idempotency-key'];
  const body = await readJson(req);
  const log = (status) =>
    requests.push({ idempotencyKey: key ?? null, to: body?.to ?? null, text: body?.text ?? null, receivedAt: new Date().toISOString(), status });

  if (!key) return log(400), send(res, 400, { error: 'Idempotency-Key header is required' });
  if (!body || typeof body.to !== 'string' || !E164.test(body.to)) return log(400), send(res, 400, { error: '`to` must be an E.164 phone number' });
  if (typeof body.text !== 'string' || body.text.trim() === '') return log(400), send(res, 400, { error: '`text` is required' });

  const mode = nextRule(body.to);
  if (mode === 'unavailable') return log(503), send(res, 503, { error: 'temporarily unavailable' });
  if (mode === 'reject') return log(422), send(res, 422, { error: 'rejected by carrier' });
  if (mode === 'lost-response') {
    deliver(key, body.to, body.text);
    return log(504), send(res, 504, { error: 'gateway timeout' });
  }

  const { message, duplicate } = deliver(key, body.to, body.text);
  if (duplicate) return log(200), send(res, 200, { id: message.id, duplicate: true });
  return log(202), send(res, 202, { id: message.id });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const to = url.searchParams.get('to');
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
    if (req.method === 'POST' && url.pathname === '/messages') return await postMessage(req, res);
    if (req.method === 'GET' && url.pathname === '/admin/messages')
      return send(res, 200, to ? delivered.filter((m) => m.to === to) : delivered);
    if (req.method === 'GET' && url.pathname === '/admin/requests')
      return send(res, 200, to ? requests.filter((r) => r.to === to) : requests);
    if (req.method === 'POST' && url.pathname === '/admin/rules') {
      const body = await readJson(req);
      const modes = ['unavailable', 'lost-response', 'reject'];
      if (!body || !E164.test(body.to ?? '') || !modes.includes(body.mode) || !(body.count >= 1))
        return send(res, 400, { error: `expected { to, mode: ${modes.join('|')}, count >= 1 }` });
      rules.set(body.to, [...(rules.get(body.to) ?? []), { mode: body.mode, count: body.count }]);
      return send(res, 204);
    }
    if (req.method === 'POST' && url.pathname === '/admin/reset') {
      delivered = [];
      requests = [];
      rules = new Map();
      return send(res, 204);
    }
    return send(res, 404, { error: 'not found' });
  } catch (err) {
    return send(res, 500, { error: String(err) });
  }
});

server.listen(PORT, () => console.log(`fake provider listening on :${PORT}`));
