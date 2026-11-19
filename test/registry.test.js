import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { client } from '../testing/request.js';
import { createApp } from '../server.js';

const { app, db } = createApp({ database: ':memory:', rateLimit: 1000 });
const base = 'http://test';
const fetch = client(app);
let entry;
const valid = { name: 'Campus Picks', creator: 'Workshop Student', description: 'Good places to spend an afternoon.', ip: '192.168.1.42', port: 3001 };
const request = (path = '', method = 'GET', body, token) => fetch(`${base}/api/apis${path}`, {
  method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});
after(() => db.close());

test('starts empty and creates a trimmed registration with a private edit token', async () => {
  assert.deepEqual(await (await request()).json(), { apis: [] });
  const response = await request('', 'POST', { ...valid, creator: ' Workshop Student ' });
  assert.equal(response.status, 201);
  entry = await response.json();
  assert.equal(entry.creator, valid.creator);
  assert.equal(entry.edit_token.length, 48);
  assert.equal(response.headers.get('location'), `/api/apis/${entry.id}`);
});
test('public responses never expose edit credentials', async () => {
  const list = await (await request()).json();
  assert.equal(list.apis.length, 1);
  assert.equal(list.apis[0].edit_token, undefined);
  assert.equal(list.apis[0].token_hash, undefined);
  assert.equal((await (await request(`/${entry.id}`)).json()).token_hash, undefined);
});
test('rejects malformed fields, arrays, HTML, bad IPs, and non-numeric ports', async () => {
  for (const body of [null, [], {}, { ...valid, name: 'a' }, { ...valid, creator: '<script>' },
    { ...valid, description: 'x'.repeat(161) }, { ...valid, ip: 'localhost' },
    { ...valid, ip: '127.0.0.1' }, { ...valid, ip: '0.0.0.0' }, { ...valid, ip: '169.254.1.1' },
    { ...valid, ip: '224.0.0.1' }, { ...valid, ip: '999.1.1.1' },
    { ...valid, port: '3001' }, { ...valid, port: 80 }, { ...valid, port: 65536 },
    { ...valid, port: 3001.5 }, { ...valid, unknown: 'hello' }]) {
    assert.equal((await request('', 'POST', body)).status, 400, JSON.stringify(body));
  }
});
test('rejects duplicate names case-insensitively and duplicate addresses', async () => {
  assert.equal((await request('', 'POST', { ...valid, name: 'campus picks', port: 3002 })).status, 409);
  assert.equal((await request('', 'POST', { ...valid, name: 'Another API' })).status, 409);
});
test('requires JSON and reports malformed or oversized bodies', async () => {
  const url = `${base}/api/apis`;
  assert.equal((await fetch(url, { method: 'POST', body: 'hello' })).status, 415);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status, 400);
  assert.equal((await request('', 'POST', { ...valid, description: 'x'.repeat(9000) })).status, 413);
});
test('only the creator can update or delete; invalid updates leave the record intact', async () => {
  assert.equal((await request(`/${entry.id}`, 'PATCH', { port: 4000 })).status, 401);
  assert.equal((await request(`/${entry.id}`, 'DELETE', undefined, 'a'.repeat(48))).status, 401);
  for (const body of [{}, { port: 80 }, { token_hash: 'oops' }, { ip: '127.0.0.1' }]) {
    assert.equal((await request(`/${entry.id}`, 'PATCH', body, entry.edit_token)).status, 400);
  }
  const updated = await request(`/${entry.id}`, 'PATCH', { port: 4000 }, entry.edit_token);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).port, 4000);
  assert.equal((await request(`/${entry.id}`, 'DELETE', undefined, entry.edit_token)).status, 204);
  assert.equal((await request(`/${entry.id}`)).status, 404);
});
test('rate limits writes while allowing reads', async () => {
  const limited = createApp({ database: ':memory:', rateLimit: 1 });
  const fetch = client(limited.app);
  const url = 'http://test/api/apis';
  try {
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };
    assert.equal((await fetch(url, options)).status, 400);
    const response = await fetch(url, options);
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers.get('Retry-After')) > 0);
    assert.equal((await fetch(url)).status, 200);
  } finally { limited.db.close(); }
});

test('cross-origin JSON and bearer-token preflights succeed', async () => {
  const response = await fetch(`${base}/api/apis`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'content-type,authorization' } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(response.headers.get('access-control-allow-methods'), /PATCH/);
  assert.match(response.headers.get('access-control-allow-headers'), /Authorization/);
  const error = await request('', 'POST', {});
  assert.equal(error.headers.get('access-control-allow-origin'), '*');
});
