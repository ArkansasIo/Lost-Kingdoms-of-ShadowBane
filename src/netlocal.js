'use strict';
// ================================================================ REALM SERVER CLIENT (accounts + live play)
// When the game is served by server/server.cjs (http://localhost:8787), this connects to it:
// accounts (register / login / logout), cloud saves, the leaderboard, and a "room" with the same
// shape the game already uses (presence, onPeers, on(topic), emit), carried over Server-Sent Events.
// When there is no realm server (e.g. a shared claude.ai page), the game falls back to the page's
// own room/db capabilities, or plays offline.

const LocalRealm = {
  base: '', available: false, token: null, account: null, peer: null, es: null, info: null, desktop: false, desktopSlot: null,
  load() { try { this.token = localStorage.getItem('gbq_token'); this.account = JSON.parse(localStorage.getItem('gbq_account') || 'null'); } catch (e) {} },
  store() { if (this.desktop) return; try { if (this.token) { localStorage.setItem('gbq_token', this.token); localStorage.setItem('gbq_account', JSON.stringify(this.account)); } else { localStorage.removeItem('gbq_token'); localStorage.removeItem('gbq_account'); } } catch (e) {} },
  async api(path, opts = {}) {
    if (this.desktop) return window.gbqLauncher.realmApi(path, opts);
    const r = await fetch(this.base + path, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error((j && j.error) || `HTTP ${r.status}`); err.status = r.status; throw err; }
    return j;
  },
  async detect() {
    if (location.protocol === 'file:' && window.gbqLauncher?.getGameSession) {
      try {
        const context = await window.gbqLauncher.getGameSession();
        this.desktop = true;
        this.desktopSlot = Number.isInteger(context.characterSlot) ? context.characterSlot : null;
        window.GBQ_DESKTOP_LAUNCH = { characterSlot: this.desktopSlot, authenticated: !!context.authenticated };
        if (!context.authenticated || !context.url || !context.account) { this.available = false; return false; }
        this.base = context.url; this.token = 'desktop-session'; this.account = context.account;
        this.info = { ok: true }; this.available = true; return true;
      } catch (e) { this.desktop = true; this.available = false; return false; }
    }
    if (!/^https?:$/.test(location.protocol)) return false;
    try { const c = new AbortController(); setTimeout(() => c.abort(), 1500); const r = await fetch('/api/health', { signal: c.signal }); if (!r.ok) return false; this.info = await r.json(); this.available = !!(this.info && this.info.ok); } catch (e) { this.available = false; }
    return this.available;
  },
  async register(username, password) { const r = await this.api('/api/register', { method: 'POST', body: { username, password } }); this.token = r.token; this.account = r.account; this.store(); return r.account; },
  async login(username, password) { const r = await this.api('/api/login', { method: 'POST', body: { username, password } }); this.token = r.token; this.account = r.account; this.store(); return r.account; },
  async logout() { try { await this.api('/api/logout', { method: 'POST' }); } catch (e) {} this.disconnect(); this.token = null; this.account = null; this.store(); },
  async me() { try { const r = await this.api('/api/me'); this.account = r.account; this.store(); return r; } catch (e) { if (e.status === 401) { this.token = null; this.account = null; this.store(); } return null; } },
  async friends() { return this.api('/api/friends'); },
  async requestFriend(username) { return this.api('/api/friends/request', { method: 'POST', body: { username } }); },
  async acceptFriend(accountId) { return this.api('/api/friends/accept', { method: 'POST', body: { accountId } }); },
  async removeFriend(accountId) { return this.api('/api/friends/remove', { method: 'POST', body: { accountId } }); },
  async createInvite() { if (!this.peer) throw new Error('Wait for the realm connection first.'); return this.api('/api/invites', { method: 'POST', body: { peer: this.peer } }); },
  async resolveInvite(code) { return this.api('/api/invites/' + encodeURIComponent(String(code).trim().toUpperCase())); },
  // ---------------------------------------------------------------- room-shaped transport
  room() {
    const L = this, handlers = {}, peerSubs = [];
    let peers = [];
    L.disconnect();
    if (L.desktop) {
      const close = window.gbqLauncher.startRealmStream(message => {
        let d; try { d = JSON.parse(message.data); } catch (e) { return; }
        if (message.event === 'hello') L.peer = d.peer;
        else if (message.event === 'peers') { peers = d.peers || []; peerSubs.forEach(([cb]) => cb({ peers, left: d.left || [] })); }
        else if (message.event === 'msg') (handlers[d.topic] || []).forEach(cb => cb({ peer: d.peer, data: d.data }));
        else if (message.event === 'guild' || message.event === 'finder') L.serverEvent(message.event, d);
      }, error => peerSubs.forEach(([, err]) => err && err(error)));
      L.es = { close };
    } else {
      L.es = new EventSource(`${L.base}/api/stream?token=${encodeURIComponent(L.token)}`);
      L.es.addEventListener('hello', e => { const d = JSON.parse(e.data); L.peer = d.peer; });
      L.es.addEventListener('peers', e => { const d = JSON.parse(e.data); peers = d.peers; peerSubs.forEach(([cb]) => cb({ peers, left: d.left || [] })); });
      L.es.addEventListener('msg', e => { const d = JSON.parse(e.data); (handlers[d.topic] || []).forEach(cb => cb({ peer: d.peer, data: d.data })); });
      for (const kind of ['guild', 'finder']) L.es.addEventListener(kind, e => { let d; try { d = JSON.parse(e.data); } catch (x) { return; } L.serverEvent(kind, d); });
      L.es.onerror = () => { if (L.es && L.es.readyState === 2) peerSubs.forEach(([, err]) => err && err()); };
    }
    const post = (path, body) => L.peer ? L.api(path, { method: 'POST', body: { peer: L.peer, ...body } }) : Promise.reject(new Error('connecting'));
    return {
      transport: 'server',
      peers: () => peers,
      presence: p => post('/api/presence', { presence: p }),
      onPeers: (cb, err) => { peerSubs.push([cb, err]); },
      on: (topic, cb) => { (handlers[topic] = handlers[topic] || []).push(cb); },
      emit: (topic, data) => post('/api/emit', { topic, data }),
    };
  },
  disconnect() { if (this.es) { this.es.close(); this.es = null; } this.peer = null; },
  // realm guild and group finder notices (see src/realm_social.js); listeners: [kind, cb]
  serverListeners: [],
  onServerEvent(kind, cb) { this.serverListeners.push([kind, cb]); },
  serverEvent(kind, d) { for (const [k, cb] of this.serverListeners) if (k === kind) { try { cb(d); } catch (e) { /* a broken listener must not stop the stream */ } } },
  // ---------------------------------------------------------------- cloud saves
  async listSaves() { return (await this.api('/api/saves')).slots; },
  async upload(slot) { const st = store.get(SLOT_KEYS[slot]); if (!st) throw new Error('That slot is empty on this device.'); await this.api(`/api/saves/${slot}`, { method: 'PUT', body: { state: st } }); },
  async download(slot) { const r = await this.api(`/api/saves/${slot}`); store.set(SLOT_KEYS[slot], r.state); return r.state; },
};
LocalRealm.load();

