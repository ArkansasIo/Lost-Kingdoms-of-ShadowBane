#!/usr/bin/env node
// ================================================================ LOST KINGDOM OF SHADOWBANE CHRONICLES REALM SERVER
// A small, dependency-free game server (Node 18+). It:
//   - serves the game client (dist/gbquest.html, /fullscreen, /atlas) on the same origin
//   - runs accounts: register / login / logout, scrypt-hashed passwords, session tokens
//   - stores cloud saves (3 slots per account) and the realm leaderboard
//   - relays live play: presence, chat, and the host-server battle topics (srv_*), using
//     Server-Sent Events for server->client and small JSON POSTs for client->server
//
//   node backend/server.cjs                -> http://127.0.0.1:8787   (npm run server; server/server.cjs still works)
//   PORT=9000 HOST=0.0.0.0 node backend/server.cjs   (LAN play; put it behind HTTPS for the internet)
//
// Data lives in server/data/realm.json (written atomically). Delete it to reset the realm.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib'), { URL } = require('url');
const { createDebugLog, createAuditLog } = require('./logs.cjs');
const Guilds = require('./guilds.cjs'), Finder = require('./groupfinder.cjs');

const ROOT = path.join(__dirname, '..');
const PORT = +process.env.PORT || 8787, HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.GBQ_DATA || path.join(ROOT, 'server', 'data'), DB_FILE = path.join(DATA_DIR, 'realm.json');
const LOG_DIR = process.env.GBQ_LOG_DIR || path.join(DATA_DIR, 'logs');

// ---------------------------------------------------------------- logs (see backend/logs.cjs)
//   GBQ_LOG_LEVEL=error|warn|info|debug  (default info; debug also logs every request)
//   GBQ_LOG_DIR                           (default <data>/logs)   GBQ_LOG_QUIET=1 stops console echo
const log = createDebugLog({ dir: LOG_DIR, level: process.env.GBQ_LOG_LEVEL || 'info', echo: process.env.GBQ_LOG_QUIET !== '1' });
const audit = createAuditLog({ dir: LOG_DIR, onError: (e, entry) => log.error('audit write failed', { err: e, action: entry.action }) });
process.on('uncaughtException', e => { log.error('uncaught exception', e); log.flush(); try { flush(); } catch (err) { /* best effort */ } process.exit(1); });
process.on('unhandledRejection', e => log.error('unhandled promise rejection', e instanceof Error ? e : { reason: String(e) }));
const ROOT_ACCOUNT_ID = String(process.env.GBQ_ROOT_ID || '').toLowerCase();
const ADMIN_ACCOUNT_ID = String(process.env.GBQ_ADMIN_ID || '').toLowerCase();
// Privileged realm administration is opt-in; public/default deployments keep it disabled.
const ADMIN_ENABLED = process.env.GBQ_ENABLE_ADMIN === '1';
const TOKEN_DAYS = 30, MAX_BODY = 64 * 1024, MAX_SAVE = 1024 * 1024, SLOTS = 3, MAX_PRESENCE = 2048;
const TOPICS = new Set(['srv_join', 'srv_char', 'srv_battle', 'srv_turn', 'srv_act', 'srv_end', 'chat', 'trade']);

// ---------------------------------------------------------------- storage
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { accounts: {}, sessions: {}, saves: {}, heroes: {}, market: {}, proceeds: {}, friendships: {}, friendRequests: {}, inviteCodes: {}, bans: {}, adminAudit: [] };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); }
catch (e) { if (e.code === 'ENOENT') log.info('no realm data yet; starting a new realm', { file: DB_FILE }); else log.error('realm data unreadable; starting empty (the old file is left in place)', { file: DB_FILE, err: e }); }
db.friendships ||= {}; db.friendRequests ||= {}; db.inviteCodes ||= {};
db.bans ||= {}; db.adminAudit ||= [];
db.staffRoles ||= {};
Guilds.ensure(db);
db.realmSettings = Object.assign({
  realmName: process.env.REALM || 'LOCAL REALM', maintenance: false, registrationOpen: true,
  chatEnabled: true, marketplaceEnabled: true, invitesEnabled: true,
  socialEnabled: true, cloudSavesEnabled: true, leaderboardEnabled: true, livePlayEnabled: true,
  guildsEnabled: true, groupFinderEnabled: true,
  maxListingsPerPlayer: 20, maxInviteCodesPerPlayer: 5, inviteTtlMinutes: 15,
  chatMessagesPer10Seconds: 5, maxSaveBytes: MAX_SAVE,
}, db.realmSettings || {});
// older realms kept admin actions only inside realm.json; carry them into the audit file once
if (!audit.seq && db.adminAudit.length) {
  for (const a of db.adminAudit) audit.record({ at: a.at, action: 'admin.' + a.action, actor: a.actor, target: a.target, details: a.details, outcome: 'success' });
  log.info('imported earlier admin audit entries', { count: db.adminAudit.length });
}
let dirty = false;
const save = () => { dirty = true; };
setInterval(() => {
  if (!dirty) return; dirty = false;
  const t0 = Date.now();
  try { const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); }
  catch (e) { dirty = true; log.error('realm data write failed; will retry', { file: DB_FILE, err: e }); return; }
  log.debug('realm data saved', { ms: Date.now() - t0 });
}, 1000).unref();
const flush = () => { if (dirty) { fs.writeFileSync(DB_FILE, JSON.stringify(db)); dirty = false; } };
const shutdown = sig => { log.info('shutting down', { signal: sig }); try { flush(); } catch (e) { log.error('final save failed', e); } log.flush(); process.exit(0); };
process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));

