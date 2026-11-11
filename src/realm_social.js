'use strict';
// ================================================================ REALM GUILD + GROUP FINDER (client side of backend/guilds.cjs and backend/groupfinder.cjs)
// Only on a realm server (node backend/server.cjs) and only when signed in: MAIN MENU > SETTINGS > ACCOUNT lists
// REALM GUILD and GROUP FINDER. The device guild (src/guild_prog.js) and the AI-filled ACTIVITY FINDER are unchanged.
//   REALM GUILD   found or join a guild shared by every member's device; roster, ranks, message of the day and a
//                 guild bank (3 tabs x 20 items + gold) that the server owns
//   GROUP FINDER  queue as tank / healer / damage for a dungeon, trial or raid; a ready check pops when a
//                 role-balanced group of real players is found
// Server notices arrive on the realm stream (LocalRealm.onServerEvent) as toasts and chat lines.

const RealmSocial = {
  available: () => typeof LocalRealm !== 'undefined' && LocalRealm.available && !!LocalRealm.account && !NET.offline,
  guild: () => LocalRealm.api('/api/guild'),
  guildOp: (op, body = {}) => LocalRealm.api('/api/guild' + (op ? '/' + op : ''), { method: 'POST', body }),
  finder: () => LocalRealm.api('/api/finder'),
  finderOp: (op, body = {}) => LocalRealm.api('/api/finder/' + op, { method: 'POST', body }),
  ROLE_SETS: [['TANK', ['tank']], ['HEALER', ['healer']], ['DAMAGE', ['damage']], ['TANK OR DAMAGE', ['tank', 'damage']], ['HEALER OR DAMAGE', ['healer', 'damage']], ['ANY ROLE', ['tank', 'healer', 'damage']]],
  MODES: [['DUNGEON (5)', 'dungeon'], ['TRIAL (3)', 'trial'], ['RAID (10)', 'raid']],
};

// a small HTML form for free text (guild name, tag, a player name, a message of the day)
function realmTextForm(title, fields) {
  return new Promise(resolve => {
    const old = document.getElementById('realmForm'); if (old) old.remove();
    const wrap = document.createElement('div'); wrap.id = 'realmForm';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:150;display:grid;place-items:center;background:#000a;padding:16px';
    const input = 'font:inherit;padding:8px;background:#0d100e;color:#e6f5d0;border:1px solid #39403a;border-radius:6px';
    const form = document.createElement('form');
    form.style.cssText = "width:min(320px,100%);background:#161816;border:2px solid #7fa52c;border-radius:10px;padding:16px;display:grid;gap:10px;font:12px Silkscreen,'Courier New',monospace;color:#c9d0b0";
    const head = document.createElement('b'); head.style.cssText = 'font-size:14px;color:#d4e7bd'; head.textContent = title; form.appendChild(head);
    for (const f of fields) {
      const label = document.createElement('label'); label.style.cssText = 'display:grid;gap:4px'; label.textContent = f.label;
      const el = document.createElement('input'); el.name = f.name; el.maxLength = f.max || 40; el.required = !f.optional; el.value = f.value || ''; el.style.cssText = input;
      if (f.pattern) el.pattern = f.pattern;
      label.appendChild(el); form.appendChild(label);
    }
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'CANCEL'; cancel.style.cssText = input + ';cursor:pointer';
    const ok = document.createElement('button'); ok.textContent = 'OK'; ok.style.cssText = input + ';cursor:pointer;background:#2f4a1c;border-color:#7fa52c';
    row.append(cancel, ok); form.appendChild(row); wrap.appendChild(form); document.body.appendChild(wrap);
    const done = v => { wrap.remove(); resolve(v); };
    cancel.onclick = () => done(null);
    form.addEventListener('keydown', e => { if (e.key === 'Escape') done(null); e.stopPropagation(); });
    form.addEventListener('submit', e => { e.preventDefault(); done(Object.fromEntries(fields.map(f => [f.name, form.elements[f.name].value.trim()]))); });
    form.elements[fields[0].name].focus();
  });
}