// ---------------------------------------------------------------- hook NET: prefer the realm server when present
{
  const init0 = NET.init.bind(NET);
  NET.init = async function () {
    const desktop = location.protocol === 'file:' && !!window.gbqLauncher?.getGameSession;
    if (S.netMode === 'offline' && !desktop) return init0();
    const ok = await LocalRealm.detect();
    if (!ok) return init0();                                  // shared page / file: use the page's room or go offline
    this.transport = 'server';
    if (!LocalRealm.token || !(await LocalRealm.me())) { this.status = 'SERVER: LOG IN'; this.room = null; return; }
    this.offline = false; this.status = 'ONLINE';
    this.myId = LocalRealm.account.id;
    if (LocalRealm.desktop && LocalRealm.desktopSlot !== null) {
      try {
        await LocalRealm.download(LocalRealm.desktopSlot);
        window.GBQ_DESKTOP_LAUNCH.loaded = true;
      } catch (error) {
        window.GBQ_DESKTOP_LAUNCH.loadError = error.message;
      }
    }
    this.room = LocalRealm.room();
    this.room.onPeers(ch => { if (this.offline) { this.peers = []; return; } this.peers = ch.peers.filter(p => !p.sameTab); this.onPeers(ch); }, () => { this.status = 'SERVER LOST'; });
    ['srv_join', 'srv_char', 'srv_battle', 'srv_turn', 'srv_act', 'srv_end'].forEach(t => this.room.on(t, m => this.onMsg(t, m)));
    this.room.on('chat', m => this.receiveChat(m));
    this.db = null; this.publishHero();
  };
  const pub0 = NET.publishHero.bind(NET);
  NET.publishHero = async function () {
    if (this.transport !== 'server') return pub0();
    if (this.offline || !G || !LocalRealm.token) return;
    try { await LocalRealm.api('/api/hero', { method: 'PUT', body: { name: G.name, cls: G.cls, lvl: G.lvl, ach: achPoints(), tower: G.towerBest || 0, rating: G.rating || 1000, ch: G.chapter, rank: typeof RankSystem !== 'undefined' ? RankSystem.forCharacter(G) : null } }); } catch (e) {}
  };
  const lb0 = NET.leaderboard.bind(NET);
  NET.leaderboard = async function () {
    if (this.transport !== 'server') return lb0();
    try { return (await LocalRealm.api('/api/heroes')).heroes; } catch (e) { return null; }
  };
  // Desktop cloud-save sync: upload successful local saves without blocking the game loop.
  let lastDesktopSaveSync = 0;
  let desktopSaveSyncPromise = null;
  const saveGame0 = saveGame;
  saveGame = function () {
    if (G && typeof RankSystem !== 'undefined') G.adventurerRank = RankSystem.forCharacter(G);
    const ok = saveGame0();
    if (ok && LocalRealm.desktop && LocalRealm.token && G && !NET.offline) {
      const now = Date.now();
      if (!desktopSaveSyncPromise && now - lastDesktopSaveSync >= 20000) {
        lastDesktopSaveSync = now;
        desktopSaveSyncPromise = LocalRealm.upload(G.slot)
          .catch(error => { chatLog('System', 'Cloud save', 'Automatic upload failed: ' + String(error.message || error).slice(0, 110)); })
          .finally(() => { desktopSaveSyncPromise = null; });
      }
    }
    return ok;
  };
  const mode0 = NET.setMode.bind(NET);
  NET.setMode = function (mode) { mode0(mode); if (this.transport === 'server') { if (mode === 'offline') LocalRealm.disconnect(); else this.init(); } };
}