// ---------------------------------------------------------------- accounts
// db tables are plain objects keyed by user input; a name like "constructor" or "__proto__" would
// otherwise resolve to an inherited Object.prototype member instead of "no such entry"
const own = (table, key) => Object.hasOwn(table, key) ? table[key] : undefined;
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
const validName = n => typeof n === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(n);
const validPw = p => typeof p === 'string' && p.length >= 8 && p.length <= 72;
const newToken = () => crypto.randomBytes(32).toString('hex');
function sessionFor(req, url) {
  const h = req.headers.authorization || '', tok = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  if (!tok || !/^[0-9a-f]{64}$/.test(tok)) return null;
  const s = db.sessions[tok]; if (!s) return null;
  if (s.exp < Date.now()) { delete db.sessions[tok]; save(); return null; }
  const acct = Object.values(db.accounts).find(a => a.id === s.uid); return acct && !db.bans[acct.id] ? { token: tok, acct } : null;
}
// login throttling: 10 failures per 10 minutes per ip and per username
const fails = new Map();
const throttled = key => { const f = fails.get(key); return f && f.n >= 10 && Date.now() - f.t < 600e3; };
const fail = key => { const f = fails.get(key); if (!f || Date.now() - f.t > 600e3) fails.set(key, { n: 1, t: Date.now() }); else f.n++; };
// housekeeping: stale throttle windows (one per name tried) and expired sessions otherwise pile up forever
setInterval(() => {
  const now = Date.now();
  for (const [k, f] of fails) if (now - f.t > 600e3) fails.delete(k);
  let n = 0; for (const t in db.sessions) if (db.sessions[t].exp < now) { delete db.sessions[t]; n++; }
  if (n) { save(); log.debug('expired sessions removed', { count: n }); }
}, 600e3).unref();
const publicAcct = a => ({ id: a.id, uid: a.uid, name: a.name, created: a.created });
const isAdmin = acct => !!ADMIN_ACCOUNT_ID && acct.id.toLowerCase() === ADMIN_ACCOUNT_ID;
const isRoot = acct => !!ROOT_ACCOUNT_ID && acct.id.toLowerCase() === ROOT_ACCOUNT_ID;
// staffRoles may hold 'root' only when set by a localhost claim or the admin CLI (backend/admin-cli.cjs)
const adminRoleFor = acct => !ADMIN_ENABLED ? 'player' : isRoot(acct) ? 'root' : isAdmin(acct) ? 'admin' : (['root', 'admin', 'moderator'].includes(db.staffRoles[acct.id]) ? db.staffRoles[acct.id] : 'player');
// does the realm already have someone who can run it?
const hasRealmAdmin = () => (!!ROOT_ACCOUNT_ID && !!accountById(ROOT_ACCOUNT_ID)) || (!!ADMIN_ACCOUNT_ID && !!accountById(ADMIN_ACCOUNT_ID)) || Object.values(db.staffRoles).some(r => r === 'root' || r === 'admin');
// a request made on the server's own computer, not through a proxy (a proxy on the same machine would look local)
const isLocalRequest = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !req.headers['x-forwarded-for'] && !req.headers['forwarded'];
const rolePermissions = {
  root: ['overview.view', 'players.view', 'players.moderate', 'settings.manage', 'staff.manage', 'accounts.create', 'audit.view', 'logs.view'],
  admin: ['overview.view', 'players.view', 'players.moderate', 'settings.manage', 'staff.manage', 'accounts.create', 'audit.view', 'logs.view'],
  moderator: ['overview.view', 'players.view', 'players.moderate', 'audit.view'],
  player: [],
};
const hasPermission = (acct, permission) => (rolePermissions[adminRoleFor(acct)] || []).includes(permission);
// ctx: { actor, actorId, ip, reqId }. Kept in realm.json for the in-game GM console and written to audit.log.
function addAdminAudit(ctx, action, target, details) {
  const entry = { at: Date.now(), actor: ctx.actor, action, target };
  if (details) entry.details = details;
  db.adminAudit.push(entry);
  if (db.adminAudit.length > 1000) db.adminAudit.splice(0, db.adminAudit.length - 1000);
  audit.record({ ...ctx, action: 'admin.' + action, target, details });
}
const REALMS = [
  { id: 'ardenhold', name: 'Ardenhold', type: 'Roleplay', status: 'online' },
  { id: 'ironreach', name: 'Ironreach', type: 'PvE', status: 'online' },
  { id: 'moonfall', name: 'Moonfall', type: 'PvE', status: 'online' },
  { id: 'stormwake', name: 'Stormwake', type: 'PvP', status: 'online' },
  { id: 'dawnspire', name: 'Dawnspire', type: 'Roleplay', status: 'online' },
  { id: 'emberwild', name: 'Emberwild', type: 'PvE', status: 'online' },
  { id: 'frostmarch', name: 'Frostmarch', type: 'PvP', status: 'online' },
  { id: 'starhaven', name: 'Starhaven', type: 'Seasonal', status: 'online' },
  { id: 'shadowfen', name: 'Shadowfen', type: 'Roleplay', status: 'online' },
];
function friendIds(uid) { return db.friendships[uid] || (db.friendships[uid] = []); }
function accountById(id) { return Object.values(db.accounts).find(a => a.id === id); }
function publicFriend(uid) {
  const acct = accountById(uid); if (!acct) return null;
  const online = [...clients.values()].some(c => c.uid === uid);
  return { id: acct.id, name: acct.name, online };
}

