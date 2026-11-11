'use strict';
// ================================================================ REALM GUILDS (server-owned)
// Guilds that live on the realm server rather than on one device, so every member's client sees the same
// roster, ranks and guild bank. backend/server.cjs maps /api/guild* routes onto this module; the rules here are
// plain functions over the realm database object so they can be tested without HTTP.
//
//   db.guilds      { [guildId]: guild }
//   db.guildOf     { [accountId]: guildId }
//   db.guildInvites{ [accountId]: [{ gid, from, at }] }
//
// Ranks, highest first: leader > officer > member > recruit.
//   leader   everything; promotes/demotes; transfers leadership; disbands
//   officer  invites, kicks members and recruits, withdraws items and gold (daily gold cap)
//   member   deposits; withdraws items (daily item cap)
//   recruit  deposits only
// The bank is 3 tabs of 20 items plus a gold vault, matching the device guild bank in src/guild_prog.js.
// Soulbound items (bound / heirloom) are refused. Items are opaque JSON objects capped in size, like market items.
// As with the market, the client removes the item or gold from its own save before a deposit and adds it on a
// successful withdrawal; the server is the single owner of what is in the bank.

const RANKS = ['recruit', 'member', 'officer', 'leader'];
const rankLevel = r => RANKS.indexOf(r);
const MAX_MEMBERS = 100, TABS = 3, TAB_SIZE = 20, MAX_ITEM_BYTES = 4096, LOG_SIZE = 100, INVITE_TTL = 7 * 864e5;
const DAILY_ITEM_WITHDRAWALS = { member: 5, officer: 25, leader: Infinity };
const DAILY_GOLD_WITHDRAWAL = { officer: 50000, leader: Infinity };
const validGuildName = n => typeof n === 'string' && /^[A-Za-z][A-Za-z0-9 '-]{2,19}$/.test(n) && !/\s{2}/.test(n);
const validTag = t => typeof t === 'string' && /^[A-Za-z0-9]{2,4}$/.test(t);
const dayKey = now => new Date(now).toISOString().slice(0, 10);
const err = (code, error) => ({ ok: false, code, error });

function ensure(db) {
  db.guilds ||= {}; db.guildOf ||= {}; db.guildInvites ||= {};
  return db;
}
const own = (t, k) => Object.hasOwn(t, k) ? t[k] : undefined;
const guildFor = (db, uid) => { const gid = own(ensure(db).guildOf, uid); return gid ? own(db.guilds, gid) : undefined; };
const memberOf = (g, uid) => g.members.find(m => m.uid === uid);
function addLog(g, now, text) { g.log.push({ at: now, text: String(text).slice(0, 120) }); if (g.log.length > LOG_SIZE) g.log.splice(0, g.log.length - LOG_SIZE); }

// what a client is allowed to see about a guild
function publicGuild(g, viewerUid, names = {}) {
  const me = viewerUid ? memberOf(g, viewerUid) : null;
  return {
    id: g.id, name: g.name, tag: g.tag, motd: g.motd, created: g.created,
    members: g.members.map(m => ({ id: m.uid, name: names[m.uid] || m.name, rank: m.rank, joined: m.joined })),
    myRank: me ? me.rank : null,
    bank: me ? { tabs: g.bank.map(t => t.slice()), gold: g.gold, tabSize: TAB_SIZE } : undefined,
    log: me ? g.log.slice(-30) : undefined,
  };
}

function create(db, { uid, name, now = Date.now() }, { name: gname, tag }) {
  ensure(db);
  if (guildFor(db, uid)) return err(409, 'Leave your current guild first.');
  if (!validGuildName(gname)) return err(400, 'Guild name: 3-20 letters, numbers, spaces, apostrophes or dashes, starting with a letter.');
  if (!validTag(tag)) return err(400, 'Guild tag: 2-4 letters or numbers.');
  const lower = gname.toLowerCase(), tagUp = tag.toUpperCase();
  for (const g of Object.values(db.guilds)) {
    if (g.name.toLowerCase() === lower) return err(409, 'That guild name is taken.');
    if (g.tag === tagUp) return err(409, 'That guild tag is taken.');
  }
  const id = 'g' + now.toString(36) + Math.random().toString(36).slice(2, 8);
  const g = { id, name: gname, tag: tagUp, motd: '', created: now, members: [{ uid, name, rank: 'leader', joined: now }], bank: Array.from({ length: TABS }, () => []), gold: 0, withdrawals: {}, log: [] };
  addLog(g, now, `${name} founded the guild.`);
  db.guilds[id] = g; db.guildOf[uid] = id; delete db.guildInvites[uid];
  return { ok: true, guild: g };
}

function invite(db, actor, targetUid, targetName) {
  const now = actor.now || Date.now(), g = guildFor(db, actor.uid);
  if (!g) return err(404, 'You are not in a guild.');
  if (rankLevel(memberOf(g, actor.uid).rank) < rankLevel('officer')) return err(403, 'Only officers and the leader can invite.');
  if (targetUid === actor.uid) return err(400, 'You are already in the guild.');
  if (own(db.guildOf, targetUid)) return err(409, 'That player is already in a guild.');
  if (g.members.length >= MAX_MEMBERS) return err(409, 'The guild is full.');
  const list = (db.guildInvites[targetUid] ||= []).filter(i => i.at + INVITE_TTL > now && i.gid !== g.id);
  list.push({ gid: g.id, from: actor.name, at: now }); db.guildInvites[targetUid] = list.slice(-10);
  addLog(g, now, `${actor.name} invited ${targetName}.`);
  return { ok: true };
}

function invitesFor(db, uid, now = Date.now()) {
  ensure(db);
  const list = (own(db.guildInvites, uid) || []).filter(i => i.at + INVITE_TTL > now && own(db.guilds, i.gid));
  return list.map(i => ({ id: i.gid, name: db.guilds[i.gid].name, tag: db.guilds[i.gid].tag, from: i.from, at: i.at }));
}

function accept(db, { uid, name, now = Date.now() }, gid) {
  ensure(db);
  if (guildFor(db, uid)) return err(409, 'Leave your current guild first.');
  const inv = (own(db.guildInvites, uid) || []).find(i => i.gid === gid && i.at + INVITE_TTL > now);
  const g = gid && own(db.guilds, gid);
  if (!inv || !g) return err(404, 'That invitation has expired.');
  if (g.members.length >= MAX_MEMBERS) return err(409, 'The guild is full.');
  g.members.push({ uid, name, rank: 'recruit', joined: now }); db.guildOf[uid] = g.id; delete db.guildInvites[uid];
  addLog(g, now, `${name} joined the guild.`);
  return { ok: true, guild: g };
}

function decline(db, { uid }, gid) {
  ensure(db);
  const list = own(db.guildInvites, uid) || [], next = list.filter(i => i.gid !== gid);
  if (next.length === list.length) return err(404, 'No such invitation.');
  if (next.length) db.guildInvites[uid] = next; else delete db.guildInvites[uid];
  return { ok: true };
}

function removeMember(db, g, uid) { g.members = g.members.filter(m => m.uid !== uid); delete db.guildOf[uid]; }
function disbandGuild(db, g) {
  for (const m of g.members) delete db.guildOf[m.uid];
  for (const [uid, list] of Object.entries(db.guildInvites)) { const next = list.filter(i => i.gid !== g.id); if (next.length) db.guildInvites[uid] = next; else delete db.guildInvites[uid]; }
  delete db.guilds[g.id];
}

function leave(db, { uid, name, now = Date.now() }) {
  const g = guildFor(db, uid); if (!g) return err(404, 'You are not in a guild.');
  const me = memberOf(g, uid);
  if (me.rank === 'leader') {
    if (g.members.length > 1) return err(409, 'Pass leadership to another member before leaving, or disband the guild.');
    // the last member leaving takes nothing with them: an empty, leaderless guild has no one to return the bank to
    if (g.gold || g.bank.some(t => t.length)) return err(409, 'Empty the guild bank before disbanding.');
    disbandGuild(db, g); return { ok: true, disbanded: true };
  }
  removeMember(db, g, uid); addLog(g, now, `${name} left the guild.`);
  return { ok: true };
}

function disband(db, { uid, now = Date.now() }) {
  const g = guildFor(db, uid); if (!g) return err(404, 'You are not in a guild.');
  if (memberOf(g, uid).rank !== 'leader') return err(403, 'Only the leader can disband the guild.');
  if (g.gold || g.bank.some(t => t.length)) return err(409, 'Empty the guild bank before disbanding.');
  disbandGuild(db, g); return { ok: true, disbanded: true, at: now };
}

function kick(db, actor, targetUid) {
  const now = actor.now || Date.now(), g = guildFor(db, actor.uid); if (!g) return err(404, 'You are not in a guild.');
  const me = memberOf(g, actor.uid), target = memberOf(g, targetUid);
  if (!target) return err(404, 'That player is not in your guild.');
  if (target.uid === actor.uid) return err(400, 'Use leave instead.');
  if (rankLevel(me.rank) < rankLevel('officer') || rankLevel(target.rank) >= rankLevel(me.rank)) return err(403, 'You can only remove members ranked below you.');
  removeMember(db, g, targetUid); addLog(g, now, `${actor.name} removed ${target.name}.`);
  return { ok: true };
}

function setRank(db, actor, targetUid, rank) {
  const now = actor.now || Date.now(), g = guildFor(db, actor.uid); if (!g) return err(404, 'You are not in a guild.');
  const me = memberOf(g, actor.uid), target = memberOf(g, targetUid);
  if (me.rank !== 'leader') return err(403, 'Only the leader can change ranks.');
  if (!target) return err(404, 'That player is not in your guild.');
  if (!RANKS.includes(rank)) return err(400, 'Unknown rank.');
  if (target.uid === actor.uid) return err(400, 'Pass leadership to another member instead.');
  if (rank === 'leader') { me.rank = 'officer'; target.rank = 'leader'; addLog(g, now, `${actor.name} passed leadership to ${target.name}.`); return { ok: true }; }
  target.rank = rank; addLog(g, now, `${actor.name} set ${target.name} to ${rank}.`);
  return { ok: true };
}

function setMotd(db, actor, motd) {
  const now = actor.now || Date.now(), g = guildFor(db, actor.uid); if (!g) return err(404, 'You are not in a guild.');
  if (rankLevel(memberOf(g, actor.uid).rank) < rankLevel('officer')) return err(403, 'Only officers and the leader can set the message of the day.');
  const text = typeof motd === 'string' ? motd.trim() : '';
  if (text.length > 120 || /[\u0000-\u001F\u007F]/.test(text)) return err(400, 'Message of the day: up to 120 characters.');
  g.motd = text; addLog(g, now, `${actor.name} updated the message of the day.`);
  return { ok: true };
}

// ---------------------------------------------------------------- bank
function withdrawalsToday(g, uid, now) {
  const day = dayKey(now), w = g.withdrawals[uid];
  if (!w || w.day !== day) return (g.withdrawals[uid] = { day, items: 0, gold: 0 });
  return w;
}
const intIn = (v, min, max) => { const n = Math.floor(+v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };

function deposit(db, actor, { tab, item, gold }) {
  const now = actor.now || Date.now(), g = guildFor(db, actor.uid); if (!g) return err(404, 'You are not in a guild.');
  if ((item == null) === (gold == null)) return err(400, 'Deposit one item or an amount of gold.');
  if (gold != null) {
    const n = intIn(gold, 1, 1e9); if (n == null) return err(400, 'Bad gold amount.');
    if (g.gold + n > 1e12) return err(409, 'The vault is full.');
    g.gold += n; addLog(g, now, `${actor.name} deposited ${n} gold.`);
    return { ok: true, gold: g.gold };
  }
  const t = intIn(tab, 0, TABS - 1); if (t == null) return err(400, 'Bad bank tab.');
  if (!item || typeof item !== 'object' || Array.isArray(item)) return err(400, 'Bad item.');
  if (item.bound || item.heirloom || item.soulbound) return err(400, 'Soulbound items cannot be stored.');
  if (JSON.stringify(item).length > MAX_ITEM_BYTES) return err(413, 'Item too large.');
  if (g.bank[t].length >= TAB_SIZE) return err(409, 'That tab is full.');
  g.bank[t].push(item); addLog(g, now, `${actor.name} deposited ${String(item.name || item.id || 'an item').slice(0, 40)}.`);
  return { ok: true, tab: t, slot: g.bank[t].length - 1 };
}

// withdraw by tab + slot; `expect` (the item's id or name) guards against two members taking the same slot at once
function withdraw(db, actor, { tab, slot, gold, expect }) {
  const now = actor.now || Date.now(), g = guildFor(db, actor.uid); if (!g) return err(404, 'You are not in a guild.');
  const rank = memberOf(g, actor.uid).rank, w = withdrawalsToday(g, actor.uid, now);
  if (gold != null) {
    const cap = DAILY_GOLD_WITHDRAWAL[rank]; if (cap == null) return err(403, 'Your rank cannot withdraw gold.');
    const n = intIn(gold, 1, 1e9); if (n == null) return err(400, 'Bad gold amount.');
    if (n > g.gold) return err(409, 'Not enough gold in the vault.');
    if (w.gold + n > cap) return err(429, `Daily gold limit reached (${cap - w.gold} left today).`);
    g.gold -= n; w.gold += n; addLog(g, now, `${actor.name} withdrew ${n} gold.`);
    return { ok: true, gold: n, vault: g.gold };
  }
  const cap = DAILY_ITEM_WITHDRAWALS[rank]; if (cap == null) return err(403, 'Recruits can deposit but not withdraw.');
  const t = intIn(tab, 0, TABS - 1), s = intIn(slot, 0, TAB_SIZE - 1);
  if (t == null || s == null || !g.bank[t][s]) return err(404, 'That slot is empty.');
  const item = g.bank[t][s];
  if (expect != null && expect !== item.id && expect !== item.name) return err(409, 'That slot changed. Refresh the bank.');
  if (w.items + 1 > cap) return err(429, 'Daily item withdrawal limit reached.');
  g.bank[t].splice(s, 1); w.items++; addLog(g, now, `${actor.name} withdrew ${String(item.name || item.id || 'an item').slice(0, 40)}.`);
  return { ok: true, item };
}

module.exports = { RANKS, TABS, TAB_SIZE, MAX_MEMBERS, DAILY_ITEM_WITHDRAWALS, DAILY_GOLD_WITHDRAWAL, ensure, guildFor, publicGuild, create, invite, invitesFor, accept, decline, leave, disband, kick, setRank, setMotd, deposit, withdraw };