// ---------------------------------------------------------------- account form (HTML overlay: real text fields for name + password)
function accountForm(kind) {
  return new Promise(resolve => {
    const old = document.getElementById('acctForm'); if (old) old.remove();
    const wrap = document.createElement('div'); wrap.id = 'acctForm';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:150;display:grid;place-items:center;background:#000a;padding:16px';
    wrap.innerHTML = `<form style="width:min(320px,100%);background:#161816;border:2px solid #7fa52c;border-radius:10px;padding:16px;display:grid;gap:10px;font:12px Silkscreen,'Courier New',monospace;color:#c9d0b0">
      <b style="font-size:14px;color:#d4e7bd">${kind === 'register' ? 'CREATE ACCOUNT' : 'LOG IN'}</b>
      <label style="display:grid;gap:4px">NAME<input name="u" autocomplete="username" minlength="3" maxlength="16" pattern="[A-Za-z0-9_]{3,16}" required style="font:inherit;padding:8px;background:#0d100e;color:#e6f5d0;border:1px solid #39403a;border-radius:6px"></label>
      <label style="display:grid;gap:4px">PASSWORD<input name="p" type="password" autocomplete="${kind === 'register' ? 'new-password' : 'current-password'}" minlength="8" maxlength="72" required style="font:inherit;padding:8px;background:#0d100e;color:#e6f5d0;border:1px solid #39403a;border-radius:6px"></label>
      ${kind === 'register' ? `<label style="display:grid;gap:4px">CONFIRM<input name="p2" type="password" autocomplete="new-password" minlength="8" maxlength="72" required style="font:inherit;padding:8px;background:#0d100e;color:#e6f5d0;border:1px solid #39403a;border-radius:6px"></label>` : ''}
      <small style="color:#7c8570">${kind === 'register' ? 'Name: 3-16 letters, digits or _. Password: 8+ characters.' : 'Your realm server keeps your account.'}</small>
      <div id="acctErr" style="color:#ff8a7a;min-height:1em"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" data-x style="font:inherit;padding:8px 12px;background:#1d1f1c;color:#c9d0b0;border:1px solid #39403a;border-radius:6px;cursor:pointer">CANCEL</button><button style="font:inherit;padding:8px 12px;background:#2f4a1c;color:#e6f5d0;border:1px solid #7fa52c;border-radius:6px;cursor:pointer">${kind === 'register' ? 'REGISTER' : 'LOG IN'}</button></div></form>`;
    document.body.appendChild(wrap);
    const f = wrap.querySelector('form'), err = wrap.querySelector('#acctErr'); f.u.focus();
    const done = v => { wrap.remove(); resolve(v); };
    wrap.querySelector('[data-x]').onclick = () => done(null);
    f.addEventListener('keydown', e => { if (e.key === 'Escape') done(null); e.stopPropagation(); });
    f.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = '';
      if (kind === 'register' && f.p.value !== f.p2.value) { err.textContent = 'Passwords do not match.'; return; }
      try { const a = kind === 'register' ? await LocalRealm.register(f.u.value, f.p.value) : await LocalRealm.login(f.u.value, f.p.value); done(a); }
      catch (x) { err.textContent = x.message; }
    });
  });
}