// ---------------------------------------------------------------- live realm (SSE)
const clients = new Map(); // peer -> { res, uid, name, presence }
const chatWindows = new Map();
const peerList = () => [...clients.entries()].map(([peer, c]) => ({ peer, presence: c.presence || {}, kind: 'viewer', name: c.name }));
function send(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcastPeers(left = []) {
  const list = peerList();
  for (const [peer, c] of clients) send(c.res, 'peers', { peers: list.map(p => ({ ...p, sameTab: p.peer === peer })), left: left.map(p => ({ peer: p })) });
}
setInterval(() => { for (const c of clients.values()) c.res.write(': ping\n\n'); }, 25000).unref();
// push a server event to every live tab of one account (guild and group finder notices)
function sendToAccount(uid, event, data) { for (const c of clients.values()) if (c.uid === uid) send(c.res, event, data); }

// ---------------------------------------------------------------- group finder (in memory; see backend/groupfinder.cjs)
const finder = Finder.createFinder();
function finderEvents(events) {
  for (const ev of events || []) {
    if (ev.type === 'ready-check') for (const m of ev.check.members) sendToAccount(m.uid, 'finder', ev);
    else if (ev.type === 'ready-failed') { for (const u of ev.requeued) sendToAccount(u, 'finder', ev); for (const u of ev.dropped || []) sendToAccount(u, 'finder', { type: 'dropped', check: ev.check }); }
    else if (ev.type === 'grouped') for (const m of ev.group.members) sendToAccount(m.uid, 'finder', ev);
  }
}
setInterval(() => finderEvents(Finder.tick(finder)), 5000).unref();

// ---------------------------------------------------------------- http helpers
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'SAMEORIGIN' };
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC }); res.end(JSON.stringify(obj)); }
function body(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      let v; try { v = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch (e) { return reject(Object.assign(new Error('bad json'), { code: 400 })); }
      // every route destructures an object; null, arrays and bare values used to crash with a 500
      if (!v || typeof v !== 'object' || Array.isArray(v)) return reject(Object.assign(new Error('body must be a JSON object'), { code: 400 }));
      resolve(v);
    });
    req.on('error', reject);
  });
}
// The game pages are large single files (dist/gbquest.html is ~67 MB of inlined art). Reading one from disk on every
// request made each page load slow, so each file is gzipped once and kept in memory until it changes on disk, and
// browsers get an ETag: a reload answers 304 Not Modified instead of sending the whole game again.
// Clients that do not accept gzip are streamed the file from disk.
const staticCache = new Map(); // file -> { key, etag, gz: Promise<Buffer> }
function staticEntry(file, st) {
  const key = st.size + ':' + st.mtimeMs, hit = staticCache.get(file);
  if (hit && hit.key === key) return hit;
  const entry = { key, etag: '"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"' };
  entry.gz = fs.promises.readFile(path.join(ROOT, file)).then(buf => new Promise((ok, no) => zlib.gzip(buf, { level: 6 }, (e, gz) => e ? no(e) : ok(gz))));
  entry.gz.catch(() => { if (staticCache.get(file) === entry) staticCache.delete(file); });
  staticCache.set(file, entry);
  return entry;
}
function serveFile(req, res, file, type) {
  const full = path.join(ROOT, file);
  fs.stat(full, async (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404, SEC); return res.end('Not built yet: run python3 tools/build.py'); }
    const entry = staticEntry(file, st), head = { 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: entry.etag, Vary: 'Accept-Encoding', ...SEC };
    const inm = String(req.headers['if-none-match'] || '');
    if (inm && inm.split(',').some(t => t.trim().replace(/^W\//, '') === entry.etag)) { res.ttfbMs = res.elapsed(); res.writeHead(304, head); return res.end(); }
    if (/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
      let gz; try { gz = await entry.gz; } catch (err) { res.writeHead(500, SEC); return res.end('Could not read file'); }
      res.ttfbMs = res.elapsed(); res.writeHead(200, { ...head, 'Content-Encoding': 'gzip', 'Content-Length': gz.length });
      return res.end(req.method === 'HEAD' ? undefined : gz);
    }
    res.ttfbMs = res.elapsed(); res.writeHead(200, { ...head, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(full).on('error', () => res.destroy()).pipe(res);
  });
}
// gzip the game pages at startup so the first visitor does not wait for it
function warmStatic() { for (const file of new Set(['dist/gbquest.html', 'dist/gbquest-fullscreen.html', 'dist/atlas.html'])) fs.stat(path.join(ROOT, file), (e, st) => { if (!e && st.isFile()) staticEntry(file, st).gz.catch(() => {}); }); }
const STATIC = { '/': 'dist/gbquest.html', '/fullscreen': 'dist/gbquest-fullscreen.html', '/atlas': 'dist/atlas.html', '/dist/atlas.html': 'dist/atlas.html', '/admin': 'admin/controlplane.html', '/admin/': 'admin/controlplane.html', '/admin/controlplane.js': 'admin/controlplane.js' };

// ---------------------------------------------------------------- routes
// client IP: the socket address, or X-Forwarded-For when GBQ_TRUST_PROXY=1 (only behind your own reverse proxy)
const TRUST_PROXY = process.env.GBQ_TRUST_PROXY === '1';
const clientIp = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
const SLOW_MS = +process.env.GBQ_SLOW_MS || 1000;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`), p = url.pathname, ip = clientIp(req);
  // every response carries X-Request-Id so a player's error report can be matched to the debug log
  const reqId = crypto.randomBytes(6).toString('hex'), t0 = process.hrtime.bigint();
  res.setHeader('X-Request-Id', reqId);
  res.elapsed = () => Number(process.hrtime.bigint() - t0) / 1e6;
  let who = null; // account name once the session is known
  res.on('finish', () => {
    if (p === '/api/stream') return; // long-lived; logged on open/close instead
    const ms = res.elapsed(), line = { reqId, method: req.method, path: p, status: res.statusCode, ms: +ms.toFixed(1), ip };
    if (who) line.account = who;
    // for game pages, downloading tens of megabytes takes as long as the player's connection needs; only the time
    // the server took to start answering says whether the server was slow
    if (res.ttfbMs != null) line.ttfbMs = +res.ttfbMs.toFixed(1);
    const serverMs = res.ttfbMs != null ? res.ttfbMs : ms;
    if (res.statusCode >= 500) log.error('request failed', line);
    else if (serverMs > SLOW_MS) log.warn('slow request', line);
    else log.debug('request', line);
  });
  const A = event => audit.record({ ip, reqId, ...event }); // audit with request context
  try {
    // Hide the control plane and deny every admin API route unless explicitly enabled.
    if (!ADMIN_ENABLED && (p === '/admin' || p.startsWith('/admin/') || p.startsWith('/api/admin/'))) return json(res, 404, { error: 'Not found.' });
    if ((req.method === 'GET' || req.method === 'HEAD') && STATIC[p]) return serveFile(req, res, STATIC[p], p.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    if (!p.startsWith('/api/')) { res.writeHead(404, SEC); return res.end('Not found'); }

    if (p === '/api/health') return json(res, 200, { ok: true, game: 'LOST KINGDOM OF SHADOWBANE CHRONICLES', realm: db.realmSettings.realmName, maintenance: db.realmSettings.maintenance, players: clients.size, accounts: Object.keys(db.accounts).length, realms: REALMS });
    if (p === '/api/realms' && req.method === 'GET') return json(res, 200, { realms: REALMS.map((realm, index) => index === 0 ? { ...realm, name: db.realmSettings.realmName } : realm) });
    if (p === '/api/store/catalog' && req.method === 'GET') return json(res, 200, require('../store/catalog.cjs').getCatalog());

    if (p === '/api/register' && req.method === 'POST') {
      if (!db.realmSettings.registrationOpen || db.realmSettings.maintenance) return json(res, 503, { error: 'New account registration is currently unavailable.' });
      const { username, password } = await body(req);
      if (!validName(username)) return json(res, 400, { error: 'Username: 3-16 letters, digits or _.' });
      if (!validPw(password)) return json(res, 400, { error: 'Password: 8-72 characters.' });
      const key = username.toLowerCase(); if (own(db.accounts, key)) return json(res, 409, { error: 'That name is taken.' });
      if (throttled('reg:' + ip)) { A({ action: 'auth.register', actor: username, outcome: 'throttled' }); log.warn('registration throttled', { ip, reqId }); return json(res, 429, { error: 'Too many attempts. Try later.' }); }
      fail('reg:' + ip); // count registrations per ip too
      const salt = crypto.randomBytes(16).toString('hex'), hash = (await scrypt(password, salt)).toString('hex');
      const acct = { id: crypto.randomUUID(), name: username, salt, hash, created: Date.now(), lastLogin: Date.now() };
      db.accounts[key] = acct; const token = newToken(); db.sessions[token] = { uid: acct.id, exp: Date.now() + TOKEN_DAYS * 864e5 }; save();
      A({ action: 'auth.register', actor: acct.name, actorId: acct.id }); who = acct.name;
      return json(res, 201, { token, account: publicAcct(acct) });
    }
    if (p === '/api/login' && req.method === 'POST') {
      const { username, password } = await body(req);
      const key = String(username || '').toLowerCase();
      const tried = key.slice(0, 32).replace(/[^\w.-]/g, '?'); // attempted name, sanitised; never the password
      if (throttled('ip:' + ip) || throttled('u:' + key)) { A({ action: 'auth.login', actor: tried, outcome: 'throttled' }); log.warn('login throttled', { ip, name: tried, reqId }); return json(res, 429, { error: 'Too many attempts. Try again in a few minutes.' }); }
      const acct = own(db.accounts, key);
      const salt = acct ? acct.salt : '00', want = acct ? Buffer.from(acct.hash, 'hex') : Buffer.alloc(64);
      const got = await scrypt(String(password || ''), salt); // always hash, so timing does not reveal which names exist
      if (!acct || !crypto.timingSafeEqual(got, want)) {
        fail('ip:' + ip); fail('u:' + key);
        A({ action: 'auth.login', actor: acct ? acct.name : tried, actorId: acct ? acct.id : null, outcome: 'failure', details: { reason: acct ? 'wrong_password' : 'unknown_account' } });
        return json(res, 401, { error: 'Wrong name or password.' });
      }
      if (db.bans[acct.id]) { A({ action: 'auth.login', actor: acct.name, actorId: acct.id, outcome: 'denied', details: { reason: 'suspended' } }); return json(res, 403, { error: 'This account is suspended.' }); }
      if (db.realmSettings.maintenance && !['root', 'admin'].includes(adminRoleFor(acct))) { A({ action: 'auth.login', actor: acct.name, actorId: acct.id, outcome: 'denied', details: { reason: 'maintenance' } }); return json(res, 503, { error: 'The realm is under maintenance. Please try again later.' }); }
      fails.delete('u:' + key);
      acct.lastLogin = Date.now(); const token = newToken(); db.sessions[token] = { uid: acct.id, exp: Date.now() + TOKEN_DAYS * 864e5 }; save();
      const role = adminRoleFor(acct);
      A({ action: 'auth.login', actor: acct.name, actorId: acct.id, details: role !== 'player' ? { role } : undefined }); who = acct.name;
      return json(res, 200, { token, account: publicAcct(acct) });
    }

    const sess = sessionFor(req, url);
    if (!sess) {
      // unauthenticated calls to staff routes are worth recording; ordinary expired sessions are not
      if (p.startsWith('/api/admin/')) A({ action: 'admin.access', actor: null, target: p, outcome: 'denied', details: { reason: 'no_session' } });
      return json(res, 401, { error: 'Log in first.' });
    }
    const uid = sess.acct.id; who = sess.acct.name;
    const actx = { actor: sess.acct.name, actorId: uid, ip, reqId }; // audit context for this caller
    const deny = (why = 'permission', message = 'Permission denied.') => { A({ ...actx, action: 'admin.access', target: `${req.method} ${p}`, outcome: 'denied', details: { reason: why, role: adminRoleFor(sess.acct) } }); return json(res, 403, { error: message }); };

    if (db.realmSettings.maintenance && !['root', 'admin'].includes(adminRoleFor(sess.acct)) && !p.startsWith('/api/admin/') && !['/api/logout', '/api/me'].includes(p)) return json(res, 503, { error: 'The realm is under maintenance. Please try again later.' });

    if (p === '/api/store/checkout' && req.method === 'POST') return json(res, 503, { error: 'Checkout is disabled until a payment provider and server-side fulfillment are configured.' });

    if (p.startsWith('/api/admin/')) {
      // first-run bootstrap: on a realm with no root/admin, an account signed in on the server's own computer
      // can claim root. Never possible remotely, through a proxy, or once any admin exists.
      if (p === '/api/admin/claim' && req.method === 'POST') {
        if (!isLocalRequest(req)) { A({ ...actx, action: 'admin.claim', target: 'realm', outcome: 'denied', details: { reason: 'not_local' } }); return json(res, 403, { error: 'Claim admin from the computer running the realm server.' }); }
        if (hasRealmAdmin()) { A({ ...actx, action: 'admin.claim', target: 'realm', outcome: 'denied', details: { reason: 'admin_exists' } }); return json(res, 409, { error: 'This realm already has an admin.' }); }
        db.staffRoles[uid] = 'root'; addAdminAudit(actx, 'claim', sess.acct.name, { role: 'root', via: 'localhost' }); save();
        log.info('realm admin claimed', { account: sess.acct.name, reqId });
        return json(res, 200, { ok: true, role: 'root', permissions: rolePermissions.root });
      }
      if (p === '/api/admin/me' && req.method === 'GET') {
        const role = adminRoleFor(sess.acct);
        // the game client probes this for every player to decide whether to show staff tools: not an audit event
        if (role === 'player') { log.debug('staff role probe: not staff', { reqId, account: sess.acct.name }); return json(res, 403, { error: 'This account has no staff permissions.' }); }
        return json(res, 200, { account: publicAcct(sess.acct), role, permissions: rolePermissions[role] });
      }
      if (p === '/api/admin/overview' && req.method === 'GET') {
        if (!hasPermission(sess.acct, 'overview.view')) return deny();
        return json(res, 200, { realm: db.realmSettings.realmName, maintenance: db.realmSettings.maintenance, online: clients.size, accounts: Object.keys(db.accounts).length, bans: Object.keys(db.bans).length, activeListings: Object.keys(db.market || {}).length, activeInvites: Object.values(db.inviteCodes).filter(i => i.expiresAt > Date.now()).length });
      }
      if (p === '/api/admin/players' && req.method === 'GET') {
        if (!hasPermission(sess.acct, 'players.view')) return deny();
        return json(res, 200, { players: Object.values(db.accounts).map(a => ({ id: a.id, name: a.name, created: a.created, lastLogin: a.lastLogin || null, online: [...clients.values()].some(c => c.uid === a.id), banned: !!db.bans[a.id], role: adminRoleFor(a) })).sort((a, b) => b.created - a.created).slice(0, 200) });
      }
      if (p === '/api/admin/settings' && req.method === 'GET') {
        if (!hasPermission(sess.acct, 'settings.manage')) return deny();
        return json(res, 200, { settings: db.realmSettings });
      }
      if (p === '/api/admin/settings' && req.method === 'PUT') {
        if (!hasPermission(sess.acct, 'settings.manage')) return deny();
        const input = await body(req);
        const current = db.realmSettings;
        const booleanKeys = ['maintenance', 'registrationOpen', 'chatEnabled', 'marketplaceEnabled', 'invitesEnabled', 'socialEnabled', 'cloudSavesEnabled', 'leaderboardEnabled', 'livePlayEnabled', 'guildsEnabled', 'groupFinderEnabled'];
        const numberRanges = { maxListingsPerPlayer: [1, 20], maxInviteCodesPerPlayer: [1, 20], inviteTtlMinutes: [1, 60], chatMessagesPer10Seconds: [1, 20], maxSaveBytes: [65536, MAX_SAVE] };
        const allowed = new Set(['realmName', ...booleanKeys, ...Object.keys(numberRanges)]);
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.has(key))) return json(res, 400, { error: 'Unknown or invalid settings.' });
        const next = { ...current };
        if (Object.hasOwn(input, 'realmName')) {
          const name = String(input.realmName).trim().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 40);
          if (!name) return json(res, 400, { error: 'Realm name is required.' });
          next.realmName = name;
        }
        for (const key of booleanKeys) if (Object.hasOwn(input, key)) {
          if (typeof input[key] !== 'boolean') return json(res, 400, { error: `${key} must be true or false.` });
          next[key] = input[key];
        }
        for (const [key, [min, max]] of Object.entries(numberRanges)) if (Object.hasOwn(input, key)) {
          if (!Number.isInteger(input[key]) || input[key] < min || input[key] > max) return json(res, 400, { error: `${key} must be an integer from ${min} to ${max}.` });
          next[key] = input[key];
        }
        const changed = Object.keys(next).filter(key => next[key] !== current[key]);
        db.realmSettings = next;
        if ((next.maintenance && !current.maintenance) || (!next.livePlayEnabled && current.livePlayEnabled)) {
          for (const [peer, live] of clients) {
            const owner = accountById(live.uid);
            if (!next.livePlayEnabled || (next.maintenance && owner && !['root', 'admin'].includes(adminRoleFor(owner)))) { live.res.end(); clients.delete(peer); }
          }
          broadcastPeers();
        }
        if (changed.length) { addAdminAudit(actx, 'settings.update', 'realm', { changed }); save(); }
        return json(res, 200, { settings: db.realmSettings });
      }
      if (p === '/api/admin/accounts' && req.method === 'POST') {
        if (!hasPermission(sess.acct, 'accounts.create')) return deny();
        const input = await body(req), username = input.username, password = input.password, role = input.role || 'player';
        if (!validName(username)) return json(res, 400, { error: 'Username: 3-16 letters, digits or _.' });
        if (!validPw(password)) return json(res, 400, { error: 'Password: 8-72 characters.' });
        if (!['player', 'moderator', 'admin'].includes(role)) return json(res, 400, { error: 'Role must be player, moderator or admin.' });
        if (role === 'admin' && adminRoleFor(sess.acct) !== 'root') return json(res, 403, { error: 'Only root can create admin accounts.' });
        const key = username.toLowerCase();
        if (own(db.accounts, key)) return json(res, 409, { error: 'That name is already taken.' });
        const salt = crypto.randomBytes(16).toString('hex');
        const acct = { id: crypto.randomUUID(), name: username, salt, hash: (await scrypt(password, salt)).toString('hex'), created: Date.now(), lastLogin: null };
        db.accounts[key] = acct;
        if (role !== 'player') db.staffRoles[acct.id] = role;
        addAdminAudit(actx, 'account.create', acct.name, { role }); save();
        return json(res, 201, { account: publicAcct(acct), role });
      }
      if (p === '/api/admin/permissions' && req.method === 'GET') {
        if (!hasPermission(sess.acct, 'staff.manage')) return deny();
        const staff = Object.values(db.accounts).filter(a => adminRoleFor(a) !== 'player').map(a => ({ id: a.id, name: a.name, role: adminRoleFor(a) }));
        return json(res, 200, { roles: rolePermissions, staff });
      }
      const roleMatch = p.match(/^\/api\/admin\/players\/([0-9a-f-]{36})\/role$/i);
      if (roleMatch && req.method === 'PUT') {
        if (!hasPermission(sess.acct, 'staff.manage')) return deny();
        const target = accountById(roleMatch[1]);
        if (!target) return json(res, 404, { error: 'Account not found.' });
        if (isRoot(target) || isAdmin(target)) return json(res, 400, { error: 'Environment-configured root/admin accounts cannot be changed here.' });
        if (adminRoleFor(target) === 'root') return json(res, 400, { error: 'Root accounts are changed with the admin CLI (npm run admin).' });
        if (adminRoleFor(target) === 'admin' && adminRoleFor(sess.acct) !== 'root') return json(res, 403, { error: 'Only root can change admin accounts.' });
        const input = await body(req), role = input.role;
        if (!['player', 'moderator', 'admin'].includes(role)) return json(res, 400, { error: 'Role must be player, moderator or admin.' });
        if (role === 'admin' && adminRoleFor(sess.acct) !== 'root') return json(res, 403, { error: 'Only root can assign admin access.' });
        if (role !== 'player') db.staffRoles[target.id] = role;
        else delete db.staffRoles[target.id];
        addAdminAudit(actx, 'staff.role', target.name, { role }); save();
        return json(res, 200, { ok: true, role });
      }
      // GET /api/admin/audit?action=auth.&actor=&target=&outcome=failure&ip=&since=<ms>&limit=100
      //   action matches exactly or by prefix: "auth" / "auth." / "auth.*" all match auth.login, auth.register...
      if (p === '/api/admin/audit' && req.method === 'GET') {
        if (!hasPermission(sess.acct, 'audit.view')) return deny();
        const q = Object.fromEntries(url.searchParams), limit = Math.max(1, Math.min(1000, parseInt(q.limit, 10) || 100));
        const entries = audit.query({ limit, action: q.action || '', actor: q.actor || '', target: q.target || '', outcome: q.outcome || '', ip: q.ip || '', since: +q.since || 0 });
        return json(res, 200, { entries, seq: audit.seq });
      }
      // GET /api/admin/audit/verify -> { ok, checked, head } or { ok:false, seq, error }: detects edited or removed entries
      if (p === '/api/admin/audit/verify' && req.method === 'GET') {
        if (!hasPermission(sess.acct, 'audit.view')) return deny();
        const result = audit.verify();
        A({ ...actx, action: 'admin.audit.verify', target: 'audit.log', outcome: result.ok ? 'success' : 'failure', details: result.ok ? { checked: result.checked } : { seq: result.seq, error: result.error } });
        if (!result.ok) log.error('audit chain verification failed', result);
        return json(res, 200, result);
      }
      // GET /api/admin/logs?level=warn&q=text&limit=200 -> debug log, newest first (root/admin only)
      if (p === '/api/admin/logs' && req.method === 'GET') {
        if (!hasPermission(sess.acct, 'logs.view')) return deny();
        const q = Object.fromEntries(url.searchParams), limit = Math.max(1, Math.min(1000, parseInt(q.limit, 10) || 200));
        return json(res, 200, { level: log.level, entries: log.tail({ limit, level: q.level || 'debug', q: String(q.q || '').slice(0, 80) }) });
      }
      // PUT /api/admin/logs/level { level } -> change verbosity without a restart (root/admin only)
      if (p === '/api/admin/logs/level' && req.method === 'PUT') {
        if (!hasPermission(sess.acct, 'logs.view')) return deny();
        const { level } = await body(req);
        if (!['error', 'warn', 'info', 'debug'].includes(level)) return json(res, 400, { error: 'Level must be error, warn, info or debug.' });
        const from = log.level; log.setLevel(level);
        A({ ...actx, action: 'admin.logs.level', target: 'debug.log', details: { from, to: level } }); log.info('log level changed', { from, to: level, by: sess.acct.name });
        return json(res, 200, { level });
      }
      const banMatch = p.match(/^\/api\/admin\/players\/([0-9a-f-]{36})\/(ban|unban)$/i);
      if (banMatch && req.method === 'POST') {
        if (!hasPermission(sess.acct, 'players.moderate')) return deny();
        const targetId = banMatch[1], action = banMatch[2].toLowerCase(), target = accountById(targetId);
        if (!target) return json(res, 404, { error: 'Account not found.' });
        if (targetId === uid) return json(res, 400, { error: 'You cannot suspend your own admin account.' });
        const rank = { player: 0, moderator: 1, admin: 2, root: 3 };
        if (rank[adminRoleFor(target)] >= rank[adminRoleFor(sess.acct)]) return json(res, 403, { error: 'You cannot suspend an account with equal or higher staff access.' });
        if (action === 'ban') {
          const input = await body(req), reason = String(input.reason || 'Admin action').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 160);
          db.bans[targetId] = { reason, at: Date.now(), by: sess.acct.name };
          let revoked = 0; for (const token of Object.keys(db.sessions)) if (db.sessions[token].uid === targetId) { delete db.sessions[token]; revoked++; }
          log.info('account suspended; sessions revoked', { target: target.name, revoked, by: sess.acct.name });
          for (const [peer, live] of clients) if (live.uid === targetId) { live.res.end(); clients.delete(peer); }
          broadcastPeers();
        } else delete db.bans[targetId];
        addAdminAudit(actx, action, target.name, action === 'ban' ? { reason: db.bans[targetId].reason } : undefined);
        save(); return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: 'No such admin operation.' });
    }

    if (p === '/api/logout' && req.method === 'POST') { delete db.sessions[sess.token]; save(); A({ ...actx, action: 'auth.logout' }); return json(res, 200, { ok: true }); }
    if (p === '/api/me') return json(res, 200, { account: publicAcct(sess.acct), slots: Object.keys(db.saves[uid] || {}), role: adminRoleFor(sess.acct), canClaimAdmin: ADMIN_ENABLED && !hasRealmAdmin() && isLocalRequest(req) });
    if (p.startsWith('/api/friends') && !db.realmSettings.socialEnabled) return json(res, 503, { error: 'Realm social features are disabled.' });
    if (p === '/api/friends' && req.method === 'GET') {
      const friends = friendIds(uid).map(publicFriend).filter(Boolean);
      const requests = (db.friendRequests[uid] || []).map(id => publicFriend(id)).filter(Boolean);
      return json(res, 200, { friends, requests });
    }
    if (p === '/api/friends/request' && req.method === 'POST') {
      const { username } = await body(req), key = String(username || '').toLowerCase(), target = own(db.accounts, key);
      if (!target) return json(res, 404, { error: 'Account not found.' });
      if (target.id === uid) return json(res, 400, { error: 'You cannot add yourself.' });
      const friends = friendIds(uid), targetFriends = friendIds(target.id);
      if (friends.includes(target.id)) return json(res, 409, { error: 'Already friends.' });
      const incoming = db.friendRequests[uid] || [];
      if (incoming.includes(target.id)) { db.friendRequests[uid] = incoming.filter(id => id !== target.id); if (!friends.includes(target.id)) friends.push(target.id); if (!targetFriends.includes(uid)) targetFriends.push(uid); save(); return json(res, 200, { ok: true, accepted: true }); }
      const outgoing = db.friendRequests[target.id] || (db.friendRequests[target.id] = []);
      if (!outgoing.includes(uid)) outgoing.push(uid);
      save(); return json(res, 200, { ok: true, pending: true });
    }
    if (p === '/api/friends/accept' && req.method === 'POST') {
      const { accountId } = await body(req), fromId = String(accountId || ''), incoming = db.friendRequests[uid] || [];
      if (!incoming.includes(fromId) || !accountById(fromId)) return json(res, 404, { error: 'Friend request not found.' });
      db.friendRequests[uid] = incoming.filter(id => id !== fromId);
      const mine = friendIds(uid), theirs = friendIds(fromId); if (!mine.includes(fromId)) mine.push(fromId); if (!theirs.includes(uid)) theirs.push(uid);
      save(); return json(res, 200, { ok: true });
    }
    if (p === '/api/friends/remove' && req.method === 'POST') {
      const { accountId } = await body(req), other = String(accountId || '');
      // only real accounts: any other string used to leave an empty friendRequests entry behind
      if (!accountById(other)) return json(res, 404, { error: 'Account not found.' });
      db.friendships[uid] = friendIds(uid).filter(id => id !== other);
      if (db.friendships[other]) db.friendships[other] = db.friendships[other].filter(id => id !== uid);
      db.friendRequests[uid] = (db.friendRequests[uid] || []).filter(id => id !== other);
      db.friendRequests[other] = (db.friendRequests[other] || []).filter(id => id !== uid);
      save(); return json(res, 200, { ok: true });
    }
    if (p === '/api/invites' && req.method === 'POST') {
      if (!db.realmSettings.invitesEnabled) return json(res, 503, { error: 'Realm invites are disabled.' });
      const { peer } = await body(req), client = clients.get(String(peer || ''));
      if (!client || client.uid !== uid) return json(res, 403, { error: 'Connect to the realm first.' });
      for (const [code, invite] of Object.entries(db.inviteCodes)) if (invite.expiresAt <= Date.now()) delete db.inviteCodes[code];
      if (Object.values(db.inviteCodes).filter(invite => invite.uid === uid).length >= db.realmSettings.maxInviteCodesPerPlayer) return json(res, 429, { error: 'You have reached the active invite code limit.' });
      let code; do { code = crypto.randomBytes(6).toString('hex').toUpperCase(); } while (db.inviteCodes[code]);
      db.inviteCodes[code] = { uid, peer, expiresAt: Date.now() + db.realmSettings.inviteTtlMinutes * 60e3 };
      save(); return json(res, 201, { code, expiresAt: db.inviteCodes[code].expiresAt });
    }
    const inviteMatch = p.match(/^\/api\/invites\/([A-F0-9]{12})$/);
    if (inviteMatch && req.method === 'GET') {
      if (!db.realmSettings.invitesEnabled) return json(res, 503, { error: 'Realm invites are disabled.' });
      const invite = db.inviteCodes[inviteMatch[1]];
      if (!invite || invite.expiresAt <= Date.now()) { if (invite) delete db.inviteCodes[inviteMatch[1]]; return json(res, 404, { error: 'Invite code expired or invalid.' }); }
      if (!clients.has(invite.peer)) return json(res, 410, { error: 'That player is no longer online.' });
      const owner = publicFriend(invite.uid);
      return json(res, 200, { peer: invite.peer, host: owner && owner.name, expiresAt: invite.expiresAt });
    }
    if (p === '/api/password' && req.method === 'POST') {
      const { oldPassword, newPassword } = await body(req);
      // a stolen session must not be a way to guess the password without the login throttle
      if (throttled('pw:' + uid)) { A({ ...actx, action: 'auth.password.change', outcome: 'throttled' }); return json(res, 429, { error: 'Too many attempts. Try again in a few minutes.' }); }
      const got = await scrypt(String(oldPassword || ''), sess.acct.salt);
      if (!crypto.timingSafeEqual(got, Buffer.from(sess.acct.hash, 'hex'))) { fail('pw:' + uid); A({ ...actx, action: 'auth.password.change', outcome: 'failure', details: { reason: 'wrong_current_password' } }); return json(res, 401, { error: 'Current password is wrong.' }); }
      if (!validPw(newPassword)) return json(res, 400, { error: 'Password: 8-72 characters.' });
      sess.acct.salt = crypto.randomBytes(16).toString('hex'); sess.acct.hash = (await scrypt(newPassword, sess.acct.salt)).toString('hex');
      let revoked = 0; for (const t in db.sessions) if (db.sessions[t].uid === uid && t !== sess.token) { delete db.sessions[t]; revoked++; } // log out other devices
      A({ ...actx, action: 'auth.password.change', details: { sessionsRevoked: revoked } });
      save(); return json(res, 200, { ok: true });
    }

    // cloud saves: /api/saves (list) and /api/saves/0..2 (get / put / delete)
    if (p.startsWith('/api/saves') && !db.realmSettings.cloudSavesEnabled) return json(res, 503, { error: 'Cloud saves are disabled.' });
    if (p === '/api/saves' && req.method === 'GET') {
      const s = db.saves[uid] || {};
      return json(res, 200, { slots: Array.from({ length: SLOTS }, (_, i) => s[i] ? { slot: i, name: s[i].meta.name, lvl: s[i].meta.lvl, cls: s[i].meta.cls, saved: s[i].saved } : null) });
    }
    const m = p.match(/^\/api\/saves\/([0-2])$/);
    if (m) {
      const slot = +m[1], mine = db.saves[uid] || (db.saves[uid] = {});
      if (req.method === 'GET') return mine[slot] ? json(res, 200, { slot, state: mine[slot].state, saved: mine[slot].saved }) : json(res, 404, { error: 'Empty slot.' });
      if (req.method === 'PUT') {
        const { state } = await body(req, db.realmSettings.maxSaveBytes);
        if (!state || typeof state !== 'object' || typeof state.name !== 'string' || !state.cls) return json(res, 400, { error: 'Not a Lost Kingdom of Shadowbane Chronicles save.' });
        const prevLvl = mine[slot] ? mine[slot].meta.lvl : null;
        mine[slot] = { state, saved: Date.now(), meta: { name: String(state.name).slice(0, 12), lvl: +state.lvl || 1, cls: String(state.cls).slice(0, 16) } }; save();
        // saves are frequent: audit only new slots and level changes; every write goes to the debug log
        if (prevLvl !== mine[slot].meta.lvl) A({ ...actx, action: 'save.write', target: `slot ${slot}`, details: { hero: mine[slot].meta.name, cls: mine[slot].meta.cls, lvl: mine[slot].meta.lvl, prevLvl } });
        log.debug('cloud save written', { reqId, account: sess.acct.name, slot, bytes: +req.headers['content-length'] || undefined });
        return json(res, 200, { ok: true, saved: mine[slot].saved });
      }
      if (req.method === 'DELETE') { const had = mine[slot]; delete mine[slot]; save(); if (had) A({ ...actx, action: 'save.delete', target: `slot ${slot}`, details: { hero: had.meta.name, lvl: had.meta.lvl } }); return json(res, 200, { ok: true }); }
    }

    // trading hub (auction house): the server holds listings, takes the 5% cut and pays sellers
    //   GET /api/market            active listings
    //   POST /api/market           { item | stack:{id,n}, price, hours } -> list (deposit is charged client-side)
    //   POST /api/market/buy       { id } -> { listing } (buyer pays client-side; seller is credited here)
    //   POST /api/market/cancel    { id } -> { listing } back to the seller
    //   GET /api/market/claim      -> { gold, returned:[listings] } proceeds and expired listings
    if (p.startsWith('/api/market')) {
      if (!db.realmSettings.marketplaceEnabled) return json(res, 503, { error: 'The marketplace is disabled.' });
      const now = Date.now(); db.market = db.market || {}; db.proceeds = db.proceeds || {};
      for (const [id, l] of Object.entries(db.market)) if (l.expires < now) { (db.proceeds[l.seller] ||= { gold: 0, returned: [] }).returned.push(l); delete db.market[id]; }
      if (p === '/api/market' && req.method === 'GET') return json(res, 200, { listings: Object.values(db.market).sort((a, b) => b.ts - a.ts).slice(0, 300) });
      if (p === '/api/market' && req.method === 'POST') {
        const b = await body(req, 16384), price = Math.floor(+b.price);
        if (!Number.isFinite(price) || price < 1 || price > 1e9) return json(res, 400, { error: 'Bad price.' });
        const item = b.item && typeof b.item === 'object' ? b.item : null, stack = b.stack && typeof b.stack.id === 'string' ? { id: b.stack.id.slice(0, 40), n: Math.max(1, Math.min(999, Math.floor(+b.stack.n) || 1)) } : null;
        if (!item === !stack) return json(res, 400, { error: 'List one item or one stack.' });
        if (Object.values(db.market).filter(l => l.seller === uid).length >= db.realmSettings.maxListingsPerPlayer) return json(res, 400, { error: 'You have reached the active listing limit.' });
        const id = crypto.randomBytes(8).toString('hex'), hours = Math.max(1, Math.min(48, +b.hours || 12));
        db.market[id] = { id, seller: uid, sellerName: String(b.sellerName || sess.acct.name).slice(0, 12), item, stack, price, ts: now, expires: now + hours * 3600e3 };
        A({ ...actx, action: 'market.list', target: id, details: { what: item ? String(item.name || item.id || 'item').slice(0, 40) : `${stack.id} x${stack.n}`, price, hours } });
        save(); return json(res, 200, { ok: true, id });
      }
      if (p === '/api/market/buy' && req.method === 'POST') {
        const { id } = await body(req), l = own(db.market, String(id));
        if (!l) return json(res, 404, { error: 'That listing is gone.' });
        if (l.seller === uid) return json(res, 400, { error: 'That is your own listing.' });
        delete db.market[id]; (db.proceeds[l.seller] ||= { gold: 0, returned: [] }).gold += Math.floor(l.price * 0.95);
        A({ ...actx, action: 'market.buy', target: id, details: { seller: l.sellerName, sellerId: l.seller, price: l.price, sellerCredit: Math.floor(l.price * 0.95) } });
        save(); return json(res, 200, { ok: true, listing: l });
      }
      if (p === '/api/market/cancel' && req.method === 'POST') {
        const { id } = await body(req), l = own(db.market, String(id));
        if (!l || l.seller !== uid) return json(res, 404, { error: 'Not your listing.' });
        delete db.market[id]; A({ ...actx, action: 'market.cancel', target: id, details: { price: l.price } }); save(); return json(res, 200, { ok: true, listing: l });
      }
      if (p === '/api/market/claim' && req.method === 'GET') {
        const pr = db.proceeds[uid] || { gold: 0, returned: [] }; delete db.proceeds[uid]; save();
        if (pr.gold || pr.returned.length) A({ ...actx, action: 'market.claim', details: { gold: pr.gold, returned: pr.returned.length } });
        return json(res, 200, pr);
      }
    }

    // realm guilds (backend/guilds.cjs): roster, ranks and a shared guild bank owned by the server
    //   GET  /api/guilds                         directory: name, tag, member count
    //   GET  /api/guild                          { guild | null, invites }
    //   POST /api/guild                          { name, tag } -> found a guild
    //   POST /api/guild/invite                   { username }        officer+
    //   POST /api/guild/accept | /decline        { id }
    //   POST /api/guild/leave | /disband
    //   POST /api/guild/kick                     { accountId }       officer+, lower ranks only
    //   POST /api/guild/rank                     { accountId, rank } leader; rank 'leader' passes leadership
    //   POST /api/guild/motd                     { motd }            officer+
    //   POST /api/guild/bank/deposit             { tab, item } | { gold }
    //   POST /api/guild/bank/withdraw            { tab, slot, expect } | { gold }   daily caps by rank
    if (p === '/api/guilds' || p.startsWith('/api/guild')) {
      if (!db.realmSettings.guildsEnabled) return json(res, 503, { error: 'Realm guilds are disabled.' });
      const me = { uid, name: sess.acct.name };
      const names = () => Object.fromEntries(Object.values(db.accounts).map(a => [a.id, a.name]));
      const reply = (r, okCode = 200) => {
        if (!r.ok) return json(res, r.code || 400, { error: r.error });
        const g = Guilds.guildFor(db, uid); save();
        const out = { ...r, guild: g ? Guilds.publicGuild(g, uid, names()) : null };
        if (g) for (const m of g.members) if (m.uid !== uid) sendToAccount(m.uid, 'guild', { changed: true });
        return json(res, okCode, out);
      };
      if (p === '/api/guilds' && req.method === 'GET') return json(res, 200, { guilds: Object.values(db.guilds).map(g => ({ id: g.id, name: g.name, tag: g.tag, members: g.members.length })).sort((a, b) => b.members - a.members || a.name.localeCompare(b.name)).slice(0, 200) });
      if (p === '/api/guild' && req.method === 'GET') {
        const g = Guilds.guildFor(db, uid);
        return json(res, 200, { guild: g ? Guilds.publicGuild(g, uid, names()) : null, invites: Guilds.invitesFor(db, uid) });
      }
      if (p === '/api/guild' && req.method === 'POST') {
        const b = await body(req), r = Guilds.create(db, me, { name: b.name, tag: b.tag });
        if (r.ok) A({ ...actx, action: 'guild.create', target: r.guild.name, details: { tag: r.guild.tag } });
        return reply(r, 201);
      }
      if (p === '/api/guild/invite' && req.method === 'POST') {
        const { username } = await body(req), target = own(db.accounts, String(username || '').toLowerCase());
        if (!target) return json(res, 404, { error: 'Account not found.' });
        const r = Guilds.invite(db, me, target.id, target.name);
        if (r.ok) { const g = Guilds.guildFor(db, uid); sendToAccount(target.id, 'guild', { invite: { id: g.id, name: g.name, tag: g.tag, from: me.name } }); }
        return reply(r);
      }
      if ((p === '/api/guild/accept' || p === '/api/guild/decline') && req.method === 'POST') {
        const { id } = await body(req), gid = String(id || '');
        return reply(p.endsWith('accept') ? Guilds.accept(db, me, gid) : Guilds.decline(db, me, gid));
      }
      if (p === '/api/guild/leave' && req.method === 'POST') {
        const g = Guilds.guildFor(db, uid), others = g ? g.members.filter(m => m.uid !== uid).map(m => m.uid) : [];
        const r = Guilds.leave(db, me); if (r.ok) for (const o of others) sendToAccount(o, 'guild', { changed: true });
        return reply(r);
      }
      if (p === '/api/guild/disband' && req.method === 'POST') {
        const g = Guilds.guildFor(db, uid), others = g ? g.members.filter(m => m.uid !== uid).map(m => m.uid) : [], gname = g && g.name;
        const r = Guilds.disband(db, me);
        if (r.ok) { A({ ...actx, action: 'guild.disband', target: gname }); for (const o of others) sendToAccount(o, 'guild', { disbanded: gname }); }
        return reply(r);
      }
      if (p === '/api/guild/kick' && req.method === 'POST') {
        const { accountId } = await body(req), target = String(accountId || '');
        const r = Guilds.kick(db, me, target); if (r.ok) sendToAccount(target, 'guild', { removed: true });
        return reply(r);
      }
      if (p === '/api/guild/rank' && req.method === 'POST') { const b = await body(req); return reply(Guilds.setRank(db, me, String(b.accountId || ''), String(b.rank || ''))); }
      if (p === '/api/guild/motd' && req.method === 'POST') { const b = await body(req); return reply(Guilds.setMotd(db, me, b.motd)); }
      if (p === '/api/guild/bank/deposit' && req.method === 'POST') {
        const b = await body(req, 16384), r = Guilds.deposit(db, me, { tab: b.tab, item: b.item, gold: b.gold });
        if (r.ok) A({ ...actx, action: 'guild.bank.deposit', target: Guilds.guildFor(db, uid).name, details: b.gold != null ? { gold: +b.gold } : { item: String(b.item.name || b.item.id || 'item').slice(0, 40) } });
        return reply(r);
      }
      if (p === '/api/guild/bank/withdraw' && req.method === 'POST') {
        const b = await body(req), r = Guilds.withdraw(db, me, { tab: b.tab, slot: b.slot, gold: b.gold, expect: b.expect });
        if (r.ok) A({ ...actx, action: 'guild.bank.withdraw', target: Guilds.guildFor(db, uid).name, details: r.item ? { item: String(r.item.name || r.item.id || 'item').slice(0, 40) } : { gold: r.gold } });
        return reply(r);
      }
      return json(res, 404, { error: 'No such guild operation.' });
    }

    // group finder (backend/groupfinder.cjs): real players queue by role and are matched into groups
    //   GET  /api/finder            { status, queues }
    //   POST /api/finder/join       { activity, mode: dungeon|trial|raid, roles: [tank|healer|damage], level }
    //   POST /api/finder/leave
    //   POST /api/finder/ready      { accept: true|false }
    // Players hear about ready checks and finished groups on the live stream as 'finder' events.
    if (p.startsWith('/api/finder')) {
      if (!db.realmSettings.groupFinderEnabled) return json(res, 503, { error: 'The group finder is disabled.' });
      if (p === '/api/finder' && req.method === 'GET') { finderEvents(Finder.tick(finder)); return json(res, 200, { status: Finder.status(finder, uid), queues: Finder.overview(finder) }); }
      if (p === '/api/finder/join' && req.method === 'POST') {
        const b = await body(req), r = Finder.join(finder, { uid, name: sess.acct.name }, { activity: b.activity, mode: b.mode, roles: b.roles, level: b.level });
        if (!r.ok) return json(res, r.code, { error: r.error });
        finderEvents(r.formed); return json(res, 200, { ok: true, status: Finder.status(finder, uid) });
      }
      if (p === '/api/finder/leave' && req.method === 'POST') {
        const r = Finder.leave(finder, uid); if (!r.ok) return json(res, r.code, { error: r.error });
        if (r.group) for (const m of r.group.members) sendToAccount(m.uid, 'finder', { type: 'member-left', group: r.group, name: sess.acct.name });
        finderEvents(Finder.tick(finder)); return json(res, 200, { ok: true, left: r.left });
      }
      if (p === '/api/finder/ready' && req.method === 'POST') {
        const b = await body(req), r = Finder.respond(finder, uid, b.accept === true);
        if (!r.ok) return json(res, r.code, { error: r.error });
        finderEvents(r.events); return json(res, 200, { ok: true, status: Finder.status(finder, uid) });
      }
      return json(res, 404, { error: 'No such group finder operation.' });
    }

    // leaderboard
    if ((p === '/api/heroes' || p === '/api/hero') && !db.realmSettings.leaderboardEnabled) return json(res, 503, { error: 'The realm leaderboard is disabled.' });
    if (p === '/api/heroes' && req.method === 'GET') return json(res, 200, { heroes: Object.values(db.heroes).sort((a, b) => b.lvl - a.lvl || b.ach - a.ach).slice(0, 50) });
    if (p === '/api/hero' && req.method === 'PUT') {
      const h = await body(req);
      // whole numbers in range: Infinity used to serialise as null and negatives sorted oddly
      const int = (v, min, max, dflt) => { const n = Math.floor(+v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt; };
      db.heroes[uid] = { name: String(h.name || sess.acct.name).slice(0, 12), cls: String(h.cls || '').slice(0, 16), lvl: int(h.lvl, 1, 720, 1), ach: int(h.ach, 0, 1e6, 0), tower: int(h.tower, 0, 100, 0), rating: int(h.rating, 0, 1e5, 1000), ch: int(h.ch, 0, 1e4, 0), account: sess.acct.name, ts: Date.now() };
      save(); return json(res, 200, { ok: true });
    }

    // live realm: one event stream per tab, plus presence and topic posts
    if (p === '/api/stream' && req.method === 'GET') {
      if (!db.realmSettings.livePlayEnabled) return json(res, 503, { error: 'Live realm features are disabled.' });
      const peer = crypto.randomBytes(6).toString('hex');
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', ...SEC });
      res.write('retry: 3000\n\n');
      clients.set(peer, { res, uid, name: sess.acct.name, presence: {} });
      send(res, 'hello', { peer, account: publicAcct(sess.acct) });
      broadcastPeers();
      log.debug('live stream opened', { reqId, peer, account: sess.acct.name, ip, online: clients.size });
      req.on('close', () => { clients.delete(peer); broadcastPeers([peer]); log.debug('live stream closed', { peer, account: sess.acct.name, online: clients.size }); });
      return;
    }
    if (p === '/api/presence' && req.method === 'POST') {
      if (!db.realmSettings.livePlayEnabled) return json(res, 503, { error: 'Live realm features are disabled.' });
      const { peer, presence } = await body(req); const c = clients.get(peer);
      if (!c || c.uid !== uid) return json(res, 403, { error: 'Not your connection.' });
      // presence is re-sent to every peer on every update; the client's is ~200 bytes, so cap it
      if (presence && JSON.stringify(presence).length > MAX_PRESENCE) return json(res, 413, { error: 'Presence too large.' });
      c.presence = presence && typeof presence === 'object' && !Array.isArray(presence) ? presence : {}; broadcastPeers();
      return json(res, 200, { ok: true });
    }
    if (p === '/api/emit' && req.method === 'POST') {
      if (!db.realmSettings.livePlayEnabled) return json(res, 503, { error: 'Live realm features are disabled.' });
      const { peer, topic, data } = await body(req); const c = clients.get(peer);
      if (!c || c.uid !== uid) return json(res, 403, { error: 'Not your connection.' });
      if (!TOPICS.has(topic)) return json(res, 400, { error: 'Unknown topic.' });
      if (topic === 'chat') {
        const channel = String(data && data.channel || '').toLowerCase();
        const channels = new Set(['say', 'yell', 'party', 'guild', 'whisper', 'world', 'trade', 'lfg', 'emote']);
        const message = typeof (data && data.text) === 'string' ? data.text.trim() : '';
        if (!channels.has(channel) || !message || message.length > 180 || /[\u0000-\u001F\u007F]/.test(message)) return json(res, 400, { error: 'Invalid chat message.' });
        if (!db.realmSettings.chatEnabled) return json(res, 503, { error: 'Realm chat is disabled.' });
        const now = Date.now(), times = (chatWindows.get(uid) || []).filter(t => t > now - 10000);
        if (times.length >= db.realmSettings.chatMessagesPer10Seconds) { log.info('chat rate limit hit', { reqId, account: sess.acct.name, channel }); return json(res, 429, { error: 'Chat rate limit reached.' }); }
        times.push(now); chatWindows.set(uid, times);
        const group = (pid, player) => player.presence && player.presence.j || player.presence && player.presence.h && pid || null;
        const myGroup = group(peer, c);
        if (channel === 'party' && !myGroup) return json(res, 400, { error: 'Join or host a party first.' });
        if (channel === 'guild' && !c.presence.g) return json(res, 400, { error: 'Join a guild first.' });
        let target = null;
        if (channel === 'whisper') {
          target = clients.get(String(data.to || ''));
          if (!target || target === c) return json(res, 404, { error: 'Whisper target is not online.' });
        }
        const safeData = { channel, text: message, name: String(c.presence.n || c.name).slice(0, 24), to: channel === 'whisper' ? String(data.to) : '', from: peer };
        for (const [pid, dest] of clients) {
          if (pid === peer) continue;
          const presence = dest.presence || {}, source = c.presence || {};
          if (channel === 'whisper' && pid !== data.to) continue;
          if ((channel === 'say' || channel === 'yell') && (String(presence.z || '') !== String(source.z || ''))) continue;
          if (channel === 'say' && Math.abs((+presence.x || 0) - (+source.x || 0)) + Math.abs((+presence.y || 0) - (+source.y || 0)) > 12) continue;
          if (channel === 'party' && (!myGroup || group(pid, dest) !== myGroup)) continue;
          if (channel === 'guild' && presence.g !== source.g) continue;
          send(dest.res, 'msg', { topic, peer, data: safeData });
        }
        return json(res, 200, { ok: true });
      }
      for (const [pid, o] of clients) if (pid !== peer) send(o.res, 'msg', { topic, peer, data });
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'No such endpoint.' });
  } catch (e) {
    if (e.code === 413 || e.code === 400) log.info(e.code === 413 ? 'request body too large' : 'malformed request body', { reqId, method: req.method, path: p, ip, account: who || undefined });
    else log.error('unhandled error in request', { reqId, method: req.method, path: p, ip, account: who || undefined, err: e });
    if (res.headersSent) { res.end(); return; }
    return json(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: e.code === 413 ? 'Too large.' : e.code === 400 ? 'Bad request.' : 'Server error.', reqId });
  }
});
server.on('clientError', (e, socket) => { log.debug('client connection error', { err: e.message, code: e.code }); if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); });
server.on('error', e => { log.error('server error', e); if (e.code === 'EADDRINUSE') { log.flush(); process.exit(1); } });
server.listen(PORT, HOST, () => {
  log.info(`LOST KINGDOM OF SHADOWBANE CHRONICLES realm server on http://${HOST}:${PORT}`, { accounts: Object.keys(db.accounts).length, logLevel: log.level, logDir: LOG_DIR, auditSeq: audit.seq });
  audit.record({ action: 'server.start', actor: 'system', details: { host: HOST, port: PORT, pid: process.pid } });
  if (process.env.GBQ_WARM_STATIC !== '0') setTimeout(warmStatic, 1000).unref();
});
module.exports = server;