const realmFail = e => { SFX.error(); say(String(e && e.message || e).slice(0, 120)); };
const realmTry = async (fn, then) => { try { const r = await fn(); if (then) then(r); return r; } catch (e) { realmFail(e); return null; } };

// ---------------------------------------------------------------- REALM GUILD
async function realmGuildMenu() {
  if (!RealmSocial.available()) return say('Sign in to a realm server first (SETTINGS > ACCOUNT).');
  const r = await realmTry(() => RealmSocial.guild()); if (!r) return;
  if (!r.guild) return realmNoGuildMenu(r.invites || []);
  const g = r.guild, rank = g.myRank, officer = rank === 'officer' || rank === 'leader';
  const opts = ['GUILD INFO', 'ROSTER', 'GUILD BANK', 'GUILD VAULT', ...(officer ? ['INVITE PLAYER', 'SET MESSAGE'] : []), 'GUILD LOG', 'LEAVE GUILD', ...(rank === 'leader' ? ['DISBAND GUILD'] : []), 'BACK'];
  choose(opts, k => {
    const o = opts[k];
    if (o === 'GUILD INFO') say([`<${g.tag}> ${g.name}`, `MEMBERS: ${g.members.length}  YOUR RANK: ${rank.toUpperCase()}`, g.motd ? `MOTD: ${g.motd}` : 'NO MESSAGE OF THE DAY.'], realmGuildMenu);
    else if (o === 'ROSTER') realmRoster(g);
    else if (o === 'GUILD BANK') realmBank(g, 0);
    else if (o === 'GUILD VAULT') realmVault(g);
    else if (o === 'INVITE PLAYER') realmTextForm('INVITE TO GUILD', [{ name: 'u', label: 'ACCOUNT NAME', max: 16, pattern: '[A-Za-z0-9_]{3,16}' }]).then(v => v && realmTry(() => RealmSocial.guildOp('invite', { username: v.u }), () => { SFX.confirm(); say(`INVITATION SENT TO ${v.u.toUpperCase()}.`, realmGuildMenu); }));
    else if (o === 'SET MESSAGE') realmTextForm('MESSAGE OF THE DAY', [{ name: 'm', label: 'MESSAGE', max: 120, optional: true, value: g.motd }]).then(v => v && realmTry(() => RealmSocial.guildOp('motd', { motd: v.m }), realmGuildMenu));
    else if (o === 'GUILD LOG') say((g.log || []).slice(-6).map(l => l.text).concat(g.log && g.log.length ? [] : ['NOTHING YET.']), realmGuildMenu);
    else if (o === 'LEAVE GUILD') choose(['LEAVE', 'STAY'], c => { if (c === 0) realmTry(() => RealmSocial.guildOp('leave'), x => { SFX.close(); say(x.disbanded ? 'THE GUILD IS DISBANDED.' : 'YOU LEFT THE GUILD.'); }); }, `LEAVE ${g.name}?`);
    else if (o === 'DISBAND GUILD') choose(['DISBAND', 'CANCEL'], c => { if (c === 0) realmTry(() => RealmSocial.guildOp('disband'), () => { SFX.close(); say('THE GUILD IS DISBANDED.'); }); }, 'DISBAND FOR EVERYONE?');
  }, `<${g.tag}> ${g.name}`.slice(0, 24));
}