// ---------------------------------------------------------------- ACCOUNT screen
class AccountScene {
  constructor() { this.opaque = true; this.i = 0; this.busy = false; this.msg = ''; this.cloud = null; if (LocalRealm.token || this.page()) this.refresh(); }
  page() { return !LocalRealm.available && !NET.offline && !!(NET.db && NET.myId); }
  async refresh() {
    try { this.cloud = this.page() ? await PageCloud.list() : await LocalRealm.listSaves(); } catch (e) { this.cloud = null; }
    // role and first-run admin claim (see backend/server.cjs /api/admin/claim)
    try { this.me = LocalRealm.available && LocalRealm.account ? await LocalRealm.me() : null; } catch (e) { this.me = null; }
  }
  staff() { return !!(this.me && this.me.role && this.me.role !== 'player'); }
  opts() {
    if (this.page()) return ['UPLOAD SLOT 1', 'UPLOAD SLOT 2', 'UPLOAD SLOT 3', 'DOWNLOAD SLOT 1', 'DOWNLOAD SLOT 2', 'DOWNLOAD SLOT 3', 'BACK'];
    if (!LocalRealm.available) return [NET.offline ? 'GO ONLINE' : 'REFRESH', 'BACK'];
    if (!LocalRealm.account) return ['LOG IN', 'CREATE ACCOUNT', 'BACK'];
    return ['UPLOAD SLOT 1', 'UPLOAD SLOT 2', 'UPLOAD SLOT 3', 'DOWNLOAD SLOT 1', 'DOWNLOAD SLOT 2', 'DOWNLOAD SLOT 3', ...(this.me && this.me.canClaimAdmin ? ['CLAIM REALM ADMIN'] : []), ...(this.staff() ? ['ADMIN CONTROL'] : []), 'LOG OUT', 'BACK'];
  }
  async run(o) {
    this.busy = true;
    try {
      if (o === 'LOG IN' || o === 'CREATE ACCOUNT') { const a = await accountForm(o === 'LOG IN' ? 'login' : 'register'); if (a) { SFX.confirm(); this.msg = `WELCOME, ${a.name}!`; await NET.init(); await this.refresh(); if (typeof ADMIN !== 'undefined') await ADMIN.check(); if (this.staff()) this.msg = `WELCOME, ${String(this.me.role).toUpperCase()} ${a.name}!`; } }
      else if (o === 'CLAIM REALM ADMIN') { const r = await LocalRealm.api('/api/admin/claim', { method: 'POST' }); if (typeof ADMIN !== 'undefined') await ADMIN.check(); await this.refresh(); SFX.levelup(); this.msg = `REALM ${String(r.role).toUpperCase()}: DEV MODE ON`; }
      else if (o === 'ADMIN CONTROL') { if (typeof openAdmin === 'function') openAdmin(); }
      else if (o === 'LOG OUT') { await LocalRealm.logout(); this.me = null; if (typeof ADMIN !== 'undefined') ADMIN.role = null; NET.room = null; NET.peers = []; NET.status = 'SERVER: LOG IN'; this.cloud = null; SFX.close(); this.msg = 'LOGGED OUT'; }
      else if (o === 'GO ONLINE') { NET.setMode('online'); await NET.init(); this.msg = NET.db ? 'ONLINE: CLOUD SAVES READY' : 'NO ONLINE ACCOUNT HERE'; await this.refresh(); }
      else if (o === 'REFRESH') { await NET.init(); await this.refresh(); this.msg = this.page() ? 'SIGNED IN' : 'OFFLINE ON THIS PAGE'; }
      else if (this.page() && o.startsWith('UPLOAD')) { const s = +o.slice(-1) - 1; await PageCloud.upload(s); await this.refresh(); SFX.confirm(); this.msg = `SLOT ${s + 1} SAVED TO CLOUD`; }
      else if (this.page() && o.startsWith('DOWNLOAD')) { const s = +o.slice(-1) - 1; await PageCloud.download(s); SFX.confirm(); this.msg = `SLOT ${s + 1} DOWNLOADED`; }
      else if (o.startsWith('UPLOAD')) { const s = +o.slice(-1) - 1; await LocalRealm.upload(s); await this.refresh(); SFX.confirm(); this.msg = `SLOT ${s + 1} SAVED TO SERVER`; }
      else if (o.startsWith('DOWNLOAD')) { const s = +o.slice(-1) - 1; await LocalRealm.download(s); SFX.confirm(); this.msg = `SLOT ${s + 1} DOWNLOADED`; }
    } catch (e) { SFX.error(); this.msg = String(e.message || e).toUpperCase().slice(0, 50); }
    this.busy = false;
  }
  update() {
    if (document.getElementById('acctForm')) return;
    const o = this.opts();
    if (nav('up')) { this.i = (this.i + o.length - 1) % o.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % o.length; SFX.cursor(); }
    this.i = Math.min(this.i, o.length - 1);
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('a') && !this.busy) { const c = o[this.i]; if (c === 'BACK') { SFX.back(); removeScene(this); } else this.run(c); }
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3); textC('ACCOUNT', 80, 1, 0);
    frame(4, 14, 152, 30);
    if (this.page()) { text('SIGNED IN WITH CLAUDE', 10, 18, 'green'); text(`PLAYER ${String(NET.myId).slice(0, 10)}`, 10, 28, 2); text('PRIVATE CLOUD SAVES', 10, 37, 2); }
    else if (!LocalRealm.available) { text(NET.offline ? 'OFFLINE MODE' : 'NOT SIGNED IN HERE', 10, 18, 'red'); text('SAVES STAY ON THIS DEVICE', 10, 28, 2); text('REALM: node backend/server.cjs', 10, 37, 2); }
    else if (!LocalRealm.account) { text(`${(LocalRealm.info.realm || 'REALM').slice(0, 20)}`, 10, 18, 'gold'); text(`${LocalRealm.info.players} ONLINE  ${LocalRealm.info.accounts} ACCOUNTS`, 10, 29, 2); }
    else { text(`SIGNED IN: ${LocalRealm.account.name}`.slice(0, 24), 10, 18, 'green'); if (this.staff()) text(`${String(this.me.role).toUpperCase()} - DEV MODE ON`, 10, 29, 'gold'); else text(NET.isOnline() ? `ONLINE  ${NET.peers.length} PLAYERS${this.me && this.me.canClaimAdmin ? ' - NO ADMIN' : ''}` : NET.status || '', 10, 29, 2); }
    this.opts().forEach((c, j) => {
      const y = 48 + j * 8; if (j === this.i) fill(4, y - 1, 152, 8, 1);
      let tag = '';
      if (this.cloud && /SLOT/.test(c)) { const s = this.cloud[+c.slice(-1) - 1]; if (c.startsWith('DOWNLOAD')) tag = s ? `${s.name} L${s.lvl}` : 'EMPTY'; else { const l = slotInfo(+c.slice(-1) - 1); tag = l ? `${l.name} L${l.lvl}` : 'EMPTY'; } }
      text(c, 8, y, 3); if (tag) textR(tag.slice(0, 11), 154, y, 2);
    });
    if (this.msg) text(this.msg.slice(0, 25), 4, 134, this.msg.includes('WRONG') || this.msg.includes('TAKEN') || this.msg.includes('ERROR') ? 'red' : 'gold');
    else if (this.busy) text('WORKING...', 4, 134, 2);
  }
}

