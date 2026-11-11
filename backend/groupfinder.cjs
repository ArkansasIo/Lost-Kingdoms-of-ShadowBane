'use strict';
// ================================================================ GROUP FINDER (server-side matchmaking across real players)
// The in-game ACTIVITY FINDER fills groups with AI adventurers. On a realm server, this module lets real players
// queue for the same activities and be matched into role-balanced groups. Queues live in memory: a server restart
// clears them, which is what players expect from a queue.
//
//   join(state, player, { activity, mode, roles, level })   queue (roles: any of tank / healer / damage)
//   leave(state, uid)                                        leave the queue or a pending ready check
//   respond(state, uid, accept)                              answer a ready check
//   status(state, uid)                                       where the player is: idle / queued / ready-check / grouped
//   tick(state, now)                                         expire stale entries and ready checks, form groups
//
// Matching: oldest players first, scarce roles (tank, then healer) filled before damage, and everyone in a group
// within LEVEL_SPREAD levels of the first player picked. A formed group gets a ready check; if anyone declines or
// fails to answer in READY_MS, the others go back to the front of the queue with their original queue time and the
// decliner is removed. When everyone accepts, the group is "grouped" and the server tells the clients the roster.

const ROLES = ['tank', 'healer', 'damage'];
const MODES = {
  dungeon: { size: 5, need: { tank: 1, healer: 1, damage: 3 } },
  trial: { size: 3, need: { tank: 1, healer: 1, damage: 1 } },
  raid: { size: 10, need: { tank: 2, healer: 2, damage: 6 } },
};
const QUEUE_TTL = 30 * 60e3, READY_MS = 60e3, GROUP_TTL = 2 * 3600e3, LEVEL_SPREAD = 15, MAX_ACTIVITY = 40;

function createFinder() { return { entries: new Map(), checks: new Map(), groups: new Map(), seq: 1 }; }
const validActivity = a => typeof a === 'string' && /^[a-z0-9_:-]{1,40}$/i.test(a) && a.length <= MAX_ACTIVITY;

function join(state, { uid, name }, { activity, mode = 'dungeon', roles, level }, now = Date.now()) {
  if (!MODES[mode]) return { ok: false, code: 400, error: 'Unknown activity type.' };
  if (!validActivity(activity)) return { ok: false, code: 400, error: 'Unknown activity.' };
  const picked = [...new Set(Array.isArray(roles) ? roles : [roles])].filter(r => ROLES.includes(r));
  if (!picked.length) return { ok: false, code: 400, error: 'Pick at least one role.' };
  const lvl = Math.floor(+level); if (!Number.isFinite(lvl) || lvl < 1 || lvl > 720) return { ok: false, code: 400, error: 'Bad level.' };
  if (inCheck(state, uid)) return { ok: false, code: 409, error: 'Answer your ready check first.' };
  if (groupOf(state, uid)) return { ok: false, code: 409, error: 'Leave your current group first.' };
  // re-queueing replaces the old entry (changing roles or activity) but keeps nothing else
  state.entries.set(uid, { uid, name: String(name).slice(0, 24), activity, mode, roles: picked, level: lvl, queuedAt: now });
  const formed = tick(state, now);
  return { ok: true, status: status(state, uid, now), formed };
}

const inCheck = (state, uid) => [...state.checks.values()].find(c => c.members.some(m => m.uid === uid));
const groupOf = (state, uid) => [...state.groups.values()].find(g => g.members.some(m => m.uid === uid));

function leave(state, uid, now = Date.now()) {
  if (state.entries.delete(uid)) return { ok: true, left: 'queue' };
  const c = inCheck(state, uid); if (c) { respond(state, uid, false, now); return { ok: true, left: 'ready-check' }; }
  const g = groupOf(state, uid); if (g) { g.members = g.members.filter(m => m.uid !== uid); if (!g.members.length) state.groups.delete(g.id); return { ok: true, left: 'group', group: g }; }
  return { ok: false, code: 404, error: 'You are not queued.' };
}

// try to build one group for an activity from the given entries (oldest first)
function pickGroup(entries, mode) {
  const { need } = MODES[mode];
  const sorted = entries.slice().sort((a, b) => a.queuedAt - b.queuedAt);
  for (const anchor of sorted) {
    const pool = sorted.filter(e => Math.abs(e.level - anchor.level) <= LEVEL_SPREAD);
    const chosen = [], used = new Set();
    // the anchor (oldest) must be in the group; give them their scarcest offered role
    const order = ['tank', 'healer', 'damage'];
    const left = { ...need };
    const anchorRole = order.find(r => anchor.roles.includes(r) && left[r] > 0);
    if (!anchorRole) continue;
    chosen.push({ ...anchor, role: anchorRole }); used.add(anchor.uid); left[anchorRole]--;
    let ok = true;
    for (const role of order) {
      while (left[role] > 0) {
        // prefer players who offered only this role, so flexible players stay free for scarce roles
        const cands = pool.filter(e => !used.has(e.uid) && e.roles.includes(role));
        const pick = cands.find(e => e.roles.length === 1) || cands[0];
        if (!pick) { ok = false; break; }
        chosen.push({ ...pick, role }); used.add(pick.uid); left[role]--;
      }
      if (!ok) break;
    }
    if (ok) return chosen;
  }
  return null;
}