function realmNoGuildMenu(invites) {
  const opts = [...invites.map(i => `JOIN <${i.tag}> ${i.name}`.slice(0, 24)), 'FOUND A GUILD', 'BACK'];
  choose(opts, k => {
    if (k < 0 || opts[k] === 'BACK') return;
    if (k < invites.length) {
      const inv = invites[k];
      return choose(['ACCEPT', 'DECLINE', 'BACK'], c => {
        if (c === 0) realmTry(() => RealmSocial.guildOp('accept', { id: inv.id }), () => { SFX.levelup(); say(`WELCOME TO ${inv.name}!`, realmGuildMenu); });
        else if (c === 1) realmTry(() => RealmSocial.guildOp('decline', { id: inv.id }), realmGuildMenu);
      }, `INVITED BY ${inv.from}`.slice(0, 24));
    }
    realmTextForm('FOUND A GUILD', [{ name: 'name', label: 'GUILD NAME (3-20)', max: 20 }, { name: 'tag', label: 'TAG (2-4)', max: 4, pattern: '[A-Za-z0-9]{2,4}' }])
      .then(v => v && realmTry(() => RealmSocial.guildOp('', { name: v.name, tag: v.tag }), x => { SFX.levelup(); say(`<${x.guild.tag}> ${x.guild.name} IS FOUNDED!`, realmGuildMenu); }));
  }, invites.length ? 'GUILD INVITATIONS' : 'NO GUILD');
}

function realmRoster(g) {
  const ranks = { leader: 'LDR', officer: 'OFC', member: 'MBR', recruit: 'RCT' };
  const rows = g.members.map(m => `${ranks[m.rank]} ${m.name}`.slice(0, 20));
  choose([...rows, 'BACK'], k => {
    if (k < 0 || k >= g.members.length) return realmGuildMenu();
    const m = g.members[k], me = LocalRealm.account && m.id === LocalRealm.account.id;
    const acts = [];
    if (!me && g.myRank === 'leader') acts.push('MAKE OFFICER', 'MAKE MEMBER', 'MAKE RECRUIT', 'PASS LEADERSHIP');
    if (!me && (g.myRank === 'leader' || (g.myRank === 'officer' && ['member', 'recruit'].includes(m.rank)))) acts.push('REMOVE');
    if (!acts.length) return say(`${m.name}: ${m.rank.toUpperCase()}`, () => realmRoster(g));
    choose([...acts, 'BACK'], c => {
      const a = acts[c]; if (!a) return realmRoster(g);
      const done = x => realmRoster(x.guild);
      if (a === 'REMOVE') realmTry(() => RealmSocial.guildOp('kick', { accountId: m.id }), done);
      else realmTry(() => RealmSocial.guildOp('rank', { accountId: m.id, rank: a === 'PASS LEADERSHIP' ? 'leader' : a.slice(5).toLowerCase() }), done);
    }, m.name.slice(0, 24));
  }, 'ROSTER');
}

function realmBank(g, tab) {
  const items = g.bank.tabs[tab] || [];
  const rows = items.map(it => String(it.name || it.id || 'ITEM').slice(0, 20));
  const opts = [...rows, 'DEPOSIT ITEM', `TAB ${(tab + 1) % 3 + 1}`, 'BACK'];
  choose(opts, k => {
    const o = opts[k];
    if (k < 0 || o === 'BACK') return realmGuildMenu();
    if (o.startsWith('TAB ')) return realmBank(g, (tab + 1) % 3);
    if (o === 'DEPOSIT ITEM') {
      const pool = G.bag.filter(it => !it.fav && !it.heirloom && !it.bound).slice(0, 10);
      if (!pool.length) return say('Nothing in your bag can be stored.', () => realmBank(g, tab));
      return choose([...pool.map(it => it.name.slice(0, 20)), 'BACK'], j => {
        const it = pool[j]; if (!it) return realmBank(g, tab);
        // the server stores it first; the bag only loses it once the bank has it
        realmTry(() => RealmSocial.guildOp('bank/deposit', { tab, item: slimItem(it) }), x => { const at = G.bag.indexOf(it); if (at >= 0) G.bag.splice(at, 1); saveGame(); SFX.confirm(); realmBank(x.guild, tab); });
      }, 'DEPOSIT WHICH?');
    }
    const it = items[k];
    if (G.bag.length >= BAG_MAX) return say('Your bag is full.', () => realmBank(g, tab));
    choose(['WITHDRAW', 'BACK'], c => {
      if (c !== 0) return realmBank(g, tab);
      realmTry(() => RealmSocial.guildOp('bank/withdraw', { tab, slot: k, expect: it.id != null ? it.id : it.name }), x => {
        const got = cleanItem(x.item); if (got) addGear(got); saveGame(); SFX.confirm(); realmBank(x.guild, tab);
      });
    }, String(it.name || 'ITEM').slice(0, 24));
  }, `GUILD BANK TAB ${tab + 1}: ${items.length}/${g.bank.tabSize}`);
}