// ---------------------------------------------------------------- cloud saves on a shared page
// Each viewer's saves live in their own private database subtree (data/users/<id>/...), which only they
// can read or write. Saves are split into chunks below the 256 KiB document limit.
const PageCloud = {
  base() { return `data/users/${NET.myId}`; },
  async list() {
    const out = [];
    for (let s = 0; s < SLOT_KEYS.length; s++) { const d = (await NET.db.doc(`${this.base()}/save${s}`).get()).data(); out.push(d ? { slot: s, name: d.name, lvl: d.lvl, cls: d.cls, saved: d.saved } : null); }
    return out;
  },
  async upload(s) {
    const st = store.get(SLOT_KEYS[s]); if (!st) throw new Error('That slot is empty on this device.');
    const json = JSON.stringify(st), size = 180000, parts = Math.ceil(json.length / size);
    if (parts > 40) throw new Error('Save is too large for the cloud.');
    for (let i = 0; i < parts; i++) await NET.db.doc(`${this.base()}/save${s}c${i}`).set({ data: json.slice(i * size, (i + 1) * size) });
    await NET.db.doc(`${this.base()}/save${s}`).set({ parts, name: String(st.name || '').slice(0, 12), lvl: st.lvl || 1, cls: st.cls || '', saved: Date.now() });
  },
  async download(s) {
    const meta = (await NET.db.doc(`${this.base()}/save${s}`).get()).data(); if (!meta) throw new Error('No cloud save in that slot.');
    let json = ''; for (let i = 0; i < meta.parts; i++) { const c = (await NET.db.doc(`${this.base()}/save${s}c${i}`).get()).data(); if (!c) throw new Error('Cloud save is incomplete.'); json += c.data; }
    const st = JSON.parse(json); if (!st || !st.cls) throw new Error('Cloud save is damaged.');
    store.set(SLOT_KEYS[s], st); return st;
  },
};