function tick(state, now = Date.now()) {
  for (const [uid, e] of state.entries) if (now - e.queuedAt > QUEUE_TTL) state.entries.delete(uid);
  const formed = [];
  // ready checks that ran out: players who accepted go back to the queue, everyone who did not answer is dropped
  for (const c of [...state.checks.values()]) {
    if (now <= c.deadline) continue;
    state.checks.delete(c.id);
    const kept = c.members.filter(m => m.answer === true);
    for (const o of kept) state.entries.set(o.uid, { uid: o.uid, name: o.name, activity: c.activity, mode: c.mode, roles: o.roles, level: o.level, queuedAt: o.queuedAt });
    formed.push({ type: 'ready-failed', check: publicCheck(c), declined: c.members.filter(m => m.answer !== true).map(m => m.name).join(', '), requeued: kept.map(o => o.uid), dropped: c.members.filter(m => m.answer !== true).map(m => m.uid) });
  }
  for (const [id, g] of state.groups) if (now - g.formedAt > GROUP_TTL) state.groups.delete(id);
  const keys = new Set([...state.entries.values()].map(e => e.mode + '|' + e.activity));
  for (const key of keys) {
    const [mode, activity] = key.split('|');
    for (;;) {
      const group = pickGroup([...state.entries.values()].filter(e => e.mode === mode && e.activity === activity), mode);
      if (!group) break;
      const id = 'rc' + (state.seq++);
      for (const m of group) state.entries.delete(m.uid);
      const check = { id, activity, mode, deadline: now + READY_MS, members: group.map(m => ({ uid: m.uid, name: m.name, role: m.role, level: m.level, roles: m.roles, queuedAt: m.queuedAt, answer: null })) };
      state.checks.set(id, check); formed.push({ type: 'ready-check', check: publicCheck(check) });
    }
  }
  return formed;
}

// returns events for the server to send: ready-check results and finished groups
function respond(state, uid, accept, now = Date.now()) {
  const c = inCheck(state, uid); if (!c) return { ok: false, code: 404, error: 'No ready check is waiting for you.' };
  const m = c.members.find(x => x.uid === uid); m.answer = !!accept;
  if (!accept) {
    state.checks.delete(c.id);
    // everyone else goes back to the queue, keeping their place
    for (const o of c.members) if (o.uid !== uid) state.entries.set(o.uid, { uid: o.uid, name: o.name, activity: c.activity, mode: c.mode, roles: o.roles, level: o.level, queuedAt: o.queuedAt });
    const events = [{ type: 'ready-failed', check: publicCheck(c), declined: m.name, requeued: c.members.filter(o => o.uid !== uid).map(o => o.uid), dropped: [uid] }];
    events.push(...tick(state, now));
    return { ok: true, events };
  }
  if (c.members.every(x => x.answer === true)) {
    state.checks.delete(c.id);
    const g = { id: 'grp' + (state.seq++), activity: c.activity, mode: c.mode, formedAt: now, leader: c.members[0].uid, members: c.members.map(({ uid, name, role, level }) => ({ uid, name, role, level })) };
    state.groups.set(g.id, g);
    return { ok: true, events: [{ type: 'grouped', group: g }] };
  }
  return { ok: true, events: [] };
}

const publicCheck = c => ({ id: c.id, activity: c.activity, mode: c.mode, deadline: c.deadline, members: c.members.map(m => ({ uid: m.uid, name: m.name, role: m.role, level: m.level, answer: m.answer })) });

function status(state, uid, now = Date.now()) {
  const e = state.entries.get(uid);
  if (e) {
    const same = [...state.entries.values()].filter(x => x.mode === e.mode && x.activity === e.activity);
    const counts = Object.fromEntries(ROLES.map(r => [r, same.filter(x => x.roles.includes(r)).length]));
    return { state: 'queued', activity: e.activity, mode: e.mode, roles: e.roles, waitedMs: now - e.queuedAt, queued: same.length, counts, need: MODES[e.mode].need };
  }
  const c = inCheck(state, uid); if (c) return { state: 'ready-check', check: publicCheck(c) };
  const g = groupOf(state, uid); if (g) return { state: 'grouped', group: g };
  return { state: 'idle' };
}

// what each activity's queue looks like, for the finder screen
function overview(state) {
  const out = {};
  for (const e of state.entries.values()) {
    const k = e.mode + ':' + e.activity, o = out[k] ||= { mode: e.mode, activity: e.activity, queued: 0, tank: 0, healer: 0, damage: 0 };
    o.queued++; for (const r of e.roles) o[r]++;
  }
  return Object.values(out);
}

module.exports = { ROLES, MODES, QUEUE_TTL, READY_MS, LEVEL_SPREAD, createFinder, join, leave, respond, status, tick, overview };