function realmVault(g) {
  const amounts = [100, 1000, 10000];
  const opts = [...amounts.map(a => `DEPOSIT ${a}`), ...amounts.map(a => `WITHDRAW ${a}`), 'BACK'];
  choose(opts, k => {
    const o = opts[k]; if (k < 0 || o === 'BACK') return realmGuildMenu();
    const n = +o.split(' ')[1];
    if (o.startsWith('DEPOSIT')) {
      if (G.gold < n) return say('You do not have that much gold.', () => realmVault(g));
      G.gold -= n; saveGame();
      realmTry(() => RealmSocial.guildOp('bank/deposit', { gold: n }), x => { SFX.confirm(); realmVault(x.guild); }).then(x => { if (!x) { G.gold += n; saveGame(); } });
    } else realmTry(() => RealmSocial.guildOp('bank/withdraw', { gold: n }), x => { G.gold += x.gold; saveGame(); SFX.confirm(); realmVault(x.guild); });
  }, `VAULT: ${g.bank.gold} GOLD  YOU: ${G.gold}`.slice(0, 24));
}

// ---------------------------------------------------------------- GROUP FINDER
async function realmFinderMenu() {
  if (!RealmSocial.available()) return say('Sign in to a realm server first (SETTINGS > ACCOUNT).');
  const r = await realmTry(() => RealmSocial.finder()); if (!r) return;
  const st = r.status;
  if (st.state === 'queued') {
    const need = st.need, c = st.counts;
    return choose(['REFRESH', 'LEAVE QUEUE', 'BACK'], k => { if (k === 0) realmFinderMenu(); else if (k === 1) realmTry(() => RealmSocial.finderOp('leave'), () => { SFX.close(); say('YOU LEFT THE QUEUE.'); }); },
      `${st.mode.toUpperCase()} T${c.tank}/${need.tank} H${c.healer}/${need.healer} D${c.damage}/${need.damage}`.slice(0, 24));
  }
  if (st.state === 'ready-check') return realmReadyCheck(st.check);
  if (st.state === 'grouped') {
    const g = st.group;
    return choose(['ROSTER', 'LEAVE GROUP', 'BACK'], k => {
      if (k === 0) say(g.members.map(m => `${m.role.toUpperCase().slice(0, 4)} ${m.name} L${m.level}`), realmFinderMenu);
      else if (k === 1) realmTry(() => RealmSocial.finderOp('leave'), () => { SFX.close(); say('YOU LEFT THE GROUP.'); });
    }, `GROUP: ${g.mode.toUpperCase()} ${g.members.length} PLAYERS`.slice(0, 24));
  }
  const queues = r.queues || [];
  choose([...RealmSocial.MODES.map(([label, mode]) => { const q = queues.find(x => x.mode === mode && x.activity === 'any'); return q ? `${label} ${q.queued}Q` : label; }), 'BACK'], k => {
    const m = RealmSocial.MODES[k]; if (!m) return;
    choose([...RealmSocial.ROLE_SETS.map(x => x[0]), 'BACK'], j => {
      const roles = RealmSocial.ROLE_SETS[j]; if (!roles) return realmFinderMenu();
      realmTry(() => RealmSocial.finderOp('join', { activity: 'any', mode: m[1], roles: roles[1], level: G.lvl }), x => { SFX.confirm(); if (x.status.state === 'ready-check') realmReadyCheck(x.status.check); else say(`QUEUED FOR ${m[0]} AS ${roles[0]}.`); });
    }, 'YOUR ROLE');
  }, 'GROUP FINDER: REAL PLAYERS');
}

