// ================================================================ TRADING HUB (auction house) + DIRECT PLAYER TRADE
// The auction house works in three backends, picked automatically:
//   realm   the local realm server (backend/server.cjs /api/market): server-held listings, 5% cut, proceeds
//   page    a shared claude.ai page: listings live in the page's shared database (collection "market")
//   local   offline: a simulated market of NPC sellers and buyers
// Fees (gold sinks): a deposit of 5% of the item value when you list (kept even if it does not sell)
// and a 5% cut of the sale price. Listings last 12 hours (realm/page) or a few hundred steps (offline).
// Direct trade needs no auction house: invite a player who is online with you, both put up items and
// gold, both LOCK, then both CONFIRM. Each side applies the swap; a cancel at any point undoes nothing.

const MARKET_CATS = ['ALL', 'WEAPON', 'ARMOR', 'TRINKET', 'MATERIAL', 'CONSUMABLE'];
const listingCat = l => l.stack ? (ITEMS[l.stack.id] && ITEMS[l.stack.id].type === 'mat' ? 'MATERIAL' : 'CONSUMABLE') : l.item.kind === 'weapon' ? 'WEAPON' : l.item.kind === 'armor' ? 'ARMOR' : 'TRINKET';
const listingName = l => l.stack ? `${(ITEMS[l.stack.id] || { name: l.stack.id }).name} x${l.stack.n}` : l.item.name;
const listingIcon = l => l.stack ? ((ITEMS[l.stack.id] || {}).icon || 'item_coin') : itemIcon(l.item);
const listingValue = l => l.stack ? ((ITEMS[l.stack.id] || {}).price || 1) * l.stack.n : (l.item.value || 1);
const depositFor = v => Math.max(1, Math.round(v * 0.05));

