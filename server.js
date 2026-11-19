import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, clean } from './validation.js';

const here = dirname(fileURLToPath(import.meta.url));
const hash = token => createHash('sha256').update(token).digest('hex');

export function createApp({ database = join(here, 'data', 'registry.sqlite'), rateLimit = 60 } = {}) {
  if (database !== ':memory:') mkdirSync(dirname(database), { recursive: true });
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS apis (
      id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      creator TEXT NOT NULL, description TEXT NOT NULL,
      ip TEXT NOT NULL, port INTEGER NOT NULL, token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(ip, port)
    );`);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'Location, Retry-After',
      'Access-Control-Max-Age': '600' });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' https://www.ucsbacm.com; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  // Bound the limiter to one minute of visitors. Ignore forwarded headers.
  const requests = new Map();
  let windowEnds = Date.now() + 60_000;
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (Date.now() >= windowEnds) { requests.clear(); windowEnds = Date.now() + 60_000; }
    const count = (requests.get(req.ip) || 0) + 1;
    requests.set(req.ip, count);
    if (count > rateLimit) return res.status(429).set('Retry-After', String(Math.ceil((windowEnds - Date.now()) / 1000))).json({ error: 'Too many changes. Try again in one minute.' });
    if (req.method !== 'DELETE' && !req.is('application/json')) {
      return res.status(415).json({ error: 'Set Content-Type to application/json and choose raw JSON in Postman.' });
    }
    next();
  });
  const publicFields = 'id, name, creator, description, ip, port, created_at';
  const get = id => db.prepare(`SELECT ${publicFields} FROM apis WHERE id = ?`).get(id);
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/apis', (req, res) => res.json({ apis: db.prepare(`SELECT ${publicFields} FROM apis ORDER BY created_at DESC, rowid DESC`).all() }));
  app.get('/api/apis/:id', (req, res) => {
    const api = get(req.params.id);
    res.status(api ? 200 : 404).json(api || { error: 'API not found.' });
  });
  app.post('/api/apis', (req, res, next) => {
    const errors = validate(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check your registration.', fields: errors });
    if (db.prepare('SELECT COUNT(*) AS count FROM apis').get().count >= 500) return res.status(503).json({ error: 'The workshop directory is full. Ask your host.' });
    const api = clean(req.body);
    const id = randomBytes(8).toString('hex');
    const edit_token = randomBytes(24).toString('hex');
    try {
      db.prepare('INSERT INTO apis VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, api.name, api.creator, api.description, api.ip, api.port, hash(edit_token), new Date().toISOString());
      res.status(201).location(`/api/apis/${id}`).json({ ...get(id), edit_token, message: 'You are on the board! Save your edit_token; it is only shown once.' });
    } catch (error) { next(error); }
  });
  function owner(req, res, next) {
    const row = db.prepare('SELECT token_hash FROM apis WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'API not found.' });
    const token = req.get('Authorization')?.match(/^Bearer ([a-f0-9]{48})$/)?.[1];
    if (!token || !timingSafeEqual(Buffer.from(hash(token)), Buffer.from(row.token_hash))) {
      return res.status(401).json({ error: 'Use Authorization: Bearer YOUR_EDIT_TOKEN from your registration response.' });
    }
    next();
  }
  app.patch('/api/apis/:id', owner, (req, res, next) => {
    const errors = validate(req.body, true);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check your update.', fields: errors });
    const body = clean(req.body);
    try {
      db.prepare(`UPDATE apis SET ${Object.keys(body).map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(body), req.params.id);
      res.json(get(req.params.id));
    } catch (error) { next(error); }
  });
  app.delete('/api/apis/:id', owner, (req, res) => {
    db.prepare('DELETE FROM apis WHERE id = ?').run(req.params.id);
    res.sendStatus(204);
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found. Try GET /api/apis or POST /api/apis.' }));
  app.use(express.static(join(here, 'public')));
  app.use((error, req, res, next) => {
    if (error.code?.startsWith('ERR_SQLITE') && /UNIQUE constraint/.test(error.message)) {
      return res.status(409).json({ error: 'That API name or IP + port is already registered. PATCH your entry or choose a different one.' });
    }
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Keep your JSON under 8 KB.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON. Check commas, quotes, and trailing commas.' });
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Ask the workshop host.' });
  });
  return { app, db };
}

if (process.argv[1] === import.meta.filename) {
  const { app } = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => console.log(`API Social: http://localhost:${port}`));
}