let realmCheckOpen = null;
function realmReadyCheck(check) {
  if (realmCheckOpen === check.id) return; realmCheckOpen = check.id;
  const me = LocalRealm.account && check.members.find(m => m.uid === LocalRealm.account.id);
  choose(['ACCEPT', 'DECLINE'], k => {
    realmCheckOpen = null;
    realmTry(() => RealmSocial.finderOp('ready', { accept: k === 0 }), x => { if (k === 0) { SFX.confirm(); if (x.status.state === 'ready-check') toast('GROUP FINDER', 'Waiting for the others...', 'px_tower', 'confirm'); } else SFX.close(); });
  }, `READY? ${check.mode.toUpperCase()}${me ? ' AS ' + me.role.toUpperCase() : ''}`.slice(0, 24));
}

// ---------------------------------------------------------------- live notices and menu wiring
if (typeof LocalRealm !== 'undefined' && LocalRealm.onServerEvent) {
  LocalRealm.onServerEvent('finder', d => {
    if (d.type === 'ready-check') { toast('GROUP FOUND', `${d.check.mode.toUpperCase()}: ready check`, 'px_tower', 'lfg_ready'); realmReadyCheck(d.check); }
    else if (d.type === 'ready-failed') { realmCheckOpen = null; toast('GROUP FINDER', 'Someone was not ready - requeued', 'px_tower', 'error'); }
    else if (d.type === 'dropped') { realmCheckOpen = null; toast('GROUP FINDER', 'You left the queue', 'px_tower', 'close'); }
    else if (d.type === 'grouped') { toast('GROUP READY', d.group.members.map(m => m.name).join(', ').slice(0, 30), 'px_tower', 'levelup'); if (typeof chatLog === 'function') chatLog('party', 'Group finder', `Group formed: ${d.group.members.map(m => `${m.name} (${m.role})`).join(', ')}`); }
    else if (d.type === 'member-left' && typeof chatLog === 'function') chatLog('party', 'Group finder', `${d.name} left the group.`);
  });
  LocalRealm.onServerEvent('guild', d => {
    if (d.invite) { toast('GUILD INVITE', `<${d.invite.tag}> ${d.invite.name}`.slice(0, 30), 'px_tower', 'confirm'); if (typeof chatLog === 'function') chatLog('guild', 'Realm', `${d.invite.from} invited you to <${d.invite.tag}> ${d.invite.name}. SETTINGS > ACCOUNT > REALM GUILD.`); }
    else if (d.removed) toast('GUILD', 'You were removed from the guild', 'px_tower', 'error');
    else if (d.disbanded) toast('GUILD', `${d.disbanded} was disbanded`.slice(0, 30), 'px_tower', 'error');
  });
}
if (typeof AccountScene !== 'undefined') {
  const opts0 = AccountScene.prototype.opts, run0 = AccountScene.prototype.run;
  AccountScene.prototype.opts = function () {
    const o = opts0.call(this);
    if (!this.page() && LocalRealm.available && LocalRealm.account) o.splice(o.indexOf('LOG OUT'), 0, 'REALM GUILD', 'GROUP FINDER');
    return o;
  };
  AccountScene.prototype.run = function (o) {
    if (o === 'REALM GUILD') return realmGuildMenu();
    if (o === 'GROUP FINDER') return realmFinderMenu();
    return run0.call(this, o);
  };
}
if (typeof module !== 'undefined') module.exports = { RealmSocial };