// items crossing between players are re-validated and given a new uid
function slimItem(it) { const o = JSON.parse(JSON.stringify(it)); delete o.uid; delete o.fav; delete o.junk; return o; }
function cleanItem(o) {
  if (!o || typeof o !== 'object' || !['weapon', 'armor', 'wondrous'].includes(o.kind)) return null;
  if (o.kind === 'weapon' && !WEAPONS[o.base]) return null;
  if (o.kind === 'armor' && !ARMORS[o.base]) return null;
  if (o.kind === 'wondrous' && !WONDROUS.find(w => w.id === o.base)) return null;
  const n = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? Math.floor(+v) : d));
  const it = { uid: ITEM_UID++, kind: o.kind, base: o.base, rarity: n(o.rarity, 0, RARITY.length - 1, 1), ilvl: n(o.ilvl, 1, 720, 1), plus: n(o.plus, -1, 20, 0),
    affixes: Array.isArray(o.affixes) ? o.affixes.filter(a => Array.isArray(a) && SUBSTATS[a[0]]).slice(0, 8).map(([k, v]) => [k, n(v, 1, SUBSTATS[k].max, 1)]) : [],
    name: String(o.name || '').replace(/[^A-Z0-9 '+\-]/gi, '').slice(0, 30) || 'TRADED ITEM', value: n(o.value, 1, 1e8, 1), attune: !!o.attune };
  if (o.slot && typeof o.slot === 'string') it.slot = o.slot;
  if (o.aclass && ARMOR_CLASSES[o.aclass]) it.aclass = o.aclass;
  if (o.named) it.named = String(o.named).slice(0, 40);
  if (o.legend && typeof o.legend === 'object') it.legend = o.legend;
  it.rank = rankFor(it.ilvl).n;
  return it;
}
const cleanStack = s => s && ITEMS[s.id] && ['mat', 'use', 'scroll', 'camp'].includes(ITEMS[s.id].type) ? { id: s.id, n: Math.max(1, Math.min(999, Math.floor(+s.n) || 1)) } : null;
function giveListing(l) { if (l.stack) { const s = cleanStack(l.stack); if (s) addItem(s.id, s.n); return !!s; } const it = cleanItem(l.item); if (it) addGear(it); return !!it; }

const Market = {
  mode() {
    if (NET.offline) return 'local';
    if (NET.transport === 'server' && typeof LocalRealm !== 'undefined' && LocalRealm.token) return 'realm';
    if (NET.db && NET.myId) return 'page';
    return 'local';
  },
  // ---- offline simulation
  npcList() {
    const day = new Date().toDateString(), key = `${day}|${G.lvl}`;
    if (!this._npc || this._npcKey !== key) {
      const r = RNG('ah-' + key); this._npcKey = key;
      const gear = Array.from({ length: 14 }, () => { const it = makeItem({ lvl: Math.max(1, G.lvl + r.int(-3, 4)), rarity: r.pick([1, 2, 2, 3, 3, 4]) }); return { id: 'npc' + it.uid, item: it, price: Math.round(it.value * (2 + r() * 2)), sellerName: r.pick(SIM_NAMES), npc: true }; });
      const mats = (typeof MATERIALS !== 'undefined' ? MATERIALS : []).filter(m => m.lvl <= G.lvl + 10);
      const stacks = Array.from({ length: 10 }, () => { const m = mats.length ? r.pick(mats) : { id: 'peacebloom' }; const n = r.int(3, 12); return { id: 'npcs' + r.int(1, 1e9), stack: { id: m.id, n }, price: Math.round((ITEMS[m.id].price || 2) * n * (1.6 + r() * 1.2)), sellerName: r.pick(SIM_NAMES), npc: true }; });
      const cons = Object.keys(ITEMS).filter(k => ITEMS[k].type === 'use' && ITEMS[k].price).slice(0, 60);
      const potions = Array.from({ length: 6 }, () => { const k = r.pick(cons), n = r.int(1, 5); return { id: 'npcc' + r.int(1, 1e9), stack: { id: k, n }, price: Math.round(ITEMS[k].price * n * 1.8), sellerName: r.pick(SIM_NAMES), npc: true }; });
      this._npc = gear.concat(stacks, potions);
    }
    return this._npc;
  },
  settleLocal() { // NPC buyers: cheaper listings sell faster
    G.ah ||= []; const sold = [];
    for (const l of G.ah.slice()) {
      const age = G.stats.steps - (l.steps || 0), ratio = l.price / Math.max(1, listingValue(l));
      const chance = ratio <= 2 ? 0.5 : ratio <= 4 ? 0.25 : ratio <= 8 ? 0.08 : 0.01;
      if (age > 30 && R() < chance) { G.ah.splice(G.ah.indexOf(l), 1); const g = Math.floor(l.price * 0.95); G.mail.push({ from: 'TRADING HUB', text: `${listingName(l)} sold for ${l.price}G (5% cut).`, gold: g }); sold.push(l); }
      else if (age > 900) { G.ah.splice(G.ah.indexOf(l), 1); G.mail.push({ from: 'TRADING HUB', text: `${listingName(l)} expired and was returned.`, item: l.item || null, stack: l.stack || null }); }
    }
    if (sold.length) toast('AUCTION SOLD', `${sold.length} sold - check mail`, 'item_coin', 'auction');
  },
  // ---- shared API
  async browse() {
    const m = this.mode();
    if (m === 'realm') { const r = await LocalRealm.api('/api/market'); return r.listings.filter(l => l.seller !== LocalRealm.account.id); }
    if (m === 'page') { const snap = await NET.db.collection('market').where('sold', '==', false).limit(200).get(); const now = Date.now(); return snap.docs.map(d => d.data()).filter(l => l && l.seller !== NET.myId && l.expires > now); }
    return this.npcList();
  },
  async mine() {
    const m = this.mode();
    if (m === 'realm') { const r = await LocalRealm.api('/api/market'); return r.listings.filter(l => l.seller === LocalRealm.account.id); }
    if (m === 'page') { const snap = await NET.db.collection('market').where('seller', '==', NET.myId).limit(50).get(); return snap.docs.map(d => d.data()).filter(l => l && !l.sold); }
    return (G.ah || []).slice();
  },
  async post(src, price) { // src: { item } from the bag or { stack: {id, n} } from materials/consumables
    const l = src.item ? { item: slimItem(src.item) } : { stack: { id: src.stack.id, n: src.stack.n } };
    const dep = depositFor(listingValue(src.item ? { item: src.item } : l));
    if (G.gold < dep) return `Deposit is ${dep} G.`;
    const m = this.mode();
    if (m === 'realm') await LocalRealm.api('/api/market', { method: 'POST', body: { ...l, price, hours: 12, sellerName: G.name } });
    else if (m === 'page') { const id = `${NET.myId.slice(0, 12)}_${Date.now().toString(36)}`; await NET.db.doc('market/' + id).set({ id, ...l, price, seller: NET.myId, sellerName: G.name.slice(0, 12), ts: Date.now(), expires: Date.now() + 12 * 3600e3, sold: false, buyer: null, claimed: false }); }
    else { G.ah ||= []; if (G.ah.length >= 20) return 'You already have 20 listings.'; G.ah.push({ ...(src.item ? { item: src.item } : l), price, steps: G.stats.steps }); }
    // remove from the bag only after the listing is accepted
    if (src.item) G.bag.splice(G.bag.indexOf(src.item), 1); else for (let i = 0; i < src.stack.n; i++) takeItem(src.stack.id);
    G.gold -= dep; G.stats.auctions = (G.stats.auctions || 0) + 1; saveGame();
    return null;
  },
  async buy(l) {
    if (G.gold < l.price) return 'Not enough gold.';
    if (!l.stack && G.bag.length >= BAG_MAX) return 'Your bag is full.';
    const m = this.mode();
    if (m === 'realm') { const r = await LocalRealm.api('/api/market/buy', { method: 'POST', body: { id: l.id } }); l = r.listing; }
    else if (m === 'page') {
      const ref = NET.db.doc('market/' + l.id), cur = (await ref.get()).data();
      if (!cur || cur.sold) return 'Someone bought it first.';
      await ref.update({ sold: true, buyer: NET.myId, buyerName: G.name.slice(0, 12), soldAt: Date.now() });
    } else { const L = this.npcList(); const i = L.indexOf(l); if (i < 0) return 'That listing is gone.'; L.splice(i, 1); }
    G.gold -= l.price; giveListing(l); saveGame();
    return null;
  },
  async cancel(l) {
    const m = this.mode();
    if (m === 'realm') { const r = await LocalRealm.api('/api/market/cancel', { method: 'POST', body: { id: l.id } }); giveListing(r.listing); }
    else if (m === 'page') { const ref = NET.db.doc('market/' + l.id), cur = (await ref.get()).data(); if (!cur || cur.sold) return 'It already sold - claim your gold.'; await ref.delete(); giveListing(cur); }
    else { const i = (G.ah || []).indexOf(l); if (i < 0) return 'Not listed.'; G.ah.splice(i, 1); if (l.stack) addItem(l.stack.id, l.stack.n); else addGear(l.item); }
    saveGame(); return null;
  },
  async claim() { // proceeds and expired listings
    const m = this.mode(); let gold = 0, back = 0;
    if (m === 'realm') { const r = await LocalRealm.api('/api/market/claim'); gold = r.gold || 0; for (const l of r.returned || []) if (giveListing(l)) back++; }
    else if (m === 'page') {
      const snap = await NET.db.collection('market').where('seller', '==', NET.myId).limit(100).get(), now = Date.now();
      for (const d of snap.docs) { const l = d.data(); if (!l) continue;
        if (l.sold && !l.claimed) { await NET.db.doc('market/' + l.id).delete(); gold += Math.floor(l.price * 0.95); }
        else if (!l.sold && l.expires < now) { await NET.db.doc('market/' + l.id).delete(); if (giveListing(l)) back++; } }
    } else { this.settleLocal(); return 'Offline sales arrive by mail.'; }
    G.gold += gold; if (gold) G.stats.goldEarned += gold; saveGame();
    return gold || back ? `Claimed ${gold} G${back ? `, ${back} returned` : ''}.` : 'Nothing to claim.';
  },
};

// ---------------------------------------------------------------- trading hub scene
class MarketScene {
  constructor() { this.opaque = true; this.tab = 0; this.cat = 0; this.i = 0; this.top = 0; this.rows = []; this.msg = ''; this.busy = false; Market.settleLocal(); this.load(); }
  async load() {
    this.busy = true;
    try { this.rows = this.tab === 0 ? await Market.browse() : this.tab === 2 ? await Market.mine() : []; } catch (e) { this.msg = 'MARKET: ' + String(e.message || e).slice(0, 18); this.rows = []; }
    this.busy = false; this.i = Math.min(this.i, Math.max(0, this.view().length - 1));
  }
  view() {
    if (this.tab === 1) return this.sellables();
    const c = MARKET_CATS[this.cat]; return this.rows.filter(l => c === 'ALL' || listingCat(l) === c);
  }
  sellables() {
    const gear = G.bag.filter(it => !it.fav).map(it => ({ src: { item: it }, name: it.name, icon: itemIcon(it), value: it.value || 1, rarity: it.rarity }));
    const stacks = Object.keys(G.inv).filter(k => G.inv[k] > 0 && ITEMS[k] && ['mat', 'use', 'scroll'].includes(ITEMS[k].type)).map(k => ({ src: { stack: { id: k, n: G.inv[k] } }, name: `${ITEMS[k].name} x${G.inv[k]}`, icon: ITEMS[k].icon, value: (ITEMS[k].price || 1) * G.inv[k], rarity: ITEMS[k].rarity || 1 }));
    return gear.concat(stacks);
  }
  update() {
    if (this.busy) return;
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (P('select')) { this.tab = (this.tab + 1) % 4; this.i = this.top = 0; this.msg = ''; SFX.page(); this.load(); return; }
    if (this.tab === 0 && (P('left') || P('right'))) { this.cat = (this.cat + (P('left') ? MARKET_CATS.length - 1 : 1)) % MARKET_CATS.length; this.i = this.top = 0; SFX.cursor(); return; }
    const V = this.view();
    if (V.length) {
      if (nav('up')) { this.i = (this.i + V.length - 1) % V.length; SFX.cursor(); }
      if (nav('down')) { this.i = (this.i + 1) % V.length; SFX.cursor(); }
      if (this.i < this.top) this.top = this.i; if (this.i > this.top + 6) this.top = this.i - 6;
    }
    if (!P('a')) return;
    const run = (p, ok) => { this.busy = true; p.then(e => { this.busy = false; if (e && !/^Claimed/.test(e)) { this.msg = e.toUpperCase(); SFX.error(); } else { this.msg = (e || ok).toUpperCase(); SFX.buy(); } this.load(); }).catch(e => { this.busy = false; this.msg = String(e.message || e).toUpperCase().slice(0, 25); SFX.error(); }); };
    if (this.tab === 3) return run(Market.claim(), 'CLAIMED');
    const e = V[this.i]; if (!e) return;
    if (this.tab === 0) {
      if (!e.stack && e.item) {
        const item = e.item, slot = itemSlot(item), current = derive(G), eq = { ...G.eq, [slot]: item };
        const target = derive({ ...G, eq });
        const delta = (a, b) => { const n = Math.round((b - a) * 10) / 10; return (n > 0 ? '+' : '') + n; };
        const setId = item.setId || item.set || item.template?.setId || item.template?.set;
        const gemSlots = typeof gemSocketCapacity === 'function' ? gemSocketCapacity(item) : 0;
        const runeSlots = typeof runeSocketCapacity === 'function' ? runeSocketCapacity(item) : 0;
        const durability = item.maxDur > 0 ? 'DUR ' + Math.round((item.dur || 0) / item.maxDur * 100) + '%' : 'DUR N/A';
        const rows = [
          listingName(e) + ' · ' + fmt(e.price) + ' G',
          'ILVL ' + (item.ilvl || 1) + ' · ' + (RARITY[item.rarity]?.name || 'COMMON') + ' · ' + (SLOT_NAME[slot] || slot).toUpperCase(),
          'SET ' + (setId || 'NONE') + ' · ' + durability,
          'GEMS ' + (item.sockets || []).filter(Boolean).length + '/' + gemSlots + ' · RUNES ' + (item.runeSockets || []).filter(Boolean).length + '/' + runeSlots + ' · ' + (item.attune ? 'ATTUNE' : 'NO ATTUNE'),
          ...legendarySetPreview(G, item).flatMap(set => set.thresholds.map(t => set.name + ' ' + t.pieces + 'PC ' + (t.newlyUnlocked ? 'NEW' : t.active ? 'ACTIVE' : 'LOCKED') + ': ' + t.stats.map(([k, v]) => k.toUpperCase() + ' +' + v).join(', '))),
          'SELLER ' + (e.sellerName || 'A SELLER') + ' · GOLD AFTER ' + fmt(G.gold - e.price),
          'AC ' + current.ac + ' → ' + target.ac + ' (' + delta(current.ac, target.ac) + ')',
          'ATK ' + current.weapon.hit + ' → ' + target.weapon.hit + ' (' + delta(current.weapon.hit, target.weapon.hit) + ')',
          'DMG ' + current.weapon.dice + '+' + current.weapon.dmg + ' → ' + target.weapon.dice + '+' + target.weapon.dmg,
          'HP ' + current.hpMax + ' → ' + target.hpMax + ' (' + delta(current.hpMax, target.hpMax) + ')',
          'CRIT ' + current.crit + '% → ' + target.crit + '%',
          'DODGE ' + current.dodge + '% → ' + target.dodge + '%',
          'BLOCK ' + current.block + '% → ' + target.block + '%',
          'LEECH ' + current.leech + '% → ' + target.leech + '%',
          'HASTE ' + current.haste + '% → ' + target.haste + '%',
          'RESIST ' + current.resistAll + '% → ' + target.resistAll + '%'
        ];
        const mods = (item.affixes || []).map(([key, value]) => 'AFFIX ' + key.toUpperCase() + ' +' + value);
        rows.push(...(mods.length ? mods : ['NO ROLLED AFFIXES']));
        return say(rows, () => choose([`BUY ${fmt(e.price)} G`, 'CANCEL'], k => { if (k === 0) run(Market.buy(e), 'BOUGHT ' + listingName(e).slice(0, 14)); }, 'Confirm only after reviewing the item and price.'));
      }
      return choose([`BUY ${fmt(e.price)} G`, 'BACK'], k => { if (k === 0) run(Market.buy(e), 'BOUGHT ' + listingName(e).slice(0, 14)); }, `${listingName(e)} from ${e.sellerName || 'A SELLER'}.`);
    }
    if (this.tab === 2) return choose(['CANCEL LISTING', 'BACK'], k => { if (k === 0) run(Market.cancel(e), 'RETURNED TO YOU'); }, `${listingName(e)} for ${fmt(e.price)} G.`);
    if (this.tab === 1) {
      const v = e.value, opts = [2, 3, 4, 6, 10].map(x => Math.max(1, Math.round(v * x)));
      choose(opts.map((p, i) => `${fmt(p)} G (x${[2, 3, 4, 6, 10][i]})`).concat(['BACK']), k => { if (k < 0 || k >= opts.length) return; run(Market.post(e.src, opts[k]), 'LISTED ' + e.name.slice(0, 12)); }, `Deposit ${depositFor(v)} G (5%). Sale cut 5%. Value ${fmt(v)} G.`);
    }
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3);
    const blackbird = S.uiTheme === 'blackbird';
    if (blackbird) { fill(1, 11, 158, 132, '#090b0e'); fill(2, 12, 156, 1, '#8c744b'); fill(2, 12, 1, 130, '#6f5b3d'); fill(157, 12, 1, 130, '#292d32'); fill(3, 23, 154, 77, '#171a1f'); fill(3, 102, 154, 40, '#101317'); fill(3, 102, 154, 1, '#b09258'); }
    const tabs = ['BROWSE', 'SELL', 'MINE', 'CLAIM'];
    textC(`< ${tabs[this.tab]} >  ${Market.mode().toUpperCase()}`, 80, 1, 'gold');
    if (this.tab === 0) text(`< ${MARKET_CATS[this.cat]} >`, 3, 13, 2);
    textR(`${fmt(G.gold)}G`, 157, 13, 'gold');
    if (this.busy) { textC('LOADING...', 80, 60, 2); return; }
    if (this.tab === 3) { textC('A: COLLECT GOLD FROM SALES', 80, 50, 3); textC('AND EXPIRED LISTINGS', 80, 62, 2); textC('(OFFLINE SALES COME BY MAIL)', 80, 80, 1); }
    const V = this.view();
    if (this.tab !== 3 && !V.length) textC(this.tab === 1 ? 'NOTHING TO SELL' : 'NO LISTINGS', 80, 60, 2);
    V.slice(this.top, this.top + 7).forEach((e, j) => {
      const i = this.top + j, y = 24 + j * 11, sell = this.tab === 1;
      if (i === this.i) fill(1, y - 1, 158, 11, blackbird ? '#51432f' : 1);
      const ic = sell ? e.icon : listingIcon(e); if (ic && IMG[ic]) blit(sprFit(ic, 9), 3, y);
      text((sell ? e.name : listingName(e)).slice(0, 15), 14, y, rarityCol(sell ? e.rarity : e.item ? e.item.rarity : (ITEMS[e.stack.id] || {}).rarity || 1));
      textR(sell ? `${fmt(e.value)}` : fmt(e.price), 157, y, 2);
    });
    if (!blackbird) frame(1, 102, 158, 41); else { fill(4, 103, 152, 37, '#171a1f'); fill(4, 103, 152, 1, '#343941'); }
    const e = V[this.i];
    // Gear inspection in the market uses the same live character stat/equipment
    // model as the inventory screen, so listings show real upgrade deltas.
    const gear = e && (this.tab === 1 ? e.src && e.src.item : e.item);
    if (gear) {
      if (this.tab === 0) text(`SELLER ${e.sellerName || '?'}`.slice(0, 25), 5, 105, 2);
      else if (this.tab === 1) text(`VALUE ${fmt(e.value)} G  DEPOSIT ${depositFor(e.value)} G`.slice(0, 25), 5, 105, 2);
      else text(`LISTED AT ${fmt(e.price)} G`, 5, 105, 2);
      const slot = SLOT_NAME[itemSlot(gear)] || 'GEAR';
      text(`IL${gear.ilvl || 1} ${slot} ${itemKeyStat(gear)}`.slice(0, 25), 5, 114, 3);
      const equipped = equippedFor(G, gear);
      const delta = equipped ? itemPower(G, gear) - itemPower(G, equipped) : 0;
      const affix = (gear.affixes || []).slice(0, 2).map(([k, v]) => SUBSTATS[k] ? `+${v}${SUBSTATS[k].unit}${SUBSTATS[k].name.slice(0, 5)}` : '').filter(Boolean).join(' ');
      const comparison = equipped ? `VS EQUIPPED ${delta >= 0 ? '+' : ''}${Math.round(delta)} PWR` : 'NEW EQUIPMENT SLOT';
      text((affix || 'NO ROLLED AFFIXES').slice(0, 25), 5, 123, 3);
      text(comparison.slice(0, 25), 5, 132, equipped && delta < 0 ? 'red' : 'green');
    } else if (e && this.tab === 0) {
      text(`SELLER ${e.sellerName || '?'}`.slice(0, 25), 5, 105, 2);
      text(wrap((ITEMS[e.stack.id] || {}).desc || '', 25).slice(0, 2).join('\n'), 5, 114, 3);
    } else if (e && this.tab === 1) text(`LIST FOR 2X-10X VALUE\nDEPOSIT ${depositFor(e.value)} G`, 5, 105, 2);
    else if (e && this.tab === 2) text(`LISTED AT ${fmt(e.price)} G\nA: CANCEL`, 5, 105, 2);
    text((this.msg || 'SEL: TAB  L/R: CATEGORY').slice(0, 25), 5, 139, this.msg ? 'gold' : 1);
  }
}

// ---------------------------------------------------------------- direct player trade (no auction house)
const Trade = {
  partner: null, partnerName: '', me: { gold: 0, items: [], stacks: [] }, them: { gold: 0, items: [], stacks: [] },
  myLock: false, theirLock: false, myOk: false, theirOk: false, pendingInvite: null, hooked: false,
  peerId() { return NET.myPeer ? NET.myPeer() : (NET.transport === 'server' && typeof LocalRealm !== 'undefined' ? LocalRealm.peer : null); },
  send(kind, extra = {}) { if (!NET.room || !this.partner) return; NET.room.emit('trade', { to: this.partner, kind, name: G.name.slice(0, 12), ...extra }).catch(() => toast('TRADE', 'Trade needs online access', 'item_coin', 'error')); },
  reset() { this.me = { gold: 0, items: [], stacks: [] }; this.them = { gold: 0, items: [], stacks: [] }; this.myLock = this.theirLock = this.myOk = this.theirOk = false; },
  invite(peer, name) { this.partner = peer; this.partnerName = name; this.reset(); this.send('invite'); push(new TradeScene()); },
  offerPayload() { return { gold: this.me.gold, items: this.me.items.map(slimItem), stacks: this.me.stacks }; },
  sync() { this.myLock = this.myOk = false; this.send('offer', { offer: this.offerPayload() }); },
  onMsg(m) {
    const d = m.data || {}; if (!d || d.to !== this.peerId()) return;
    if (d.kind === 'invite') { this.pendingInvite = { peer: m.peer, name: String(d.name || 'PLAYER').slice(0, 12) }; toast('TRADE REQUEST', `${this.pendingInvite.name} - SOCIAL > TRADE`, 'item_coin', 'whisper'); return; }
    if (m.peer !== this.partner) return;
    if (d.kind === 'accept') { toast('TRADE', `${this.partnerName} opened the trade`, 'item_coin', 'confirm'); }
    if (d.kind === 'offer') { const o = d.offer || {}; this.them = { gold: Math.max(0, Math.floor(+o.gold) || 0), items: (o.items || []).slice(0, 6), stacks: (o.stacks || []).map(cleanStack).filter(Boolean).slice(0, 6) }; this.theirLock = this.theirOk = false; this.myLock = this.myOk = false; }
    if (d.kind === 'lock') this.theirLock = true;
    if (d.kind === 'confirm') { this.theirOk = true; this.tryFinish(); }
    if (d.kind === 'cancel') { toast('TRADE', `${this.partnerName} cancelled`, 'item_coin', 'error'); this.close(); }
  },
  tryFinish() {
    if (!(this.myOk && this.theirOk && this.myLock && this.theirLock)) return;
    // validate my side still holds what I offered
    if (G.gold < this.me.gold || this.me.items.some(it => !G.bag.includes(it)) || this.me.stacks.some(s => (G.inv[s.id] || 0) < s.n)) { toast('TRADE', 'Your offer changed - cancelled', 'item_coin', 'error'); this.send('cancel'); return this.close(); }
    const inItems = this.them.items.map(cleanItem).filter(Boolean);
    if (G.bag.length - this.me.items.length + inItems.length > BAG_MAX) { toast('TRADE', 'Bag full - cancelled', 'item_coin', 'error'); this.send('cancel'); return this.close(); }
    G.gold -= this.me.gold; for (const it of this.me.items) G.bag.splice(G.bag.indexOf(it), 1); for (const s of this.me.stacks) for (let i = 0; i < s.n; i++) takeItem(s.id);
    G.gold += this.them.gold; inItems.forEach(addGear); for (const s of this.them.stacks) addItem(s.id, s.n);
    G.stats.trades = (G.stats.trades || 0) + 1; saveGame(); SFX.buy();
    toast('TRADE COMPLETE', `with ${this.partnerName}`, 'item_coin', 'achievement');
    this.close();
  },
  close() { this.partner = null; this.reset(); const s = scenes.find(x => x instanceof TradeScene); if (s) removeScene(s); },
};
// hook the trade topic onto whatever room NET uses (page room or realm server)
setInterval(() => { if (NET.room && Trade.hookedRoom !== NET.room) { Trade.hookedRoom = NET.room; try { NET.room.on('trade', m => Trade.onMsg(m), () => {}); } catch (e) {} } }, 1000);

class TradeScene {
  constructor() { this.opaque = true; this.i = 0; }
  opts() { return ['ADD ITEM', 'ADD STACK', 'ADD GOLD', 'CLEAR MY OFFER', Trade.myLock ? (Trade.myOk ? 'WAITING...' : 'CONFIRM TRADE') : 'LOCK OFFER', 'CANCEL TRADE']; }
  update() {
    if (!Trade.partner) { removeScene(this); return; }
    const O = this.opts();
    if (nav('up')) { this.i = (this.i + O.length - 1) % O.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % O.length; SFX.cursor(); }
    if (P('b')) { Trade.send('cancel'); Trade.close(); SFX.back(); return; }
    if (!P('a')) return;
    const o = O[this.i];
    if (Trade.myLock && !/CONFIRM|CANCEL|WAITING/.test(o)) { SFX.error(); return say('Your offer is locked. Cancel to change it.'); }
    if (o === 'ADD ITEM') { const pool = G.bag.filter(it => !Trade.me.items.includes(it) && !it.fav && !it.heirloom).slice(0, 8); if (!pool.length || Trade.me.items.length >= 6) return say('Nothing more to add.'); choose(pool.map(it => it.name.slice(0, 18)), k => { if (k >= 0) { Trade.me.items.push(pool[k]); Trade.sync(); } }); }
    if (o === 'ADD STACK') { const pool = Object.keys(G.inv).filter(k => G.inv[k] > 0 && cleanStack({ id: k, n: 1 }) && !Trade.me.stacks.some(s => s.id === k)).slice(0, 8); if (!pool.length || Trade.me.stacks.length >= 6) return say('Nothing more to add.'); choose(pool.map(k => `${ITEMS[k].name.slice(0, 14)} x${G.inv[k]}`), k => { if (k >= 0) { Trade.me.stacks.push({ id: pool[k], n: G.inv[pool[k]] }); Trade.sync(); } }); }
    if (o === 'ADD GOLD') { const steps = [10, 100, 1000, 10000, 100000].filter(g => g <= G.gold); if (!steps.length) return say('No gold to offer.'); choose(steps.map(g => `+${fmt(g)} G`).concat(['ALL GOLD']), k => { if (k < 0) return; Trade.me.gold = Math.min(G.gold, k === steps.length ? G.gold : Trade.me.gold + steps[k]); Trade.sync(); }); }
    if (o === 'CLEAR MY OFFER') { Trade.me = { gold: 0, items: [], stacks: [] }; Trade.sync(); }
    if (o === 'LOCK OFFER') { Trade.myLock = true; Trade.send('lock'); SFX.confirm(); }
    if (o === 'CONFIRM TRADE') { if (!Trade.theirLock) return say(`${Trade.partnerName} has not locked yet.`); Trade.myOk = true; Trade.send('confirm'); Trade.tryFinish(); }
    if (o === 'CANCEL TRADE') { Trade.send('cancel'); Trade.close(); SFX.back(); }
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3);
    textC(`TRADE WITH ${Trade.partnerName}`.slice(0, 26), 80, 1, 'gold');
    const side = (x, o, title, lock, ok) => {
      frame(x, 13, 78, 74); text(title.slice(0, 8), x + 3, 16, 3); textR(ok ? 'OK' : lock ? 'LOCK' : '...', x + 75, 16, ok ? 'green' : lock ? 'gold' : 1);
      text(`${fmt(o.gold)} G`, x + 3, 26, 'gold');
      const rows = o.items.map(it => it.name).concat(o.stacks.map(s => `${(ITEMS[s.id] || { name: s.id }).name} x${s.n}`));
      rows.slice(0, 5).forEach((r, i) => text(String(r).slice(0, 12), x + 3, 36 + i * 9, 2));
    };
    side(1, Trade.me, 'YOU', Trade.myLock, Trade.myOk); side(81, Trade.them, Trade.partnerName, Trade.theirLock, Trade.theirOk);
    this.opts().forEach((o, i) => { const y = 90 + i * 9; if (i === this.i) fill(1, y - 1, 158, 9, 1); text(o, 6, y, i === this.i ? 'gold' : 3); });
  }
}
// SOCIAL > TRADE: accept a pending invite or invite someone who is online
function tradeMenu() {
  if (NET.offline || !NET.room) return say('Direct trade needs online play with other players. Use the Trading Hub offline.');
  const inv = Trade.pendingInvite;
  const peers = (NET.peers || []).slice(0, 8);
  const opts = (inv ? [`ACCEPT ${inv.name}`] : []).concat(peers.map(p => `INVITE ${clean((p.presence || {}).n || 'HERO').slice(0, 10)}`));
  if (!opts.length) return say('Nobody is online with you right now.');
  choose(opts, k => {
    if (k < 0) return;
    if (inv && k === 0) { Trade.pendingInvite = null; Trade.partner = inv.peer; Trade.partnerName = inv.name; Trade.reset(); Trade.send('accept'); push(new TradeScene()); return; }
    const p = peers[k - (inv ? 1 : 0)]; Trade.invite(p.peer, clean((p.presence || {}).n || 'HERO').slice(0, 12));
  }, 'DIRECT TRADE: swap items and gold with another player. No fees.');
}
