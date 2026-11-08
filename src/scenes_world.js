// LOST KINGDOM OF SHADOWBANE CHRONICLES scenes: boot logo, title, save slots, prologue, character creation, the field
// (zones, instances, tower), NPC services, fishing, world map, trials, level up, credits.
'use strict';

// ================================================================ BOOT (Arkansas - Io engine identity and game build)
class Boot {
  constructor(progress) { this.opaque = true; this.t = 0; this.prog = progress || (() => 1); }
  update() {
    this.t++;
    if (this.t === 72) play(arp('q', [84, 96], 0.09, 0.08));
    const ready = Number(this.prog()) >= 1;
    const skip = this.t > 30 && (P('a') || P('start'));
    if ((this.t > 150 && ready) || skip || this.t > 600) { fadeTo(() => reset(new Title())); this.t = -9999; }
  }
  draw() {
    fill(0, 0, W, H, '#dce8d1');
    const pulse = 0.7 + 0.3 * Math.sin(this.t / 12);
    ctx.save(); ctx.globalAlpha = pulse; ctx.shadowColor = '#285da8'; ctx.shadowBlur = 8;
    ctx.strokeStyle = '#285da8'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(80, 7); ctx.lineTo(94, 15); ctx.lineTo(94, 29); ctx.lineTo(80, 37); ctx.lineTo(66, 29); ctx.lineTo(66, 15); ctx.closePath(); ctx.stroke();
    ctx.shadowColor = '#78a85b'; ctx.shadowBlur = 5; ctx.strokeStyle = '#78a85b'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(73, 29); ctx.lineTo(80, 14); ctx.lineTo(87, 29); ctx.moveTo(76, 24); ctx.lineTo(84, 24); ctx.stroke();
    ctx.fillStyle = '#f8f8ef'; ctx.beginPath(); ctx.arc(86, 17, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    textC(BUILD.engine, 80, 42, 'gold', 1);
    textC('GAME ENGINE', 80, 53, 2);
    textC(`VERSION ${BUILD.engineVersion}`, 80, 65, 3);
    textC(`BUILD ${BUILD.engineBuildNumber}`, 80, 75, 2);
    textC(`ID ${BUILD.engineBuildId}`, 80, 85, 1);
    fill(27, 94, 106, 1, 2);
    textC(BUILD.gameLines[0], 80, 97, 2); textC(BUILD.gameLines[1], 80, 106, 0);
    if (this.t > 45 && this.prog() >= 1) textC('PRESENTS', 80, 120, 2);
    if (this.prog() < 1) { bar(40, 120, 80, 4, this.prog(), 1); textC(this.t > 30 ? 'PRESS ENTER TO SKIP' : 'LOADING', 80, 127, 1); }
    textC(`GAME v${BUILD.version} ${BUILD.build}`, 80, 137, 1);
  }
}

// ================================================================ TITLE
// ================================================================ ONLINE / OFFLINE + the built-in realm server
class MultiplayerScene {
  constructor() { this.opaque = true; this.i = 0; this.t = 0; }
  heroReady() { if (G) return true; const l = lastSlot(); if (l >= 0) { loadSlot(l); return true; } return false; }
  opts() {
    const on = !NET.offline, o = [{ k: 'mode', label: `MODE: ${on ? 'ONLINE' : 'OFFLINE'}` }];
    if (on) {
      o.push({ k: 'host', label: NET.server ? `STOP HOSTING (${NET.partyChars().length} JOINED)` : 'HOST A REALM' });
      for (const sv of NET.servers().slice(0, 4)) o.push({ k: 'join', sv, label: `JOIN ${sv.name} (${sv.players})`.slice(0, 24) });
      if (NET.hostOf) o.push({ k: 'leave', label: 'LEAVE REALM' });
    }
    o.push({ k: 'play', label: G ? 'PLAY' : 'PLAY (LOAD HERO)' }, { k: 'back', label: 'BACK' });
    return o;
  }
  update() {
    this.t++; const o = this.opts();
    if (nav('up')) { this.i = (this.i + o.length - 1) % o.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % o.length; SFX.cursor(); }
    this.i = Math.min(this.i, o.length - 1);
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const c = o[this.i];
    if (c.k === 'mode') { NET.setMode(NET.offline ? 'online' : 'offline'); SFX.toggle(); }
    if (c.k === 'host') { if (NET.server) { NET.stopServer(); SFX.close(); } else if (!this.heroReady()) say('Create a hero first (NEW GAME).'); else NET.hostServer(`${G.name}'S REALM`); }
    if (c.k === 'join') { if (!this.heroReady()) return say('Create a hero first (NEW GAME).'); NET.joinServer(c.sv.peer); }
    if (c.k === 'leave') { NET.hostOf = null; SFX.close(); }
    if (c.k === 'play') { if (!this.heroReady()) return say('Create a hero first (NEW GAME).'); fadeTo(() => { scenes.length = 0; enterWorld(); }); }
    if (c.k === 'back') { SFX.back(); removeScene(this); }
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 11, 3); textC('MULTIPLAYER', 80, 1, 0);
    const on = !NET.offline, live = NET.isOnline();
    frame(4, 14, 152, 34);
    fill(10, 20, 8, 8, live ? 'green' : on ? 'gold' : 'red');
    text(live ? 'ONLINE' : on ? 'CONNECTING / NO LINK' : 'OFFLINE', 22, 20, live ? 'green' : on ? 'gold' : 'red');
    text(live ? `${NET.peers.length} PLAYERS HERE  ${NET.servers().length} REALMS` : on ? (NET.status === 'SERVER: LOG IN' ? 'LOG IN: TITLE > ACCOUNT' : 'OPEN THE SHARED PAGE') : 'SOLO + NPC REALM ONLY', 10, 33, 2);
    this.opts().forEach((c, j) => { const y = 54 + j * 11; if (j === this.i) fill(4, y - 1, 152, 11, 1); text(c.label, 8, y, c.k === 'mode' && j !== this.i ? 'gold' : 3); });
    text(on ? 'HOST: friends join your fights.' : 'Nothing leaves your device.', 4, 134, 1);
  }
}

function titleExtras() {
  choose(['LEADERBOARD', 'WORLD ATLAS', 'CONTROLS', 'ABOUT', 'BACK'], k => {
    if (k === 0) NET.leaderboard().then(r => say(r && r.length ? ['LEADERBOARD'].concat(r.slice(0, 8).map((h, i) => `${i + 1}. ${String(h.name).slice(0, 10)} L${h.lvl}`)) : ['No leaderboard yet.', 'Play online to post your hero.'])).catch(() => say('Leaderboard unavailable offline.'));
    if (k === 1) { if (typeof openAtlas === 'function') openAtlas(); else say('Open dist/atlas.html for the world atlas.'); }
    if (k === 2) say(['ARROWS move  Z/A confirm  X/B back', 'ENTER menu  SHIFT map/auto-battle', 'M atlas  F full screen  C chat', 'F9 debug  F3 profiler']);
    if (k === 3) say([`${BUILD.game}`, `Version ${BUILD.version} ${BUILD.build}`, `Engine ${BUILD.engine} ${BUILD.engineVersion}`, `By ${BUILD.studio}`]);
  }, 'EXTRAS');
}
class Title {
  constructor() { this.opaque = true; this.t = 0; this.i = 0; this.top = 0; }
  enter() { try { Music.play('title'); } catch (error) { console.warn('Title music unavailable; continuing without audio.', error); } }
  resume() { try { Music.play('title'); } catch (error) { console.warn('Title music unavailable; continuing without audio.', error); } }
  opts() { const o = ['NEW GAME']; if (lastSlot() >= 0) o.push('CONTINUE'); o.push('LOAD GAME', 'OPTIONS', 'CREDITS', 'QUIT'); return o; }
  update() {
    this.t++;
    const o = this.opts();
    if (nav('up')) { this.i = (this.i + o.length - 1) % o.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % o.length; SFX.cursor(); }
    this.i = Math.min(this.i, o.length - 1);
    if (P('b')) { SFX.back(); return; }
    if (!(P('a') || P('start'))) return;
    SFX.select();
    const c = o[this.i];
    if (c === 'CONTINUE') { loadSlot(lastSlot()); fadeTo(() => enterWorld()); }
    if (c === 'NEW GAME') push(new SlotPicker('new'));
    if (c === 'LOAD GAME') push(new SlotPicker('load'));
    if (c === 'OPTIONS') push(new SettingsScene());
    if (c === 'CREDITS') push(new Credits());
    if (c === 'QUIT') choose(['NO', 'YES, QUIT'], k => {
      if (k === 1) say(['Thanks for exploring Aelmoor.', 'You may close this browser tab.']);
    }, 'Leave GB Quest?');
  }
  draw() {
    // Aelmoor title scene: deep violet moonlight, layered mountains and a warm
    // lantern-lit citadel, rendered at the native 160x144 canvas resolution.
    ctx.save();
    const packBackdrop = typeof artOn === 'function' && artOn() && IMG.ap_scene_wilderness
      ? spr('ap_scene_wilderness', W, H, { clean: true }) : null;
    if (packBackdrop) {
      blit(packBackdrop, 0, 0);
      fill(0, 0, W, H, 'rgba(8,10,18,0.18)');
    } else {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#09052a'); sky.addColorStop(.48, '#27105b'); sky.addColorStop(1, '#07182b');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const moon = ctx.createRadialGradient(132, 24, 2, 132, 24, 30);
  moon.addColorStop(0, 'rgba(255,245,255,.98)'); moon.addColorStop(.42, 'rgba(216,162,255,.72)'); moon.addColorStop(1, 'rgba(118,36,190,0)');
  ctx.fillStyle = moon; ctx.fillRect(98, 0, 62, 58);
  ctx.fillStyle = '#f7e7ff'; ctx.beginPath(); ctx.arc(132, 23, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d5b2eb'; [[126,17,3,2],[135,20,4,3],[129,28,5,2],[138,29,2,2]].forEach(([x,y,w,h]) => ctx.fillRect(x,y,w,h));
    for (let i = 0; i < 42; i++) { const x = (i * 37 + 11) % W, y = (i * 19 + 5) % 76; ctx.globalAlpha = .35 + ((i + (this.t >> 3)) % 4) * .13; ctx.fillStyle = i % 4 ? '#e8f0dc' : '#fff0a8'; ctx.fillRect(x,y,i%9===0?2:1,1); }
    ctx.globalAlpha = 1;
    const ridge = (pts, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0,H); pts.forEach(([x,y])=>ctx.lineTo(x,y)); ctx.lineTo(W,H); ctx.closePath(); ctx.fill(); };
    ridge([[0,65],[17,43],[30,65],[48,39],[66,65],[84,48],[105,70],[126,42],[146,64],[160,51]], '#527b70');
    ridge([[0,88],[20,67],[40,83],[61,60],[83,87],[106,65],[128,84],[148,62],[160,75]], '#355c50');
    // Castle towers and warm windows.
    ctx.fillStyle = '#294a43'; ctx.fillRect(111,58,42,47); ctx.fillRect(119,48,8,57); ctx.fillRect(137,43,7,62); ctx.fillRect(106,68,8,37);
    ctx.beginPath(); ctx.moveTo(117,49); ctx.lineTo(123,37); ctx.lineTo(129,49); ctx.moveTo(135,44); ctx.lineTo(140,31); ctx.lineTo(146,44); ctx.fill();
    ctx.fillStyle = '#f4d56a'; [[115,75],[123,67],[133,78],[141,62],[121,88],[145,90]].forEach(([x,y],i)=>{ if ((this.t+i*9)%90<82) ctx.fillRect(x,y,2,3); });
    // Foreground cliff path and river glints.
    ridge([[0,111],[20,101],[40,108],[59,95],[79,108],[101,98],[121,110],[143,97],[160,105]], '#294a43');
    ctx.strokeStyle = '#5c9fc4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(104,144); ctx.quadraticCurveTo(91,126,108,116); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,245,255,.8)'; ctx.beginPath(); ctx.moveTo(110,141); ctx.lineTo(105,132); ctx.stroke();
    // Pixel-art canopy framing the upper-left corner.
    ctx.fillStyle = '#315d45'; ctx.fillRect(0,0,13,46); ctx.fillRect(8,0,24,7); ctx.fillRect(20,4,18,7);
    for (let i=0;i<16;i++){ const x=(i*13)%43, y=(i*7)%22; ctx.fillStyle=i%3===0?'#a3a34a':i%2?'#587b42':'#315d45'; ctx.fillRect(x,y,5,4); }
    }
    // Small adventurer silhouettes, using the existing class portraits.
    const bob = Math.round(Math.sin(this.t/12));
    const hero = classPortrait('warden'), mage = classPortrait('arcanist');
    if (hero) { const p=sprFit(hero,34); blit(p,28,103-p.height+bob); }
    if (mage) { const p=sprFit(mage,29); blit(p,5,113-p.height-bob); }
    // Ornate title plaque and subtitle.
  fill(17,3,126,39,'rgba(12,7,29,.9)'); frame(3,2,154,43,1);
  textC('GB QUEST',80,5,'#ffd35a'); textC('LOST KINGDOM',80,14,'#fff0b0');
  textC('OF SHADOWBANE',80,21,'#fff0b0'); textC('CHRONICLES',80,28,'#fff0b0'); textC('LANTERNS OF AELMOOR',80,36,'#ffd35a');
  // Menu plaque; keep every command visible and selectable.
  const o=this.opts(), rowH=9, h=o.length*rowH+7, y0=57;
  fill(48,y0,64,h,'rgba(8,5,20,.92)'); frame(48,y0,64,h,1);
  o.forEach((label,j)=>{ const y=y0+4+j*rowH, icon=`au_menu_icons_${String(j).padStart(3,'0')}`; if(j===this.i){ fill(52,y-1,56,8,'#8e2ed1'); frame(51,y-2,58,9,1); text('>',54,y,'#ffd35a'); } if (IMG[icon]) blit(sprFit(icon, 7), 57, y - 1); textC(label,86,y,j===this.i?'#fff0b0':3); });
  // Footer and version.
  fill(0,134,W,10,'#12082d'); text('v'+BUILD.version,3,136,'#ffd35a');
  textC('GB QUEST STUDIO',80,136,'#fff0b0');
    ctx.restore();
  }
}
// ================================================================ SAVE SLOTS
class SlotPicker {
  constructor(mode) { this.opaque = true; this.mode = mode; this.i = 0; }
  update() {
    if (nav('up')) { this.i = (this.i + 2) % 3; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % 3; SFX.cursor(); }
    if (P('b')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const info = slotInfo(this.i);
    if (this.mode === 'load') {
      if (!info) { SFX.error(); return; }
      choose(['LOAD', 'DELETE', 'CANCEL'], k => {
        if (k === 0) { loadSlot(this.i); fadeTo(() => { scenes.length = 0; enterWorld(); }); }
        if (k === 1) choose(['NO', 'YES, DELETE'], y => { if (y === 1) { store.del(SLOT_KEYS[this.i]); SFX.error(); } }, `Delete ${info.name}? This cannot be undone.`);
      }, `SLOT ${this.i + 1}: ${info.name} LV${info.lvl}`);
    } else {
      const go = () => fadeTo(() => { scenes.length = 0; push(new Prologue(() => push(new CharCreate(this.i)))); });
      if (info) choose(['NO', 'OVERWRITE'], y => { if (y === 1) go(); }, `Slot ${this.i + 1} has ${info.name}. Overwrite?`); else go();
    }
  }
  draw() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#b8d8a0'); bg.addColorStop(.62, '#dce8d1'); bg.addColorStop(1, '#a9c4a0');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (let n = 0; n < 22; n++) {
      ctx.globalAlpha = .28 + (n % 3) * .12;
      fill((n * 31 + 7) % W, (n * 17 + 4) % 130, n % 7 === 0 ? 2 : 1, 1, n % 4 ? '#edf4e5' : '#fff0a8');
    }
    ctx.globalAlpha = 1;
    frame(2, 2, 156, 139, 1);
    fill(5, 5, 150, 17, '#285da8');
    textC(this.mode === 'load' ? 'LOAD YOUR JOURNEY' : 'BEGIN A NEW JOURNEY', 80, 9, 'gold');
    textC('CHOOSE A SAVE SLOT', 80, 17, 2);
    for (let i = 0; i < 3; i++) {
      const y = 27 + i * 32, info = slotInfo(i), selected = i === this.i;
      fill(7, y, 146, 28, selected ? '#dce8f7' : '#f8f8ef');
      frame(6, y - 1, 148, 30, selected ? 1 : 0);
      if (selected) { fill(8, y + 3, 2, 20, '#285da8'); text('>', 11, y + 3, '#285da8'); }
      text(`SLOT 0${i + 1}`, 17, y + 3, selected ? '#285da8' : 3);
      if (info) {
        const portrait = info.portrait && IMG[info.portrait] ? info.portrait : classPortrait(info.cls);
        if (portrait) blit(sprFit(portrait, 20), 126, y + 4);
        text(String(info.name || 'ADVENTURER').slice(0, 15), 17, y + 12, 0);
        text(`LV${info.lvl}  ${CLASSES[info.cls].name}`, 17, y + 20, 2);
        textR(String(info.zone || 'UNKNOWN').slice(0, 12), 119, y + 20, 2);
      } else {
        text('- EMPTY SLOT -', 17, y + 14, 1);
        text(this.mode === 'load' ? 'NO DATA TO LOAD' : 'READY FOR A NEW HERO', 17, y + 21, 2);
      }
    }
    fill(8, 126, 144, 10, '#285da8');
    text('UP/DOWN: CHOOSE   A: CONFIRM', 11, 128, 'white');
    text('B: BACK', 11, 136, 'white');
  }
}

// ================================================================ PROLOGUE
class Prologue {
  constructor(cb, story = null) {
    this.opaque = true; this.cb = cb; this.i = 0; this.c = 0; this.t = 0;
    this.expansion = story !== null;
    this.story = story || { name: BUILD.gameShort, subtitle: 'THE LANTERN PACT', scenes: PROLOGUE.map((line, index) => ({
      title: ['THE EMBER CODEX', 'A THOUSAND LIGHTS', 'THE LANTERN PACT', 'THE SUNLESS EVENING', 'THE SHADOW KING', 'TWELVE LOST PAGES', 'A LIGHT IN ELDERWOOD', 'THE ROAD BEGINS'][index],
      text: line,
      art: ['item_spellbook', 'px_waypoint', 'px_symbol', 'px_skull', 'enemy_goblinking', 'px_rune', 'c_warden_0', 'elder_0'][index],
    })) };
    this.scenes = this.story.scenes;
    this.sceneStart = 0;
  }
  enter() { Music.play('prologue'); }
  update() {
    this.t++;
    const scene = this.scenes[this.i];
    if (!scene) { this.done(); return; }
    const L = scene.text;
    if (P('start')) { this.done(); return; }
    if (P('b')) { this.done(); return; }
    if (this.c < L.length) { this.c += 0.7; if (P('a')) this.c = L.length; return; }
    if (P('a')) { SFX.page(); this.i++; this.c = 0; this.sceneStart = this.t; if (this.i >= this.scenes.length) this.done(); }
  }
  done() { if (this.over) return; this.over = true; fadeTo(() => { removeScene(this); this.cb(); }); }
  draw() {
    const scene = this.scenes[this.i] || this.scenes[this.scenes.length - 1];
    const hue = this.expansion ? (this.story.n * 29 + 180) % 360 : 224;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, `hsl(${hue} 40% 10%)`); sky.addColorStop(0.68, `hsl(${(hue + 36) % 360} 45% 28%)`); sky.addColorStop(1, '#171421');
    fill(0, 0, W, H, 0); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const phase = this.t - this.sceneStart;
    for (let star = 0; star < 28; star++) {
      ctx.globalAlpha = 0.45 + ((star + (this.t >> 3)) % 4) * 0.12;
      fill((star * 47 + 13) % W, (star * 23 + 5) % 74, star % 6 === 0 ? 2 : 1, 1, 'white');
    }
    ctx.globalAlpha = 1;
    const ridge = (points, color) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, 105);
      points.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(W, 105); ctx.fill();
    };
    ridge([[0, 75], [20, 54], [38, 72], [61, 43], [83, 73], [104, 51], [126, 71], [147, 48], [160, 62]], `hsl(${hue} 25% 24%)`);
    ridge([[0, 91], [18, 74], [42, 87], [62, 65], [84, 88], [111, 69], [132, 87], [151, 68], [160, 77]], `hsl(${hue} 28% 16%)`);
    const flare = ctx.createRadialGradient(80, 61, 2, 80, 61, 38);
    flare.addColorStop(0, this.expansion ? `hsla(${hue}, 90%, 65%, .4)` : 'rgba(255,172,90,.34)');
    flare.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flare; ctx.fillRect(34, 17, 92, 88);
    blit(sprFit(scene.art || 'px_waypoint', 48), 56 + Math.round(Math.sin(this.t / 21) * 3), 34 + Math.round(Math.sin(this.t / 15) * 2));
    fill(0, 0, W, 17, 0); fill(0, 17, W, 1, 2);
    textC(this.expansion ? `EXPANSION ${this.story.n}` : 'AELMOOR - THE BEGINNING', 80, 4, 'gold');
    textC(scene.title || this.story.name, 80, 79, 'gold');
    frame(3, 91, 154, 43);
    const lines = wrap(scene.text, 24).slice(0, 3), shown = this.c;
    text(lines.join('\n').slice(0, Math.floor(shown)), 9, 97, 0);
    textR('A: NEXT   B/START: SKIP', 156, 137, 1);
    textC(`${this.i + 1}/${this.scenes.length}`, 80, 139, 1);
  }
}

class StoryLibrary extends ListScene {
  constructor() { super(9); }
  items() { return ['AELMOOR PROLOGUE', ...BUILD.expansions]; }
  update() {
    this.navList();
    if (P('b') || P('start')) { SFX.back(); removeScene(this); return; }
    if (!P('a')) return;
    const index = this.i;
    const story = index === 0 ? null : (() => {
      const expansion = EXPANSION_STORIES[index - 1];
      return { ...expansion, scenes: [
        { title: expansion.name.toUpperCase(), text: `${expansion.name}: ${expansion.subtitle}.`, art: expansion.art },
        { title: 'THE THREAT', text: expansion.threat, art: expansion.art },
        { title: 'YOUR JOURNEY', text: expansion.hook, art: expansion.art },
      ] };
    })();
    push(new Prologue(() => Music.play('title'), story));
  }
  draw() {
    fill(0, 0, W, H, 0); hdr(); textC('STORY TRAILERS', 80, 14, 'gold');
    const rows = this.items();
    rows.slice(this.top, this.top + this.rows).forEach((name, offset) => {
      const index = this.top + offset, y = 31 + offset * 11;
      if (index === this.i) fill(4, y - 1, 150, 10, 3);
      text(name.slice(0, 23).toUpperCase(), 8, y, index === this.i ? 'gold' : 2);
    });
    this.scrollbar(156, 30, 101);
    text('A: WATCH   B: BACK', 7, 136, 1);
  }
}

// ================================================================ CHARACTER CREATION
// 8 steps: species, class, background, ability scores (standard array / point buy / 4d6), looks,
// name, play mode + difficulty, review. Tabs on top show progress; START = next, B = back,
// SELECT = randomise this step (on the review: randomise everything).
const CC_STEPS = ['SPECIES', 'CLASS', 'BACKGROUND', 'ABILITIES', 'LOOKS', 'NAME', 'MODE', 'REVIEW'];
const CC_METHODS = ['STANDARD ARRAY', 'POINT BUY', 'ROLL 4D6'];
const CC_LOOKS = ['warden', 'berserker', 'vanguard', 'strider', 'shade', 'ascetic', 'arcanist', 'wildblood', 'pactbound', 'cantor', 'chaplain', 'verdant', 'guard', 'merchant', 'elder', 'sage', 'villager0', 'villager1', 'villager2', 'villager3'];
const ABIL6 = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const CC_KEYS = [[...'ABCDEFGH'], [...'IJKLMNOP'], [...'QRSTUVWX'], [...'YZ-'], ['?', '<', '>']];
class CharCreate {
  constructor(slot) {
    this.opaque = true; this.slot = slot; this.step = 0; this.done = 0; this.t = 0;
    this.cur = [0, 0, 0, 1, 0, 0, 0, 7];               // cursor per step
    this.pick = { species: 'hearthkin', cls: 'warden', bg: 'soldier', name: '', mode: 'solo', diff: 2, look: null, portrait: null };
    this.method = 0; this.sel = -1; this.rolls = null; this.li = 0;
    this.assign(STANDARD_ARRAY);
  }
  enter() { Music.play('character'); }
  // ---------------------------------------------------------------- helpers
  assign(values) { const v = values.slice().sort((a, b) => b - a), pr = abilityPriority(this.pick.cls); this.scores = {}; pr.forEach((a, i) => this.scores[a] = v[i]); }
  roll4d6() { return Array.from({ length: 6 }, () => { const d = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * 6)).sort((a, b) => a - b); return d[1] + d[2] + d[3]; }); }
  pointsLeft() { return POINT_BUY.budget - ABIL6.reduce((s, a) => s + POINT_BUY.cost[this.scores[a]], 0); }
  setMethod(m) {
    this.method = m; this.sel = -1;
    if (m === 2) { this.rolls = this.roll4d6(); this.assign(this.rolls); } else this.assign(STANDARD_ARRAY);
  }
  portraits() { const p = this.pick, o = [classPortrait(p.cls), racePortrait(p.species, 0), racePortrait(p.species, 1)].filter((x, i, a) => x && IMG[x] && a.indexOf(x) === i); return o.length ? o : [null]; }
  preview() { const p = this.pick; return newCharacter({ ...p, name: p.name || 'HERO', scores: this.scores }); }
  randomName() { const pool = NAME_POOLS[this.pick.species] || NAME_POOLS.hearthkin; let n; do n = pool[Math.floor(Math.random() * pool.length)]; while (n === this.pick.name && pool.length > 1); return n; }
  go(s) { this.step = Math.max(0, Math.min(7, s)); this.done = Math.max(this.done, this.step); this.sel = -1; SFX.page(); }
  next() { if (this.step === 5 && !this.pick.name) { SFX.error(); toast('NAME', 'YOUR HERO NEEDS A NAME', 'px_rune', 'error'); return; } if (this.step === 7) return this.finish(); SFX.select(); this.go(this.step + 1); }
  randomStep(s) {
    const p = this.pick, rnd = a => a[Math.floor(Math.random() * a.length)];
    if (s === 0) { p.species = rnd(Object.keys(SPECIES)); this.cur[0] = Object.keys(SPECIES).indexOf(p.species); p.portrait = null; }
    if (s === 1) { p.cls = rnd(CLASS_ORDER); this.cur[1] = CLASS_ORDER.indexOf(p.cls); p.look = null; p.portrait = null; this.setMethod(this.method); }
    if (s === 2) { p.bg = rnd(Object.keys(BACKGROUNDS)); this.cur[2] = Object.keys(BACKGROUNDS).indexOf(p.bg); }
    if (s === 3) this.setMethod(2);
    if (s === 4) { p.look = rnd(CC_LOOKS); p.portrait = rnd(this.portraits()); }
    if (s === 5) p.name = this.randomName();
    if (s === 6) { p.mode = 'solo'; p.diff = 1 + Math.floor(Math.random() * 4); }
  }
  // ---------------------------------------------------------------- input
  update() {
    this.t++;
    const p = this.pick, s = this.step;
    if (P('select')) { if (s === 7) { for (let k = 0; k < 7; k++) this.randomStep(k); SFX.levelup(); } else { this.randomStep(s); SFX.toggle(); } return; }
    if (s === 5) return this.updateName();
    if (P('start')) { this.next(); return; }
    if (P('b')) {
      if (s === 3 && this.sel >= 0) { this.sel = -1; SFX.back(); return; }
      if (s === 0) { choose(['KEEP CREATING', 'BACK TO TITLE'], k => { if (k === 1) fadeTo(() => { scenes.length = 0; push(new Title()); }); }, 'Leave character creation?'); return; }
      SFX.back(); this.go(s - 1); return;
    }
    const up = nav('up'), dn = nav('down'), lf = nav('left'), rt = nav('right'), a = P('a');
    const list = (n, i) => { const c = this.cur[i]; const v = up ? (c + n - 1) % n : dn ? (c + 1) % n : c; if (v !== c) SFX.cursor(); this.cur[i] = v; return v; };
    if (s === 0) { const L = Object.keys(SPECIES), i = list(L.length, 0); if (p.species !== L[i]) { p.species = L[i]; p.portrait = null; } if (a) this.next(); }
    if (s === 1) {
      let i = this.cur[1]; if (lf) i = (i + CLASS_ORDER.length - 1) % CLASS_ORDER.length; if (rt) i = (i + 1) % CLASS_ORDER.length; if (up) i = (i + CLASS_ORDER.length - CLASS_COLS) % CLASS_ORDER.length; if (dn) i = (i + CLASS_COLS) % CLASS_ORDER.length;
      if (i !== this.cur[1]) { SFX.cursor(); this.cur[1] = i; p.cls = CLASS_ORDER[i]; p.look = null; p.portrait = null; this.setMethod(this.method === 2 ? 0 : this.method); }
      if (a) this.next();
    }
    if (s === 2) { const L = Object.keys(BACKGROUNDS), i = list(L.length, 2); p.bg = L[i]; if (a) this.next(); }
    if (s === 3) this.updateAbilities(up, dn, lf, rt, a);
    if (s === 4) {
      const r = list(3, 4);
      if (r === 0 && (lf || rt)) { const k = CC_LOOKS.indexOf(heroLook(p)); p.look = CC_LOOKS[(k + (rt ? 1 : CC_LOOKS.length - 1)) % CC_LOOKS.length]; SFX.cursor(); }
      if (r === 1 && (lf || rt)) { const o = this.portraits(), k = Math.max(0, o.indexOf(p.portrait || o[0])); p.portrait = o[(k + (rt ? 1 : o.length - 1)) % o.length]; SFX.cursor(); }
      if (a) { if (r === 2) this.next(); else SFX.cursor(); }
    }
    if (s === 6) {
      const r = list(3, 6);
      if (r === 0 && (lf || rt)) { const k = PLAY_MODES.findIndex(m => m.id === p.mode); p.mode = PLAY_MODES[(k + (rt ? 1 : PLAY_MODES.length - 1)) % PLAY_MODES.length].id; SFX.cursor(); }
      if (r === 1 && (lf || rt)) { p.diff = Math.max(1, Math.min(DIFFICULTY.length, p.diff + (rt ? 1 : -1))); SFX.cursor(); }
      if (a) { if (r === 2) this.next(); else SFX.cursor(); }
    }
    if (s === 7) { const r = list(8, 7); if (a) { if (r === 7) this.finish(); else { SFX.select(); this.go(r === 6 ? 6 : r); } } }
  }
  updateAbilities(up, dn, lf, rt, a) {
    // rows: 0 method, 1-6 abilities, 7 auto/reset, 8 reroll (roll only), last = continue
    const rows = this.method === 2 ? 10 : 9, last = rows - 1;
    let r = this.cur[3]; if (up) r = (r + rows - 1) % rows; if (dn) r = (r + 1) % rows; if (r !== this.cur[3]) SFX.cursor(); this.cur[3] = r;
    if (r === 0 && (lf || rt)) { this.setMethod((this.method + (rt ? 1 : 2)) % 3); SFX.toggle(); return; }
    if (r >= 1 && r <= 6) {
      const ab = ABIL6[r - 1];
      if (this.method === 1 && (lf || rt)) {
        const v = this.scores[ab] + (rt ? 1 : -1);
        if (v < POINT_BUY.min || v > POINT_BUY.max) { SFX.error(); return; }
        const old = this.scores[ab]; this.scores[ab] = v; if (this.pointsLeft() < 0) { this.scores[ab] = old; SFX.error(); return; } SFX.cursor(); return;
      }
      if (this.method !== 1 && a) {
        if (this.sel < 0) { this.sel = r - 1; SFX.select(); }
        else { const b = ABIL6[this.sel]; [this.scores[ab], this.scores[b]] = [this.scores[b], this.scores[ab]]; this.sel = -1; SFX.confirm(); }
        return;
      }
    }
    if (r === 7 && a) { this.method === 1 ? this.assign(STANDARD_ARRAY) : this.assign(this.method === 2 ? this.rolls : STANDARD_ARRAY); this.sel = -1; SFX.confirm(); }
    if (this.method === 2 && r === 8 && a) { this.rolls = this.roll4d6(); this.assign(this.rolls); SFX.nat20(); }
    if (r === last && a) this.next();
  }
  updateName() {
    const R = CC_KEYS, n = R.length; let [cx, cy] = this.kc || [0, 0];
    if (nav('left')) { cx = (cx + R[cy].length - 1) % R[cy].length; SFX.cursor(); }
    if (nav('right')) { cx = (cx + 1) % R[cy].length; SFX.cursor(); }
    if (nav('up')) { cy = (cy + n - 1) % n; cx = Math.min(cx, R[cy].length - 1); SFX.cursor(); }
    if (nav('down')) { cy = (cy + 1) % n; cx = Math.min(cx, R[cy].length - 1); SFX.cursor(); }
    this.kc = [cx, cy];
    if (P('b')) { if (this.pick.name) { this.pick.name = this.pick.name.slice(0, -1); SFX.back(); } else { SFX.back(); this.go(4); } return; }
    if (P('start')) { this.next(); return; }
    if (P('a')) {
      const k = R[cy][cx];
      if (k === '<') this.pick.name = this.pick.name.slice(0, -1);
      else if (k === '>') { this.next(); return; }
      else if (k === '?') this.pick.name = this.randomName();
      else if (this.pick.name.length < 10 && !(k === '-' && (!this.pick.name || this.pick.name.endsWith('-')))) this.pick.name += k;
      SFX.type();
    }
  }
  finish() {
    const p = this.pick; if (!p.name) { this.go(5); SFX.error(); return; }
    SFX.confirm();
    G = newGameState(Object.assign({ slot: this.slot }, p, { scores: this.scores, look: p.look || null, portrait: p.portrait || null }));
    G.difficulty = p.diff;
    const role = CLASSES[G.cls].role === 'tank' ? 'healer' : 'tank';
    const buddy = makeAdventurer(role === 'tank' ? 'warden' : 'chaplain', 1, role === 'tank' ? 'BRAM' : 'ESME'); G.companions.push(buddy);
    saveGame();
    fadeTo(() => { scenes.length = 0; enterWorld(); const ch = chapterDef(); say([`Welcome to AELMOOR, ${G.name}.`, `${G.companions[0].name} the ${CLASSES[G.companions[0].cls].name} will travel with you. Hire more at any inn.`, `CHAPTER 1: ${ch.title}`, ch.line, 'START: menu   SELECT: map   B: mount   A: talk/act'], null, { who: 'ELDER' }); });
  }
  // ---------------------------------------------------------------- drawing
  drawPortrait(p, x, y, size) {
    const por = p.portrait && IMG[p.portrait] ? p.portrait : this.portraits()[0];
    const s = por ? sprFit(por, size) : sprH(`c_${p.cls}_0`, size - 4); blit(s, x + Math.round((size - s.width) / 2), y + Math.round((size - s.height) / 2));
  }
  drawWalker(look, x, y, size = 32) {
    const seq = ['down', 'side', 'up', 'sideL'], d = seq[Math.floor(this.t / 48) % 4], f = (this.t >> 4) % 2;
    const name = `gh_${look}_${d === 'sideL' ? 'side' : d}${f}`;
    blit(spr(IMG[name] ? name : `gh_warden_down${f}`, size, size, { flip: d === 'sideL' }), x, y);
  }
  draw() {
    fill(0, 0, W, H, 0);
    // tabs
    fill(0, 0, W, 11, 3);
    CC_STEPS.forEach((n, j) => { const x = 1 + j * 20; const st = j === this.step ? 'gold' : j <= this.done ? 1 : 2; fill(x, 1, 18, 9, st); text(String(j + 1), x + 6, 1, j === this.step ? 3 : 3); });
    textC(CC_STEPS[this.step] === 'REVIEW' ? 'YOUR HERO' : 'CHOOSE ' + CC_STEPS[this.step], 80, 13, 3); fill(4, 22, 152, 1, 2);
    const p = this.pick, s = this.step;
    const hint = h => text(h, 2, 135, 2);
    if (s === 0) {
      const L = Object.keys(SPECIES);
      const top = Math.max(0, Math.min(L.length - 10, this.cur[0] - 5)); L.slice(top, top + 10).forEach((k, n) => { const j = top + n, y = 25 + n * 11; if (j === this.cur[0]) fill(2, y - 1, 66, 11, 1); text(SPECIES[k].name.slice(0, 10), 5, y); }); if (top > 0) text('^', 60, 18, 2); if (top + 10 < L.length) text('v', 60, 134, 2);
      const sp = SPECIES[p.species]; frame(70, 24, 88, 109);
      const r0 = racePortrait(p.species, 0), r1 = racePortrait(p.species, 1);
      if (r0) blit(sprFit(r0, 30), 76, 27); if (r1 && r1 !== r0) blit(sprFit(r1, 30), 116, 27);
      text(Object.entries(sp.asi).map(([a, v]) => `${a}+${v}`).join(' ').slice(0, 13), 74, 60, 'gold');
      text(sp.traits.map(t => t.toUpperCase()).join(' ').slice(0, 13), 74, 70, 2);
      text(wrap(sp.desc, 13).slice(0, 6).join('\n'), 74, 80);
      hint('A/START:NEXT  SEL:RANDOM');
    } else if (s === 1) {
      CLASS_ORDER.forEach((id, j) => { const x = 3 + (j % CLASS_COLS) * 17, y = 24 + Math.floor(j / CLASS_COLS) * 19; if (j === this.cur[1]) fill(x - 1, y - 1, 18, 18, 1); const pr = classPortrait(id), sp2 = pr ? sprFit(pr, 16) : sprH(`c_${id}_0`, 16); blit(sp2, x + 8 - sp2.width / 2, y); });
      const c = CLASSES[p.cls]; frame(2, 85, 156, 48);
      text(c.name, 6, 87, 'gold'); textR(`${c.role.toUpperCase()} D${c.hd} ${c.primary}`, 154, 87, 2);
      text(wrap(c.desc, 25).slice(0, 2).join('\n'), 6, 96);
      text(`SAVES ${c.saves.join('/')} ${c.caster ? c.caster.toUpperCase() + ' CASTER' : 'MARTIAL'}`.slice(0, 25), 6, 114, 2);
      text(('GEAR ' + (c.gear || []).map(g => (WEAPONS[g] || ARMORS[g] || { name: g }).name).join(', ')).slice(0, 25), 6, 123, 2);
      hint('D-PAD:PICK A:NEXT SEL:RND');
    } else if (s === 2) {
      const L = Object.keys(BACKGROUNDS);
      L.forEach((k, j) => { const y = 25 + j * 12; if (j === this.cur[2]) fill(2, y - 1, 66, 12, 1); text(BACKGROUNDS[k].name, 5, y); });
      const b = BACKGROUNDS[p.bg]; frame(70, 24, 88, 109);
      text(wrap(b.desc, 13).slice(0, 5).join('\n'), 74, 28);
      text('SKILLS', 74, 78, 'gold'); text(b.skills.map(k => SKILL_NAME[k]).join('\n').slice(0, 40), 74, 88, 2);
      text(`GOLD ${b.gold * 5}`, 74, 118, 'gold');
      hint('A/START:NEXT  SEL:RANDOM');
    } else if (s === 3) {
      const r = this.cur[3], rows = this.method === 2 ? 10 : 9, sp = SPECIES[p.species], pr = abilityPriority(p.cls);
      const row = (i, y) => { if (r === i) fill(2, y - 1, 100, 10, 1); };
      row(0, 25); text(`< ${CC_METHODS[this.method]} >`.slice(0, 16), 5, 25, 'gold');
      ABIL6.forEach((a, j) => {
        const y = 36 + j * 10, v = this.scores[a], bon = sp.asi[a] || 0, tot = v + bon, m = mod(tot);
        row(j + 1, y); if (this.sel === j) fill(2, y - 1, 100, 10, 'gold');
        text(a, 5, y, a === pr[0] ? 'gold' : 3); text(String(v).padStart(2), 30, y); text(bon ? `+${bon}` : '  ', 46, y, 2); text(`=${String(tot).padStart(2)}`, 62, y); text(`${m >= 0 ? '+' : ''}${m}`, 86, y, 2);
      });
      row(7, 97); text(this.method === 1 ? 'RESET' : 'AUTO-ASSIGN', 5, 97);
      if (this.method === 2) { row(8, 107); text('REROLL 4D6', 5, 107); }
      row(rows - 1, 25 + (rows - 1) * 10 + 7); text('CONTINUE >', 5, 25 + (rows - 1) * 10 + 7, 'gold');
      frame(104, 24, 54, 109);
      text('PRIMARY', 108, 28, 2); text(pr[0], 108, 37, 'gold');
      const D = derive(this.preview()); text(`HP ${D.hpMax}`, 108, 50); text(`AC ${D.ac}`, 108, 60); text(`INIT${D.init >= 0 ? '+' : ''}${D.init}`, 108, 70);
      if (this.method === 1) { text('POINTS', 108, 86, 2); text(`${this.pointsLeft()}/${POINT_BUY.budget}`, 108, 95, this.pointsLeft() ? 'gold' : 3); }
      if (this.method === 2 && this.rolls) { text('ROLLED', 108, 86, 2); text(this.rolls.slice().sort((a, b) => b - a).join(' ').slice(0, 8), 108, 95); text(this.rolls.slice().sort((a, b) => b - a).slice(4).join(' '), 108, 104); }
      text(this.method === 1 ? '<> SET' : 'A SWAP', 108, 120, 2);
      hint(this.method === 1 ? 'LEFT/RIGHT: SPEND POINTS' : 'A: PICK TWO ROWS TO SWAP');
    } else if (s === 4) {
      const r = this.cur[4];
      frame(2, 24, 70, 76); this.drawWalker(heroLook(p), 21, 34, 32); text('WORLD', 20, 72, 2); text(`${CC_LOOKS.indexOf(heroLook(p)) + 1}/${CC_LOOKS.length}`, 20, 82, 2);
      frame(76, 24, 82, 76); this.drawPortrait(p, 93, 28, 48); text('PORTRAIT', 90, 82, 2);
      [['< SPRITE >', 0], ['< PORTRAIT >', 1], ['CONTINUE >', 2]].forEach(([l, i]) => { const y = 104 + i * 10; if (r === i) fill(2, y - 1, 156, 10, 1); text(l, 6, y, i === 2 ? 'gold' : 3); });
      hint('LEFT/RIGHT:CHANGE SEL:RND');
    } else if (s === 5) {
      frame(24, 25, 112, 16); text(p.name + ((frameN >> 4) % 2 ? '_' : ' '), 30, 29); text(`${p.name.length}/10`, 138, 29, 2);
      const [kx, ky] = this.kc || [0, 0];
      CC_KEYS.forEach((row, ry) => row.forEach((k, rx) => {
        const special = ry === CC_KEYS.length - 1, x = special ? 14 + rx * 48 : 12 + rx * 18, y = 47 + ry * 14, w = special ? 40 : 14;
        if (rx === kx && ry === ky) fill(x - 3, y - 2, w, 12, 1);
        text(special ? { '?': 'RANDOM', '<': 'DELETE', '>': 'DONE' }[k] : k, x, y, special ? 'gold' : 3);
      }));
      hint('A:TYPE B:DEL START:DONE');
    } else if (s === 6) {
      const r = this.cur[6], m = PLAY_MODES.find(x => x.id === p.mode), d = DIFFICULTY[p.diff - 1];
      [[`MODE  < ${m.name} >`, 0], [`TIER  < ${p.diff} ${d.name} >`, 1], ['CONTINUE >', 2]].forEach(([l, i]) => { const y = 27 + i * 12; if (r === i) fill(2, y - 1, 156, 11, 1); text(l.slice(0, 25), 6, y, i === 2 ? 'gold' : 3); });
      frame(2, 64, 156, 68);
      if (r === 1) { text(`${d.name}: MONSTERS LV+${d.lvl}`, 6, 68, 'gold'); text(`HP x${d.hp}  DMG x${d.dmg}`, 6, 80); text(`XP x${d.xp}  LOOT x${d.loot}`, 6, 90); text('CHANGE LATER: ORACLE', 6, 108, 2); text('IN ARDENHOLD / SETTINGS', 6, 118, 2); }
      else { text(m.name, 6, 68, 'gold'); text(wrap(m.desc, 25).slice(0, 3).join('\n'), 6, 80); text('FRIENDS ON YOUR SHARED', 6, 108, 2); text('PAGE JOIN YOUR REALM', 6, 118, 2); }
      hint('LEFT/RIGHT:CHANGE A:NEXT');
    } else {
      const r = this.cur[7], c = this.preview(), D = derive(c), m = PLAY_MODES.find(x => x.id === p.mode);
      frame(2, 24, 44, 46); this.drawPortrait(p, 4, 26, 40);
      this.drawWalker(heroLook(p), 15, 72, 16);
      const lines = [['SPC', SPECIES[p.species].name], ['CLS', CLASSES[p.cls].name], ['BKG', BACKGROUNDS[p.bg].name], ['ABL', CC_METHODS[this.method]], ['LOK', heroLook(p).toUpperCase()], ['NAM', p.name || '- NONE -'], ['MOD', `${m.name} T${p.diff}`]];
      lines.forEach(([k, v], i) => { const y = 25 + i * 9; if (r === i) fill(48, y - 1, 110, 9, 1); text(k, 51, y, 2); text(String(v).slice(0, 14), 72, y, i === 5 && !p.name ? 'red' : 3); });
      text(ATTRS.map(a => `${a}${String(D.A[a]).padStart(3)}`).reduce((acc, s2, i) => acc + s2 + (i % 3 === 2 ? '\n' : ' '), ''), 4, 91);
      text(`HP ${D.hpMax} AC ${D.ac} INIT${D.init >= 0 ? '+' : ''}${D.init} PB+${profBonus(c)}`, 4, 119, 2);
      if (r === 7) fill(20, 128, 120, 11, 'gold');
      textC('BEGIN YOUR STORY', 80, 129, r === 7 ? 3 : (frameN >> 4) % 2 ? 3 : 2);
    }
  }
}

// ================================================================ FIELD
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const LOOK_F = { down: [0, 3], up: [3, 0], left: [5, 1], right: [4, 2] };
const CITY_NPCS = [
  [5, 7, 'villager_0', 'AUCTIONEER', 'auction'], [10, 6, 'elder_1', 'BANKER', 'bank'], [6, 17, 'villager_2', 'INNKEEPER', 'inn'], [22, 6, 'hero_1', 'TRAINER', 'trainer'],
  [26, 7, 'elder_2', 'GUILDMASTER', 'guild'], [13, 10, 'villager_1', 'MERCHANT', 'vendor'], [19, 10, 'hero_2', 'QUARTERMASTER', 'honor'], [15, 14, 'villager_3', 'LFG BOARD', 'lfg'],
  [12, 14, 'elder_3', 'ORACLE', 'difficulty'], [17, 5, 'hero_3', 'SPIRE KEEPER', 'tower'], [21, 18, 'villager_5', 'TRIALS MASTER', 'trials'], [27, 13, 'villager_4', 'HARBORMASTER', 'portal'],
  [19, 14, 'elder_5', 'REALM STONE', 'server'], [10, 18, 'villager_0', 'STABLEMASTER', 'stable'], [23, 18, 'hero_0', 'ARENAMASTER', 'arena'],
  [4, 11, 'hero_2', 'BLACKSMITH', 'blacksmith'], [8, 11, 'hero_1', 'ARMORSMITH', 'armorsmith'], [24, 11, 'hero_3', 'WEAPONSMITH', 'weaponsmith'], [13, 18, 'villager_2', 'HOUSING STEWARD', 'housing'],
];
const BLACKSMITH_TIERS = [
  { tier: 1, name: 'APPRENTICE', level: 1, maxRarity: 2 },
  { tier: 2, name: 'JOURNEYMAN', level: 20, maxRarity: 5 },
  { tier: 3, name: 'MASTER', level: 40, maxRarity: 6 },
  { tier: 4, name: 'GRANDMASTER', level: 60, maxRarity: 8 },
];
const blacksmithTier = level => BLACKSMITH_TIERS.filter(t => level >= t.level).at(-1) || BLACKSMITH_TIERS[0];
const TILE_SVC = { H: 'auction', J: 'inn', r: 'mail', q: 'trainer', a: 'bank' };
let FIELD = null;
const currentField = () => FIELD;
window.GBQWorldMapMini = () => {
  if (!G || !FIELD || !FIELD.m || !Array.isArray(FIELD.m.rows)) return null;
  const rows = FIELD.m.rows;
  const entities = typeof FIELD.entities === 'function' ? FIELD.entities().filter(e => Number.isFinite(e.x) && Number.isFinite(e.y)).slice(0, 80).map(e => ({ x: e.x, y: e.y, kind: e.kind, name: e.name || e.b?.name || e.p?.name || e.item || e.kind })) : [];
  return { zone: FIELD.zone?.name || G.map || 'Unknown region', x: Number(G.x) || 0, y: Number(G.y) || 0, width: Math.max(1, ...rows.map(row => String(row).length)), height: rows.length, rows: rows.map(row => String(row)), entities };
};
function enterWorld() { reset(new Field()); }
class Field {
  constructor() { this.opaque = true; this.ox = 0; this.oy = 0; this.walk = 0; this.since = 0; this.toast = 90; this.trail = []; FIELD = this; this.reload(); }
  reload() {
    if (G.inst) { this.m = G.inst.map; this.zone = null; }
    else { this.m = buildZoneCached(G.map); this.zone = ZONE_BY_ID[G.map]; }
    this.toast = 90; this.trail = []; Physics.clear();
    window.SOLID_AT = null;
    Music.play(this.m.music);
    if (this.zone) { if (!G.waypoints[G.map] && this.m.poi.waypoint) {} G.visited = G.visited || {}; G.visited[G.map] = true; questEvent('enter', G.map); this.discover(); }
  }
  enter() { this.reload(); }
  resume() { Music.play(this.m.music); FIELD = this; }
  tileAt(x, y) { const r = this.m.rows[y]; if (!r || x < 0 || x >= r.length) return null; return this.m.tiles[r[x]]; }
  chAt(x, y) { return (this.m.rows[y] || '')[x]; }
  entities() {
    const e = [];
    if (G.inst) {
      for (const p of instVisiblePulls(G.inst)) e.push({ kind: 'pull', p, x: p.x, y: p.y });
      if (!G.inst.chest && G.inst.map.chest) e.push({ kind: 'chest', x: G.inst.map.chest.x, y: G.inst.map.chest.y });
      for (const v of G.inst.map.vaults || []) e.push({ kind: 'vault', v, x: v.x, y: v.y, open: (G.inst.vaultsOpened || []).includes(v.id) });
      for (const t of G.inst.map.traps) if (!t.done && derive(G).passive >= t.dc) e.push({ kind: 'trap', t, x: t.x, y: t.y, walk: true });
      return e;
    }
    const z = this.zone, m = this.m;
    if (z.town && z.id === z.region) CITY_NPCS.forEach(([x, y, s, name, svc]) => {
      if (G.lvl < 20 && (svc === 'armorsmith' || svc === 'weaponsmith')) return;
      e.push({ kind: 'npc', x, y, spr: s, name, svc });
    });
    else if (z.town) [[6, 8, 'villager_4', 'DOCKHAND', 'portal'], [12, 8, 'villager_1', 'FISHMONGER', 'vendor'], [20, 8, 'hero_1', 'TRAINER', 'trainer'], [5, 11, 'hero_2', 'BLACKSMITH', 'blacksmith'], [14, 11, 'hero_1', 'ARMORSMITH', 'armorsmith'], [23, 11, 'hero_3', 'WEAPONSMITH', 'weaponsmith'], [9, 15, 'villager_2', 'HOUSING STEWARD', 'housing']].forEach(([x, y, s, name, svc]) => {
      if (G.lvl < 20 && (svc === 'armorsmith' || svc === 'weaponsmith')) return;
      e.push({ kind: 'npc', x, y, spr: s, name, svc });
    });
    else {
      if (z.id === 'elderwood') { e.push({ kind: 'npc', x: 5, y: 16, spr: 'elder_0', name: 'ELDER MAE', svc: 'elder' }); e.push({ kind: 'npc', x: 7, y: 14, spr: 'villager_0', name: 'MERCHANT', svc: 'vendor' }); e.push({ kind: 'npc', x: 2, y: 7, spr: 'hero_1', name: 'CAPTAIN', svc: 'warden' }); e.push({ kind: 'npc', x: 11, y: 14, spr: 'villager_2', name: 'VILLAGE STEWARD', svc: 'housing' }); }
      else { const r = RNG('warden-' + z.id); e.push({ kind: 'npc', x: m.hub[0], y: m.hub[1] - 1, spr: r.pick(['villager_1', 'villager_3', 'elder_1', 'hero_2']), name: `WARDEN ${r.pick(NPC_FIRST)}`, svc: 'warden' }); }
      if (m.poi.waypoint) e.push({ kind: 'waypoint', x: m.poi.waypoint.x, y: m.poi.waypoint.y });
      const nodes = G.nodes[z.id] || {};
      m.nodes.forEach(([x, y, profession, item], i) => { if (!nodes[i] || G.stats.steps - nodes[i] > Math.round(250 * (1 - Math.min(0.8, perkVal(profession, 'respawn'))))) e.push({ kind: 'gather', i, x, y, profession, item, walk: true }); });
      for (const b of m.bosses) { const k = G.bossKills[b.id]; if (!k || Date.now() - k > (b.arc ? 3600e3 : 1800e3)) e.push({ kind: 'boss', b, x: b.x, y: b.y }); }
      if (G.ghost && G.ghost.map === z.id) e.push({ kind: 'grave', x: G.ghost.x, y: G.ghost.y, walk: true });
    }
    if (!G.inst && this.zone && globalThis.GBQSecretWorld) {
      for (const secret of globalThis.GBQSecretWorld.definitions) {
        if (secret.zone !== this.zone.id || G.lvl < secret.minLvl || (G.secretWorld && G.secretWorld[secret.id])) continue;
        const pos = globalThis.GBQSecretWorld.position(secret, this.m);
        if (pos && Math.abs(pos.x - G.x) <= 3 && Math.abs(pos.y - G.y) <= 3) e.push({ kind: 'secret_hint', x: pos.x, y: pos.y, walk: true });
      }
    }
    for (const p of realmPlayersIn(G.map)) e.push({ kind: 'sim', p, x: p.x, y: p.y, walk: true });
    for (const p of NET.peersInZone(G.map)) e.push({ kind: 'peer', p, x: p.presence.x, y: p.presence.y, walk: true });
    return e;
  }
  blocked(x, y) {
    const t = this.tileAt(x, y); if (!t || !t[1]) return true;
    return this.entities().some(e => e.x === x && e.y === y && !e.walk);
  }
  update() {
    if (this.toast > 0) this.toast--;
    // sim players wander
    if (frameN % 40 === 0) for (const p of realmPlayersIn(G.map)) { const d = pick(Object.keys(DIRS)), [dx, dy] = DIRS[d]; if (!this.blocked(p.x + dx, p.y + dy) && R() < 0.5) { p.x += dx; p.y += dy; p.dir = d; } }
    weatherTick(this.zone ? this.zone.biome : null, this.cam ? this.cam[0] : 0, this.cam ? this.cam[1] : 0);
    if (this.ox || this.oy) {
      const sp = G.mounted ? (typeof mountSpeed === 'function' ? mountSpeed() : 4) : 2;
      this.ox -= Math.sign(this.ox) * sp; this.oy -= Math.sign(this.oy) * sp; this.walk += sp;
      if (!this.ox && !this.oy) this.onStep();
      return;
    }
    if (globalThis.GBQEasterEggs && G) {
      for (const key of ['up', 'down', 'left', 'right', 'a', 'b', 'start']) {
        if (P(key)) { const found = globalThis.GBQEasterEggs.feed(G, key); if (found && found.ok) return; }
      }
    }
    if (P('start')) { SFX.open(); push(new MainMenu()); return; }
    if (P('select')) { SFX.open(); push(new WorldMap()); return; }
    if (P('b') && G.hasMount && !G.inst && !G.ghost) { G.mounted = !G.mounted; SFX[G.mounted ? 'howl' : 'cursor'](); return; }
    if (P('a')) { this.interact(); return; }
    if (!['up', 'down', 'left', 'right'].some(d => held[d])) this.contact = null; // let go: next bump counts again
    for (const d of ['up', 'down', 'left', 'right']) {
      if (!held[d]) continue;
      G.dir = d;
      const [dx, dy] = DIRS[d], nx = G.x + dx, ny = G.y + dy;
      if (this.exitAt(nx, ny)) return;
      if (this.blocked(nx, ny)) {
        // bump once per contact: holding a direction into a door or NPC must not re-open its menu after you close it
        const key = nx + ',' + ny;
        if (P(d) || this.contact !== key) { this.contact = key; if (!this.bump(nx, ny)) SFX.cursor(); }
      }
      else { this.contact = null; this.trail.unshift([G.x, G.y, G.dir]); this.trail.length = 12; G.x = nx; G.y = ny; this.ox = -dx * T; this.oy = -dy * T; }
      break;
    }
  }
  exitAt(nx, ny) {
    if (G.inst) return false;
    for (const side in this.m.exits) { const e = this.m.exits[side]; if (e.x === nx && e.y === ny) {
      const target = ZONE_BY_ID[e.to]; const tm = buildZoneCached(e.to), back = tm.exits[OPP[side]];
      if (!back) return false;
      if (target.lvl[0] > G.lvl + 8 && !G.ghost) { say(`${target.name} (LV ${target.lvl[0]}+) is too dangerous for now.`); return true; }
      SFX.door(); fadeTo(() => { G.map = e.to; G.x = back.ix; G.y = back.iy; G.dir = { N: 'up', S: 'down', E: 'right', W: 'left' }[side]; this.ox = this.oy = 0; this.reload(); });
      return true;
    } }
    return false;
  }
  bump(x, y) {
    const e = this.entities().find(e => e.x === x && e.y === y);
    if (e && (e.kind === 'pull' || e.kind === 'boss')) { this.interactAt(x, y); return true; }
    const ch = this.chAt(x, y);
    if (!G.inst && 'kKRQHJrqa'.includes(ch)) { this.interactAt(x, y); return true; }
    return false;
  }
  interact() { const [dx, dy] = DIRS[G.dir]; this.interactAt(G.x + dx, G.y + dy); }
  interactAt(x, y) {
    const e = this.entities().find(e => e.x === x && e.y === y);
    if (G.ghost && !(e && (e.kind === 'npc' && e.svc === 'warden' || e.kind === 'grave'))) { if (e && e.kind === 'npc') return say('You are a spirit. Find your grave, or ask a warden for a spirit healer.'); }
    if (e) {
      if (e.kind === 'npc') return npcService(e);
      if (e.kind === 'waypoint') { if (!G.waypoints[G.map]) { G.waypoints[G.map] = true; SFX.waypoint(); toast('WAYPOINT', this.zone.name, 'px_waypoint', 'waypoint'); checkAchievements(); } return push(new WaypointMenu()); }
      if (e.kind === 'gather' || e.kind === 'herb') return gatherProfessionNode(e);
      if (e.kind === 'boss') return fightBoss(e.b);
      if (e.kind === 'pull') return fightPull(e.p);
      if (e.kind === 'chest') return openInstanceChest();
      if (e.kind === 'vault') return e.open ? say('An empty chest.') : openVault(G.inst, e.v);
      if (e.kind === 'sim') return simPlayerMenu(e.p);
      if (e.kind === 'peer') return say([`${clean(e.p.presence.n)} - LV${e.p.presence.l} ${(CLASSES[e.p.presence.c] || { name: '' }).name}`, e.p.presence.h ? `Hosting server: ${clean(e.p.presence.h, 20)}` : 'A fellow adventurer (live player).']);
    }
    if (!G.inst && this.zone && globalThis.GBQSecretWorld) {
      const secret = globalThis.GBQSecretWorld.at(G, this.zone, this.m, x, y);
      if (secret) return globalThis.GBQSecretWorld.activate(secret, G);
    }
    const ch = this.chAt(x, y), t = this.tileAt(x, y);
    if (G.inst) {
      if (ch === 'L') return leaveInstance(); if (ch === 'U') return towerNext();
      if (ch === 'A' && useShrine(G.inst, x, y)) return;
      const LINES = { t: 'A torch flickers.', s: 'A grim statue watches you.', D: 'A sealed door. Its runes answer to the guardians of this place.', h: 'Old tomes. One is titled: ' + pick(['ON LANTERNS', 'THE EMBER CODEX, VOL. II', 'A HISTORY OF AELMOOR', 'WARDS AND SEALS', 'BESTIARY OF THE DEEP']) + '.', T: 'An empty throne. For now.', B: 'The brazier burns without fuel.', i: 'Rusted bars. The cell is empty.', p: 'You cannot cross that.', o: 'A carved pillar.', n: `${G.inst.map.name}. ${(instRoomAt(G.inst, G.x, G.y) || {}).desc || ''}`, b: 'An old barrel. Empty.' };
      if (LINES[ch]) return say(LINES[ch]);
      return;
    }
    if (t && (ch === '~' || ch === 'W' || ch === 'w' || ch === 'v')) return push(new Fishing());
    if (this.zone.town && this.zone.id === this.zone.region) {
      const svc = { K: 'tower', k: 'tower', Q: 'arena', R: 'portal', H: 'auction', J: 'inn', r: 'mail', q: 'trainer' }[ch]; if (svc) return npcService({ svc, name: svc.toUpperCase() });
    } else if (this.zone.town) { const svc = { H: 'auction', J: 'inn', r: 'mail', q: 'trainer', Q: 'portal', R: 'portal' }[ch]; if (svc) return npcService({ svc, name: svc.toUpperCase() }); }
    if (ch === 'k' || ch === 'K') { const dg = this.m.poi.dungeon; if (dg) return instanceMenu('dungeon', DUNGEONS.find(d => d.id === dg.id)); }
    if (ch === 'R' && this.m.poi.raid) return instanceMenu('raid', RAIDS.find(d => d.id === this.m.poi.raid.id));
    if (TILE_SVC[ch] && this.zone.id === 'elderwood') return npcService({ svc: TILE_SVC[ch], name: TILE_SVC[ch].toUpperCase() });
    if (ch === 'H' || ch === 'J') return say('A cosy house. Nobody answers.');
    if (ch === 'r' || ch === 'q') return say('A small shrine. You feel calm.');
  }
  onStep() {
    G.stats.steps++; this.since++;
    const t = this.tileAt(G.x, G.y), ch = this.chAt(G.x, G.y);
    const stepS = this.zone && this.zone.biome === 'snow' ? 'step_snow' : (ch === 's' || ch === 'S') ? 'step_sand' : G.inst ? 'step_stone' : 'step_grass';
    if (G.stats.steps % 2 === 0) SFX[stepS]();
    if (G.mounted && this.cam) FX.dust(G.x * T - this.cam[0] + 4, G.y * T - this.cam[1] + 14);
    if (G.inst) {
      const trap = G.inst.map.traps.find(tr => tr.x === G.x && tr.y === G.y && !tr.done);
      const room = instRoomAt(G.inst, G.x, G.y), seen = G.inst.seenRooms = G.inst.seenRooms || [];
      if (room && !seen.includes(room.x + ',' + room.y)) { seen.push(room.x + ',' + room.y); if (seen.length > 1 || G.inst.kind === 'tower') toast(`ROOM ${room.number || seen.length}/${G.inst.map.roomCount || G.inst.map.rooms.length} T${room.difficulty || G.inst.difficulty || G.difficulty}`, room.name.slice(0, 22), 'px_map', 'page'); }
      if (ch === '^') { const sv = skillCheck(G, 'acrobatics', G.inst.map.trapDC || 12); if (!sv.ok) { const d = roll(G.inst.map.spikeDmg || '1d4').total; G.hp = Math.max(1, G.hp - d); shake = 3; SFX.hurt(); FX.number(76, 56, String(d), 'red'); } else SFX.dodge(); }
      if (trap) { trap.done = true; const sv = skillCheck(G, 'acrobatics', trap.dc); const d = sv.ok ? 0 : roll(trap.dmg).total; if (d) G.hp = Math.max(1, G.hp - d); shake = 6; SFX[d ? 'hurt' : 'dodge'](); say([`A hidden trap! ${sv.text}`, d ? `You take ${d} damage.` : 'You leap clear!']); }
      return;
    }
    if (G.ghost && G.ghost.map === G.map && Math.abs(G.ghost.x - G.x) + Math.abs(G.ghost.y - G.y) <= 0) { G.ghost = null; G.hp = Math.ceil(derive(G).hpMax / 2); SFX.revive(); say('You return to your body. Half HP restored.'); return; }
    this.discover();
    const zt = t && t[2];
    const rate = zt === 'wood' ? 0.1 : zt === 'open' ? 0.06 : 0;
    if (rate && !G.ghost && !(window.DBG && DBG.noEnc) && this.since > 5 && R() < rate * (S.encRate || 1) * (G.mounted ? (typeof mountEnc === 'function' ? mountEnc() : 0.6) : 1)) {
      this.since = 0;
      const foes = rollEncounter(this.zone, { group: zt === 'wood' });
      const st = skillCheck(G, 'stealth', 10 + Math.floor(foes[0].lvl / 2));
      startBattle(foes, { surprise: st.ok && R() < 0.5 ? 'party' : (!st.ok && st.roll === 1 ? 'foe' : null) });
    }
  }
  discover() {
    if (!this.zone || this.zone.town) return;
    for (const a of this.m.areas) {
      const [x, y, w, h] = a.r;
      if (!G.areas[a.id] && G.x >= x && G.x < x + w && G.y >= y && G.y < y + h) {
        G.areas[a.id] = true; const xp = xpForMonster(this.zone.lvl[0]) * 2; gainXP(G, xp);
        toast('DISCOVERED', a.name, 'px_map', 'discover'); questEvent('discover', a.id); checkAchievements();
      }
    }
  }
  draw() {
    const m = this.m, cols = m.rows[0].length, rows = m.rows.length;
    const px = G.x * T + this.ox, py = G.y * T + this.oy;
    const cx = Math.max(0, Math.min(cols * T - W, px - 72)), cy = Math.max(0, Math.min(rows * T - H, py - 64));
    this.cam = [cx, cy];
    if (S.video === 'hd64' && typeof Light64 !== 'undefined') Light64.fromField(this);
    const ghost = !!G.ghost, PIX = S.tiles !== 'painted', anim = (frameN >> 5) % 2;
    for (let ty = Math.floor(cy / T); ty <= Math.floor((cy + H) / T); ty++)
      for (let tx = Math.floor(cx / T); tx <= Math.floor((cx + W) / T); tx++) {
        const d = this.tileAt(tx, ty); if (!d) continue;
        if (PIX && m.gfx) blit(spr(m.gfx[ty][tx].replace('%f', anim), T, T, { ghost }), tx * T - cx, ty * T - cy);
        else blit(spr(d[0], T, T, { rot: d[3], ghost }), tx * T - cx, ty * T - cy);
      }
    const list = this.entities().map(e => Object.assign(e, { sy: e.y * T }));
    list.push({ kind: 'player', sy: py });
    G.companions.slice(0, 3).forEach((c, i) => { const tr = this.trail[(i + 1) * 2 - 1]; if (tr) list.push({ kind: 'follower', c, x: tr[0], y: tr[1], dir: tr[2], sy: tr[1] * T - 1 }); });
    if (G.pet) { const tr = this.trail[G.companions.length ? 7 : 1]; if (tr) list.push({ kind: 'pet', x: tr[0], y: tr[1], sy: tr[1] * T - 2 }); }
    list.sort((a, b) => a.sy - b.sy);
    for (const e of list) {
      const ex = e.x * T - cx, ey = e.y * T - cy;
      if (e.kind === 'player') {
        const f = LOOK_F[G.dir][(this.ox || this.oy) ? (this.walk >> 3) % 2 : 0];
        if (G.mounted) { const mnt = sprH(mountArt() || 'enemy_lizard', 16); blit(mnt, px - cx + (T - mnt.width) / 2, py - cy + 3); }
        const moveBob = (this.ox || this.oy) && (this.walk >> 3) % 2 ? 1 : 0;
        const walkFrame = (this.ox || this.oy) ? (this.walk >> 3) % 2 : 0;
        const hdFrame = hdWorldFrame(G, G.dir, walkFrame, !!(this.ox || this.oy), ghost);
        const gearWalker = worldGearWalker(G, G.dir, walkFrame, ghost);
        const portrait = hdFrame || gearWalker || worldPortrait(G, G.dir, ghost);
        if (portrait) blit(portrait, px - cx + (T - portrait.width) / 2, py - cy + T - portrait.height - 1 - (G.mounted ? 6 : 0) - moveBob);
        else if (PIX) blit(walker(heroLook(G), G.dir, (this.ox || this.oy) ? (this.walk >> 3) % 2 : 0, ghost), px - cx, py - cy - 3 - (G.mounted ? 5 : 0));
        else { const c = sprH(`c_${G.cls}_${f}`, 23, { ghost }); blit(c, px - cx + (T - c.width) / 2, py - cy + T - 23 - (G.mounted ? 6 : 1)); }
      } else if (e.kind === 'follower') {
        const bob = (this.walk >> 3) % 2;
        const hdFrame = hdWorldFrame(e.c, e.dir, bob, true, false);
        const gearWalker = worldGearWalker(e.c, e.dir, bob);
        const portrait = hdFrame || gearWalker || worldPortrait(e.c, e.dir);
        if (portrait) blit(portrait, ex + (T - portrait.width) / 2, ey + T - portrait.height - 1 - bob);
        else if (PIX) blit(walker(heroLook(e.c), e.dir, bob), ex, ey - 3);
        else { const c = sprH(`c_${e.c.cls}_${LOOK_F[e.dir][0]}`, 21); blit(c, ex + (T - c.width) / 2, ey + T - 22); }
      }
      else if (e.kind === 'pet') blit(sprH(G.pet === 'slime' ? 'enemy_slime' : 'enemy_bat', 9), ex + 3, ey + 6);
      else if (e.kind === 'npc') { if (PIX) blit(typeof npcSprite === 'function' ? npcSprite(e) : walker(npcLook(e.spr), 'down', 0), ex, ey - 3); else { const c = sprH(e.spr, 23); blit(c, ex + (T - c.width) / 2, ey + T - 24); } if (e.svc === 'warden' || e.svc === 'elder') { const q = npcMarker(e); if (q) { fill(ex + 5, ey - 12, 7, 10, 3); text(q, ex + 5, ey - 11, q === '?' ? 'gold' : 'gold'); } } }
      else if (e.kind === 'sim' || e.kind === 'peer') {
        const p = e.kind === 'sim' ? e.p : { name: clean(e.p.presence.n), cls: e.p.presence.c, dir: e.p.presence.d || 'down' };
        const portrait = worldPortrait({ cls: CLASSES[p.cls] ? p.cls : 'warden' }, p.dir || 'down');
        if (portrait) blit(portrait, ex + (T - portrait.width) / 2, ey + T - portrait.height - 1);
        else if (PIX) blit(walker(CLASSES[p.cls] ? p.cls : 'warden', p.dir || 'down', 0), ex, ey - 3);
        else { const c = sprH(`c_${CLASSES[p.cls] ? p.cls : 'warden'}_${LOOK_F[p.dir || 'down'][0]}`, 21); blit(c, ex + (T - c.width) / 2, ey + T - 22); }
        const nm = (p.name || '').slice(0, 8);
        const hostile = e.kind === 'sim' && G.pvpEnabled && p.pvpEnabled && p.faction !== G.pvpFaction;
        if (S.nameTags !== false || hostile || Math.abs(e.x - G.x) + Math.abs(e.y - G.y) <= 1) { fill(ex + 8 - nm.length * 3 - 1, ey - 8, nm.length * 6 + 2, 8, hostile ? 'red' : e.kind === 'peer' ? 'blue' : 3); text(nm, ex + 8 - nm.length * 3, ey - 8, 0); }
      }
      else if (e.kind === 'gather' || e.kind === 'herb') { const icon = sprH(ITEMS[e.item || e.herb]?.icon || 'item_herb', 12); if (icon) blit(icon, ex + (T - icon.width) / 2, ey + 2 - ((frameN >> 5) % 4 === 0 ? 1 : 0)); }
      else if (e.kind === 'waypoint') { if (PIX) blit(spr(`go_wp${(frameN >> 4) % 2}`, 16, 16), ex, ey); else blit(sprH('px_waypoint', 14), ex + 2, ey + 1 - Math.round(Math.sin(frameN / 15))); }
      else if (e.kind === 'secret_hint') { if ((frameN >> 3) % 3 === 0) { fill(ex + 7, ey + 5, 2, 2, 'gold'); fill(ex + 6, ey + 7, 4, 1, '#b8a6ff'); } }
      else if (e.kind === 'grave') blit(PIX ? spr('go_grave', 16, 16) : sprH('px_skull', 10), ex + (PIX ? 0 : 3), ey + (PIX ? 0 : 4));
      else if (e.kind === 'trap') { if (PIX) blit(spr('go_trap', 16, 16), ex, ey); else fill(ex + 4, ey + 6, 8, 4, 'red'); }
      else if (e.kind === 'chest') blit(PIX ? spr('go_chest', 16, 16) : sprFit('item_chest', 14), ex + (PIX ? 0 : 1), ey + (PIX ? 0 : 2));
      else if (e.kind === 'vault') blit(PIX ? spr(e.open ? 'go_chestopen' : 'go_chest', 16, 16) : sprFit(e.open ? 'item_chest_open' : 'item_chest', 14), ex + (PIX ? 0 : 1), ey + (PIX ? 0 : 2));
      else if (e.kind === 'boss') { const bd = e.b, B = BOSS_BY_ID[bd.id]; const c = sprH(monsterArt(B), 26); blit(c, ex + (T - c.width) / 2, ey + T - 27 + Math.round(Math.sin(frameN / 10))); if ((frameN >> 4) % 2) text(B.cat === 'arc' ? '!!' : '!', ex + 4, ey - 18, 'red'); }
      else if (e.kind === 'pull') { const p = e.p, s = p.boss ? monsterArt(BOSS_BY_ID[p.boss]) : monsterArt(BEAST_BY_ID[p.mobs[0]] || BESTIARY[0]); const c = sprH(s, p.boss ? 26 : 18); blit(c, ex + (T - c.width) / 2, ey + T - c.height - 1 + ((frameN >> 4) % 2)); if (p.miniboss && (frameN >> 4) % 2) text('M!', ex + 3, ey - 8, 'red'); }
    }
    FX.draw(cx, cy);
    const mmo = typeof hudMmo === 'function' && hudMmo(), by = mmo ? MMO_LAYOUT.bannerY : 4;
    if (this.toast > 0) { const n = (G.inst ? this.m.name : `${this.zone.name}`).slice(0, 24); frame(80 - n.length * 3 - 6, by, n.length * 6 + 12, 15); textC(n, 80, by + 3); if (this.zone && !this.zone.town) textC(`${this.zone.sub} LV${this.zone.lvl[0]}-${this.zone.lvl[1]}`, 80, by + 17, 'gold'); }
    if (this.zone && !G.inst && !mmo) textC(this.zone.town ? 'SAFE ZONE' : G.pvpEnabled ? 'WAR MODE: PVP' : 'WAR MODE: PVE', 80, 31, this.zone.town ? 2 : G.pvpEnabled ? 'red' : 2);
    // HUD: hp/xp micro bars
    const D = derive(G);
    if (!mmo) {
    if (!(typeof uiDark === 'function' && uiDark())) { const por = heroPortrait(G); if (por) { fill(1, H - 23, 18, 18, 3); fill(2, H - 22, 16, 16, 0); const s = sprFit(por, 16); blit(s, 2 + Math.round((16 - s.width) / 2), H - 22 + Math.round((16 - s.height) / 2)); } }
    bar(1, H - 5, 50, 4, G.hp, D.hpMax, G.hp < D.hpMax * 0.3 ? 'red' : 'hp');
    const x0 = xpForLevel(G.lvl), x1 = xpForLevel(Math.min(LEVEL_CAP, G.lvl + 1));
    bar(53, H - 4, 106, 3, G.xp - x0, Math.max(1, x1 - x0), 'xp');
    }
    if (ghost) textC('SPIRIT', 80, mmo ? H - 32 : H - 14, 'blue');
  }
}
// Game Boy walking sprites: 3 directions x 2 frames (left = mirrored side view)
function walker(look, dir, frame, ghost) {
  const d = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'side';
  const name = `gh_${look}_${d}${frame}`;
  return spr(IMG[name] ? name : `gh_warden_${d}${frame}`, 16, 16, { flip: dir === 'left', ghost });
}
function worldGearWalker(character, dir = 'down', frame = 0, ghost = false) {
  if (!character || !character.eq || typeof walkerGearVisuals !== 'function' || typeof itemIcon !== 'function') return null;
  const visuals = walkerGearVisuals(character.eq).filter(v => {
    const name = itemIcon(v.item);
    return name && IMG[name];
  });
  if (!visuals.length) return null;
  const base = walker(heroLook(character), dir, frame, ghost);
  if (!base) return null;
  const out = mkCanvas(24, 24), x = out.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(base, 0, 0, 24, 24);
  for (const v of visuals) {
    const name = itemIcon(v.item), size = Math.max(1, Math.round(v.size * 1.5)), icon = spr(name, size, size, { ghost });
    if (icon) x.drawImage(icon, Math.round(v.x * 1.5), Math.round(v.y * 1.5));
  }
  return out;
}
function worldPortrait(character, dir = 'down', ghost = false) {
  const portrait = heroPortrait(character);
  if (!portrait) return null;
  const base = sprFit(portrait, 24, { flip: dir === 'left', ghost });
  if (!base || !character || !character.eq || typeof worldGearVisuals !== 'function' || typeof itemIcon !== 'function') return base;
  const visuals = worldGearVisuals(character.eq).filter(v => {
    const name = itemIcon(v.item);
    return name && IMG[name];
  });
  if (!visuals.length) return base;
  const out = mkCanvas(24, 24), x = out.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(base, Math.round((24 - base.width) / 2), Math.round((24 - base.height) / 2));
  for (const v of visuals) {
    const name = itemIcon(v.item), icon = spr(name, v.size, v.size, { ghost });
    if (icon) x.drawImage(icon, v.x, v.y);
  }
  return out;
}
// HD art is prepared asynchronously and only drawn after its canvas is ready.
let HD_WORLD_RUNTIME = null;
const HD_WORLD_PRESENTERS = new WeakMap(), HD_WORLD_SCALED = new WeakMap();
function hdWorldFrame(character, dir = 'down', frame = 0, moving = false, ghost = false) {
  if (ghost || !character || !character.eq || typeof globalThis === 'undefined') return null;
  const api = globalThis.GBQHDCharacterArt;
  if (!api) return null;
  try {
    if (!HD_WORLD_RUNTIME) HD_WORLD_RUNTIME = api.createRuntime();
    let presenter = HD_WORLD_PRESENTERS.get(character);
    if (!presenter) {
      presenter = api.createFramePresenter(HD_WORLD_RUNTIME);
      HD_WORLD_PRESENTERS.set(character, presenter);
    }
    const canvas = presenter.request(character, {
      direction: dir, frame: Number(frame) || 0,
      state: moving ? 'moving' : 'idle',
      rank: character.rank || character.gearRank || 'F'
    });
    if (!canvas) return null;
    const cached = HD_WORLD_SCALED.get(character);
    if (!cached || cached.source !== canvas) {
      const output = mkCanvas(24, 24), draw = output.getContext('2d');
      draw.imageSmoothingEnabled = false;
      draw.drawImage(canvas, 0, 0, 24, 24);
      HD_WORLD_SCALED.set(character, { source: canvas, output });
      return output;
    }
    return cached.output;
  } catch (error) {
    console.warn('HD character frame unavailable; using classic sprite', error);
    return null;
  }
}
const NPC_LOOK = { villager_0: 'villager0', villager_1: 'villager1', villager_2: 'villager2', villager_3: 'villager3', villager_4: 'guard', villager_5: 'merchant',
  elder_0: 'elder', elder_1: 'sage', elder_2: 'elder', elder_3: 'sage', elder_4: 'sage', elder_5: 'elder', hero_0: 'guard', hero_1: 'guard', hero_2: 'vanguard', hero_3: 'warden' };
const npcLook = s => NPC_LOOK[s] || 'villager0';
function npcMarker(e) {
  if (e.svc === 'elder') { const ch = chapterDef(); return ch && ch.type === 'talk' && ch.arg === 'elder' ? '!' : null; }
  const zid = G.map; const ch = chapterDef();
  if (ch && ch.type === 'talk' && ch.arg === 'zone' && regionOf(zid) === ch.region) return '!';
  const qs = sideQuestsFor(zid);
  if (qs.some(q => G.sideq[q.id] && G.sideq[q.id].state === 'ready')) return '?';
  if (qs.some(q => !G.sideq[q.id])) return '!';
  return null;
}

// ================================================================ interactions
const GATHER_CHECK = { herb: 'nature', mining: 'athletics', forestry: 'nature', hidecraft: 'survival', salvaging: 'investigation', relic: 'investigation', cultivation: 'nature', beast_lore: 'nature' };
function gatherProfessionNode(e) {
  const profession = e.profession || 'herb';
  const zl = (ZONE_BY_ID[G.map] && ZONE_BY_ID[G.map].lvl[1]) || G.lvl, mat = typeof gatherMaterial === 'function' ? gatherMaterial(profession, zl, G.prof[profession] || 1) : null;
  const item = mat && mat.slot > 0 ? mat.id : (e.item || e.herb);
  const nodes = G.nodes[G.map] || (G.nodes[G.map] = {});
  const skill = GATHER_CHECK[profession] || 'nature';
  const chk = skillCheck(G, skill, 8 + Math.floor(G.prof[profession] / 80) - perkVal(profession, 'check'));
  nodes[e.i] = G.stats.steps;
  let n = (chk.ok ? 2 : 1) + Math.floor(profTalentRank(profession, 'yield') / 24);
  if (R() < perkVal(profession, 'double')) n *= 2;
  const perkNote = perkAfterWork(profession);
  addItem(item, n); progressProfessionQuest(profession, 'gather', n); SFX.gather();
  const up = gainProf(profession, G.prof[profession]);
  if (profession === 'herb') questEvent('gather', item);
  const name = ITEMS[item]?.name || item.toUpperCase();
  toast(`+${n} ${name}`, perkNote || (up ? `${PROFS[profession]} ${G.prof[profession]}` : chk.text.slice(0, 22)), ITEMS[item]?.icon || 'item_herb', 'pickup');
}
function fightBoss(b) {
  const B = BOSS_BY_ID[b.id];
  const lvl = Math.max(B.lvl, ZONE_BY_ID[G.map].lvl[1] + 1);
  const mechs = (B.mechs || []).map(m => BOSS_MECH_DESC[m]).join(' ');
  choose(['FIGHT', 'LEAVE'], k => {
    if (k !== 0) return;
    const foe = makeMonster(B, lvl, G.difficulty, { bossId: B.id, cat: B.cat }); foe.name = B.name.slice(0, 16);
    const size = B.cat === 'world' ? Math.max(4, fieldPartySize()) : fieldPartySize();
    startBattle([foe], { size, music: B.cat === 'arc' ? 'arcboss' : 'boss', title: B.title || B.name });
  }, `${B.cat === 'arc' ? 'ARC BOSS' : 'WORLD BOSS'}: ${B.name}. LV${lvl}. ${mechs}`);
}
function simPlayerMenu(p) {
  const zone = ZONE_BY_ID[G.map];
  const canWorldPvp = !G.inst && !G.ghost && zone && !zone.town && GBQ_PVP.canAttack(
    { id: 'hero', pvpEnabled: G.pvpEnabled },
    { id: p.id, pvpEnabled: p.pvpEnabled },
    { sameFaction: G.pvpFaction === p.faction, safeZone: !!zone.town },
  );
  const actions = ['INSPECT', 'INVITE'].concat(canWorldPvp ? ['ATTACK'] : []).concat(['DUEL', 'WAVE', 'LEAVE']);
  choose(actions, k => {
    const action = actions[k];
    if (action === 'INSPECT') say(`${p.name} - LV${p.lvl} ${CLASSES[p.cls].name}${p.guild ? ` <${p.guild}>` : ''} / ${p.faction.toUpperCase()}`);
    if (action === 'INVITE') { if (G.companions.length >= Math.max(3, modeOf().size - 1)) return say('Your party is full.'); const c = makeAdventurer(p.cls, Math.min(G.lvl, p.lvl), p.name); G.companions.push(c); SFX.lfg_ready(); say(`${p.name} joins your party!`); }
    if (action === 'ATTACK') fightWorldPvp(p);
    if (action === 'DUEL') {
      const c = makeAdventurer(p.cls, Math.min(LEVEL_CAP, p.lvl), p.name);
      startBattle([adventurerFoe(c)], { size: 1, noFlee: true, kind: 'arena', noRewards: true, onEnd: (r, battle) => { restorePvpParty(battle); say(r === 'win' ? `${p.name}: GG! Well fought.` : `${p.name}: Better luck next time.`); } });
    }
    if (action === 'WAVE') { SFX.charm(); chatLog('Emote', G.name, `waves at ${p.name}.`); say(`${p.name} waves back.`); }
  }, `${p.name} LV${p.lvl}`);
}
// an NPC adventurer as a foe (arena / duels / mirror trial)
function adventurerFoe(c) {
  const D = derive(c);
  const m = makeMonster(BESTIARY[0], c.lvl, 2);
  Object.assign(m, { name: c.name, spr: heroPortrait(c) || `c_${c.cls}_4`, hp: D.hpMax, maxhp: D.hpMax, ac: D.ac, hit: D.weapon.hit, dc: D.spell ? D.spell.dc : 10, fam: 'humanoid', bestId: null, res: [], imm: [], vuln: [],
    attacks: [{ name: D.weapon.name, type: D.weapon.type, hit: D.weapon.hit, dice: `${D.weapon.dice}+${D.weapon.dmg}` }], multi: D.attacks, spells: D.spell ? D.spell.known.filter(s => s.eff === 'dmg' && s.lvl > 0).slice(-2).map(s => s.id) : [], xp: xpForMonster(c.lvl) * 2, gold: 10 + c.lvl * 3, pvp: true });
  return m;
}
function restorePvpParty(battle) {
  for (const unit of battle.party) {
    if (!unit.ch) continue;
    unit.ch.hp = Math.max(1, Math.ceil(derive(unit.ch).hpMax / 2));
    delete unit.ch.dying; delete unit.ch.stable; delete unit.ch.dead;
  }
}
function fightWorldPvp(opponent) {
  if (!GBQ_PVP.canAttack(
    { id: 'hero', pvpEnabled: G.pvpEnabled },
    { id: opponent.id, pvpEnabled: opponent.pvpEnabled },
    { sameFaction: G.pvpFaction === opponent.faction, safeZone: !!(ZONE_BY_ID[G.map] || {}).town },
  )) return say('Open-world PvP is unavailable: flag for PvP, leave the safe zone, and choose a rival.');
  const rival = makeAdventurer(CLASSES[opponent.cls] ? opponent.cls : 'warden', Math.max(1, Math.min(LEVEL_CAP, opponent.lvl)), opponent.name);
  startBattle([adventurerFoe(rival)], {
    size: 1, noFlee: true, kind: 'world-pvp', noRewards: true, title: `WAR MODE: ${opponent.name}`,
    onEnd: (result, battle) => {
      restorePvpParty(battle);
      if (result === 'win') {
        const defeats = G.pvpDefeats[opponent.id] || 0;
        const honor = GBQ_PVP.calculateHonor({ levelDifference: opponent.lvl - G.lvl, base: 20 + Math.floor(G.lvl / 2), repeatPenalty: defeats * 0.2 });
        G.pvpDefeats[opponent.id] = defeats + 1;
        G.honor += honor; G.stats.pvpKills++;
        checkAchievements();
        say(`Victory over ${opponent.name}! +${honor} honor.`);
      } else {
        G.stats.pvpDeaths++;
        say(`${opponent.name} wins the skirmish. Your honor is safe.`);
      }
      saveGame();
    },
  });
}

// ================================================================ NPC services
function npcService(e) {
  SFX.open();
  const svc = e.svc;
  if (svc === 'elder') return elderTalk();
  if (svc === 'warden') return wardenMenu(e);
  if (svc === 'vendor') return vendorMenu();
  if (svc === 'blacksmith') return smithMenu('blacksmith');
  if (svc === 'armorsmith') return smithMenu('armor');
  if (svc === 'weaponsmith') return smithMenu('weapon');
  if (svc === 'inn') return innMenu();
  if (svc === 'trainer') return trainerMenu();
  if (svc === 'auction') return push(new MarketScene());
  if (svc === 'mail') return mailMenu();
  if (svc === 'bank') return push(new StashScene());
  if (svc === 'housing') return push(new HousingScene(G.map));
  if (svc === 'guild') return guildMenu();
  if (svc === 'honor') return honorMenu();
  if (svc === 'lfg') return lfgMenu();
  if (svc === 'difficulty') return difficultyMenu();
  if (svc === 'tower') return towerMenu();
  if (svc === 'trials') return trialsMenu();
  if (svc === 'portal') return portalMenu();
  if (svc === 'server') return serverMenu();
  if (svc === 'stable') return stableMenu();
  if (svc === 'arena') return arenaMenu();
  if (svc === 'keep') return instanceMenu('dungeon', DUNGEONS[0]);
}
function elderTalk() {
  const ch = chapterDef();
  if (ch && ch.type === 'talk' && ch.arg === 'elder') {
    if (ch.i === 0) say(['ELDER MAE: You carry the last lantern. I knew it would choose someone.', 'The EMBER CODEX was torn into twelve pages. Each is held by a tyrant.', 'Goblins of KING GRUK raid our roads. Start there: drive them back, then find his keep to the north-east.', 'Take my blessing. Rest at the castle gate when hurt.'], () => questEvent('talk', 'elder'), { who: 'ELDER MAE' });
    else say(['ELDER MAE: You have them all. Twelve pages, one Codex.', 'Lift it, and let the sun remember AELMOOR.', 'The lantern flares... and dawn breaks across the land.'], () => { questEvent('talk', 'elder'); push(new Credits(true)); }, { who: 'ELDER MAE' });
    return;
  }
  say(['ELDER MAE: ' + (ch ? chapterGoal(ch) : 'The dawn is yours. The SPIRE and the far ISLES still call to heroes.')], null, { who: 'ELDER MAE' });
}
function wardenMenu(e) {
  const zid = G.map, qs = sideQuestsFor(zid), ch = chapterDef();
  const opts = ['QUESTS', 'SHORT REST', 'SPIRIT HEALER', 'LEAVE'];
  if (ch && ch.type === 'talk' && ch.arg === 'zone' && regionOf(zid) === ch.region) opts.unshift('STORY');
  choose(opts, k => {
    const o = opts[k];
    if (o === 'STORY') say([`${e.name}: You came. ${ch.line}`, 'Take this warning: the tyrant here guards a page of the Codex. Find the dungeon and the arc boss of this land.'], () => questEvent('talk', 'warden:' + ch.region), { who: e.name });
    if (o === 'QUESTS') push(new SideQuestBoard(zid, e.name));
    if (o === 'SHORT REST') { const log = shortRest(G); G.companions.forEach(c => shortRest(c)); SFX.heal(); say(['You rest for an hour.'].concat(log.length ? log : ['Nothing to recover.'])); }
    if (o === 'SPIRIT HEALER') { if (!G.ghost) return say('You are alive. No need.'); G.ghost = null; const D = derive(G); G.hp = Math.ceil(D.hpMax / 2); G.buffs = (G.buffs || []).concat([{ id: 'weakened', fights: 3 }]); SFX.revive(); say('You are resurrected, but WEAKENED for 3 fights.'); }
  }, `${e.name}: Well met, ${G.name}.`);
}
class SideQuestBoard {
  constructor(zid, who) { this.opaque = true; this.zid = zid; this.who = who; this.i = 0; }
  update() {
    const qs = sideQuestsFor(this.zid);
    if (nav('up')) { this.i = (this.i + qs.length - 1) % qs.length; SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % qs.length; SFX.cursor(); }
    if (P('b')) { removeScene(this); SFX.back(); return; }
    if (!P('a')) return;
    const q = qs[this.i], st = G.sideq[q.id];
    if (!st) {
      if (q.kind === 'check') { const r = skillCheck(G, 'persuasion', q.dc); G.sideq[q.id] = { state: r.ok ? 'ready' : 'active', prog: r.ok ? 1 : 0 }; say([q.text, r.text, r.ok ? 'They agree. Return for your reward.' : 'They are not convinced. Try again later (talk to me).']); return; }
      G.sideq[q.id] = { state: 'active', prog: 0 }; SFX.quest_accept(); say([`${this.who}: ${q.text}`, `Reward: ${fmt(q.xp)} XP, ${q.gold} G.`]);
    } else if (st.state === 'ready') turnInSide(q.id);
    else if (st.state === 'active' && q.kind === 'check') { const r = skillCheck(G, 'persuasion', q.dc); if (r.ok) { st.state = 'ready'; } say([r.text, r.ok ? 'Success!' : 'Still no.']); }
    else say(st.state === 'done' ? 'Already completed. Thank you!' : `In progress: ${st.prog}/${q.count}.`);
  }
  draw() {
    fill(0, 0, W, H, 0); frame(2, 2, 156, 140);
    text(`${this.who.slice(0, 22)}`, 7, 6, 2);
    const qs = sideQuestsFor(this.zid);
    qs.forEach((q, i) => { const y = 18 + i * 13, st = G.sideq[q.id]; if (i === this.i) fill(4, y - 2, 152, 12, 1); text(st ? (st.state === 'done' ? '#' : st.state === 'ready' ? '?' : '-') : '!', 7, y, st && st.state === 'ready' ? 'gold' : 3); text(q.name.slice(0, 22), 15, y); });
    const q = qs[this.i]; frame(4, 98, 152, 42); text(wrap(q.text, 24).slice(0, 3).join('\n'), 8, 102); text(`${fmt(q.xp)}XP ${q.gold}G`, 8, 131, 2);
  }
}
function previewVendorGear(item, price, onBuy) {
  const slot = itemSlot(item), current = derive(G), eq = { ...G.eq, [slot]: item };
  const target = derive({ ...G, eq });
  const delta = (a, b) => { const n = Math.round((b - a) * 10) / 10; return (n > 0 ? '+' : '') + n; };
  const setId = item.setId || item.set || item.template?.setId || item.template?.set;
  const gemSlots = typeof gemSocketCapacity === 'function' ? gemSocketCapacity(item) : 0;
  const runeSlots = typeof runeSocketCapacity === 'function' ? runeSocketCapacity(item) : 0;
  const maxDur = Number(item.maxDur ?? item.maxDurability), dur = Number(item.dur ?? item.durability);
  const durability = Number.isFinite(maxDur) && maxDur > 0 && Number.isFinite(dur)
    ? 'DUR ' + Math.max(0, Math.min(100, Math.round(dur / maxDur * 100))) + '%' : 'DUR N/A';
  const rows = [
    item.name + ' · ' + fmt(price) + ' G',
    'ILVL ' + (item.ilvl || 1) + ' · ' + (RARITY[item.rarity]?.name || 'COMMON') + ' · ' + (SLOT_NAME[slot] || slot).toUpperCase(),
    'SET ' + (setId || 'NONE') + ' · ' + durability,
    'GEMS ' + (item.sockets || []).filter(Boolean).length + '/' + gemSlots + ' · RUNES ' + (item.runeSockets || []).filter(Boolean).length + '/' + runeSlots + ' · ' + (item.attune ? 'ATTUNE' : 'NO ATTUNE'),
    ...legendarySetPreview(G, item).flatMap(set => set.thresholds.map(t => set.name + ' ' + t.pieces + 'PC ' + (t.newlyUnlocked ? 'NEW' : t.active ? 'ACTIVE' : 'LOCKED') + ': ' + t.stats.map(([k, v]) => k.toUpperCase() + ' +' + v).join(', '))),
    'CURRENT GOLD ' + fmt(G.gold) + ' · AFTER ' + fmt(G.gold - price),
    'AC ' + current.ac + ' → ' + target.ac + ' (' + delta(current.ac, target.ac) + ')',
    'ATK ' + current.weapon.hit + ' → ' + target.weapon.hit + ' (' + delta(current.weapon.hit, target.weapon.hit) + ')',
    'DMG ' + current.weapon.dice + '+' + current.weapon.dmg + ' → ' + target.weapon.dice + '+' + target.weapon.dmg,
    'HP ' + current.hpMax + ' → ' + target.hpMax + ' (' + delta(current.hpMax, target.hpMax) + ')',
    'CRIT ' + current.crit + '% → ' + target.crit + '%',
    'DODGE ' + current.dodge + '% → ' + target.dodge + '%',
    'BLOCK ' + current.block + '% → ' + target.block + '%',
    'LEECH ' + current.leech + '% → ' + target.leech + '%',
    'HASTE ' + current.haste + '% → ' + target.haste + '% · RESIST ' + current.resistAll + '% → ' + target.resistAll + '%',
    'A: CONFIRM PURCHASE · B: CANCEL'
  ];
  say(rows, () => choose(['BUY ' + fmt(price) + 'G', 'CANCEL'], k => {
    if (k !== 0) return;
    if (G.gold < price) return say('Not enough gold.');
    onBuy();
  }, 'Review the proposed gear before spending gold.'));
}

function vendorMenu() {
  const stock = ['potion', 'greater', 'antitoxin', 'ration', 'campkit', 'ether', 'scroll_mend', 'scroll_flame'].concat(ITEMS.repair_kit ? ['repair_kit'] : []).concat(G.lvl >= 10 ? ['superior', 'might', 'scroll_dawn'] : []).concat(G.lvl >= 30 ? ['supreme'] : []);
  const disc = G.daily.discount === new Date().toDateString() ? 0.9 : 1;
  choose(['BUY', 'BUY GEAR', 'SELL', 'SELL ALL JUNK', 'HAGGLE (CHA)', 'HEIRLOOMS', 'REPAIR ALL', 'GEM CUTTER', 'LEAVE'], k => {
    if (k === 7 && typeof gemCutterMenu === 'function') return gemCutterMenu();
    if (k === 0) choose(stock.map(s => `${ITEMS[s].name.slice(0, 14)} ${Math.round(ITEMS[s].price * disc)}G`), i => { if (i < 0) return; const s = stock[i], p = Math.round(ITEMS[s].price * disc); if (G.gold < p) { SFX.error(); return say('Not enough gold.'); } G.gold -= p; addItem(s); SFX.buy(); vendorMenu(); }, `Gold: ${fmt(G.gold)}`);
    if (k === 1) { const items = [0, 1, 2, 3].map(i => makeItem({ lvl: G.lvl, rarity: i < 2 ? 1 : 2, kind: i === 3 ? 'wondrous' : i % 2 ? 'armor' : 'weapon' })); choose(items.map(it => `${it.name.slice(0, 14)} ${fmt(it.value * 2)}G`), i => { if (i < 0) return; const it = items[i], price = it.value * 2; previewVendorGear(it, price, () => { G.gold -= price; addGear(it); SFX.buy(); say(`Purchased ${it.name}.`); }); }, 'Fresh stock from the forge.'); }
    if (k === 2) push(new InventoryScene('sell'));
    if (k === 5 && typeof HeirloomScene === 'function') push(new HeirloomScene({ vendor: true }));
    if (k === 6 && typeof repairMenu === 'function') repairMenu();
    if (k === 3) { const stackKeys = Object.keys(G.inv).filter(key => ITEMS[key] && ITEMS[key].type === 'junk' && G.inv[key] > 0); const gear = G.bag.filter(it => it.rarity === 0 && !it.fav); const estimate = stackKeys.reduce((sum, key) => sum + ITEMS[key].price * G.inv[key], 0) + gear.reduce((sum, it) => sum + it.value, 0); if (!estimate) return say('No sellable junk in your inventory.'); say(['SELL ALL JUNK?', 'Estimated proceeds: ' + fmt(estimate) + ' G.', 'Poor gear and junk materials will be removed.'], () => choose(['SELL JUNK', 'CANCEL'], confirm => { if (confirm !== 0) return; let g = 0; for (const key of stackKeys) { g += ITEMS[key].price * G.inv[key]; delete G.inv[key]; } G.bag = G.bag.filter(it => { if (it.rarity === 0 && !it.fav) { g += it.value; return false; } return true; }); G.gold += g; SFX.sell(); say('Sold junk for ' + g + ' G.'); }, 'Confirm merchant sale.')); }
    if (k === 4) { if (G.daily.haggle === new Date().toDateString()) return say('The merchant will not haggle again today.'); G.daily.haggle = new Date().toDateString(); const r = skillCheck(G, 'persuasion', 13); if (r.ok) G.daily.discount = new Date().toDateString(); say([r.text, r.ok ? '10% discount for today!' : 'The merchant shrugs. Prices stay.']); }
  }, 'MERCHANT: What will it be?');
}
function smithMenu(kind) {
  if (kind === 'blacksmith') {
    const tier = blacksmithTier(G.lvl);
    return choose(['REINFORCE GEAR', 'SELL GEAR', 'LEAVE'], k => {
      if (k === 0) smithUpgradeMenu(tier);
      if (k === 1) push(new InventoryScene('sell'));
    }, `${tier.name} BLACKSMITH TIER ${tier.tier}. ${tier.tier < 3 ? `NEXT TIER AT LV${BLACKSMITH_TIERS[tier.tier].level}.` : 'MY BEST WORK.'}`);
  }
  const label = kind === 'armor' ? 'ARMORSMITH' : 'WEAPONSMITH';
  if (G.lvl < 20) return say(`${label} services unlock at player level 20.`);
  return choose([`BUY ${kind === 'armor' ? 'ARMOUR' : 'WEAPONS'}`, `SELL ${kind === 'armor' ? 'ARMOUR' : 'WEAPONS'}`, 'LEAVE'], k => {
    if (k === 0) smithBuyMenu(kind);
    if (k === 1) smithSellMenu(kind);
  }, `${label}: Properly fitted, properly forged.`);
}
function smithBuyMenu(kind) {
  const catalog = kind === 'armor' ? ARMORS : WEAPONS;
  const bases = Object.keys(catalog);
  const rarity = Math.min(5, 1 + Math.floor(Math.max(0, G.lvl - 1) / 40));
  const stock = Array.from({ length: 6 }, () => makeItem({ kind, base: pick(bases), lvl: G.lvl, rarity }));
  choose(stock.map(it => `${it.name.slice(0, 15)} ${fmt(it.value * 2)}G`), index => {
    if (index < 0) return;
    const item = stock[index], price = item.value * 2;
    if (G.gold < price) return say('Not enough gold.');
    previewVendorGear(item, price, () => { G.gold -= price; addGear(item); const profession = kind === 'armor' ? 'armorsmith' : 'weaponsmith'; gainProf(profession); progressProfessionQuest(profession, 'trade'); SFX.buy(); say(`Purchased ${item.name}.`); });
  }, `GOLD ${fmt(G.gold)}. Stock is fitted to your level.`);
}
function smithSellMenu(kind) {
  const gear = G.bag.filter(item => item.kind === kind && !item.heirloom); // heirlooms are soulbound
  if (!gear.length) return say(`You have no ${kind === 'armor' ? 'armour' : 'weapons'} to sell.`);
  choose(gear.map(item => `${item.name.slice(0, 18)} ${fmt(item.value)}G`), index => {
    if (index < 0) return;
    const item = gear[index], bagIndex = G.bag.indexOf(item);
    if (bagIndex < 0) return;
    G.bag.splice(bagIndex, 1); G.gold += item.value; const profession = kind === 'armor' ? 'armorsmith' : 'weaponsmith'; gainProf(profession); progressProfessionQuest(profession, 'trade'); SFX.sell(); say(`Sold ${item.name} for ${fmt(item.value)} G.`);
  }, `GOLD ${fmt(G.gold)}. Selling ${kind === 'armor' ? 'armour' : 'weapons'}.`);
}
function smithUpgradeMenu(tier) {
  const gear = G.bag.filter(item => ['weapon', 'armor', 'wondrous'].includes(item.kind) && item.rarity <= tier.maxRarity);
  if (!gear.length) return say('Bring me a weapon, armour or accessory to reinforce.');
  choose(gear.map(item => `${item.name.slice(0, 17)} +${item.plus}`), index => {
    if (index < 0) return;
    const item = gear[index], cap = MAX_PLUS[item.rarity] ?? item.rarity;
    if (item.plus >= cap) return say(`${item.name} has reached its reinforcement limit (+${cap}).`);
    const rank = Math.max(0, item.plus) + 1, efficiency = profTalentRank('blacksmith', 'efficiency');
    const cost = { scrap: Math.max(1, rank * 3 - Math.floor(efficiency / 24)), shard: item.rarity >= 3 ? Math.max(1, rank - Math.floor(efficiency / 48)) : 0, ember: item.rarity >= 5 ? Math.max(0, rank - 3) : 0, gold: Math.max(1, Math.floor(50 * rank * Math.max(1, Math.floor(item.ilvl / 5)) * (1 - Math.min(0.5, efficiency / 480)))) };
    const needs = Object.entries(cost).filter(([key, amount]) => key !== 'gold' && amount > 0).map(([key, amount]) => `${amount} ${ITEMS[key].name}`).concat(`${fmt(cost.gold)} G`);
    if ((G.inv.scrap || 0) < cost.scrap || (G.inv.shard || 0) < cost.shard || (G.inv.ember || 0) < cost.ember || G.gold < cost.gold) {
      return say(['Not enough materials.', `Need ${needs.join(', ')}.`, `Have ${G.inv.scrap || 0} scrap, ${G.inv.shard || 0} shards, ${G.inv.ember || 0} embers, ${fmt(G.gold)} G.`]);
    }
    choose(['TEMPER ITEM', 'CANCEL'], confirm => {
      if (confirm !== 0) return;
      for (const material of ['scrap', 'shard', 'ember']) for (let n = 0; n < cost[material]; n++) takeItem(material);
      G.gold -= cost.gold; item.plus++; item.value = Math.round(item.value * 1.3); gainProf('blacksmith'); progressProfessionQuest('blacksmith', 'reinforce');
      SFX.levelup(); say(`${item.name} is now +${item.plus}.`);
    }, `REINFORCE ${item.name.slice(0, 16)}?\n${needs.join(', ')}`);
  }, `${tier.name} TIER: REINFORCES ${RARITY[tier.maxRarity].name.toLowerCase()} GEAR OR LOWER. Materials come from salvaging gear.`);
}
function innMenu() {
  const price = 5 + Math.floor(G.lvl / 2);
  choose([`LONG REST (${price}G)`, 'SET HEARTH HERE', 'HIRE COMPANION', 'DISMISS COMPANION', 'COMPANION BOARD', 'PARTY', 'LEAVE'], k => {
    if (k === 4) return companionBoard();
    if (k === 5) return push(new CompanionScene());
    if (k === 0) { if (G.gold < price) return say('Not enough gold.'); G.gold -= price; longRest(G); G.companions.forEach(longRest); G.ghost = null; Music.play('inn'); SFX.heal(); saveGame(); say(['You sleep soundly. HP, hit dice and spell slots restored.', 'Game saved.']); }
    if (k === 1) { G.hearth = { map: G.map, x: G.x, y: G.y + 1 }; SFX.confirm(); say('Your hearthstone is bound here.'); }
    if (k === 2) { const max = Math.max(3, modeOf().size - 1); if (G.companions.length >= max) return say(`Your party is full (${max}).`); choose(['TANK', 'HEALER', 'DAMAGE'], r => { if (r < 0) return; const c = hireCompanion(['tank', 'healer', 'dps'][r]); SFX.lfg_ready(); say(`${c.name} the ${CLASSES[c.cls].name} joins you!`); }, 'Which role?'); }
    if (k === 3) { if (!G.companions.length) return say('No companions.'); choose(G.companions.map(c => `${c.name} ${CLASSES[c.cls].name.slice(0, 8)}`), i => { if (i >= 0) { G.companions.splice(i, 1); SFX.back(); } }); }
  }, 'INNKEEPER: A warm bed and good company.');
}
function trainerMenu() {
  choose(['SPEND POINTS', 'CHANGE SUBCLASS (100G)', 'RIDING (STABLE, LV15)', 'PROFESSION TREES', 'PROFESSION PERKS', 'PROFESSION QUESTS', 'LEAVE'], k => {
    if (k === 0) push(new GrowthScene());
    if (k === 1) { if (classLevel(G) < 3) return say('Subclasses unlock at level 3.'); if (G.gold < 100) return say('Not enough gold.'); G.gold -= 100; G.sub = null; G.pending.sub = true; push(new GrowthScene()); }
    if (k === 2) { if (G.hasMount) return say('You already ride. Visit a stablemaster for more mounts.'); return say(['Riding is taught by the STABLEMASTER in Ardenhold.', 'Come at level 15 for your first mount.']); }
    if (k === 3) push(new ProfessionTreeScene());
    if (k === 4) push(new PerkTreeScene());
    if (k === 5) push(new ProfessionQuestScene());
  }, 'TRAINER: Knowledge is power.');
}
function mailMenu() {
  if (!G.mail.length) return say('Your mailbox is empty.');
  const m = G.mail.shift(); if (m.gold) G.gold += m.gold; if (m.item) addGear(m.item); if (m.stack && ITEMS[m.stack.id]) addItem(m.stack.id, m.stack.n); SFX.mail();
  say([`FROM ${m.from}: ${m.text}`, m.gold ? `+${m.gold} G` : m.item ? `Received ${m.item.name}` : m.stack && ITEMS[m.stack.id] ? `Received ${ITEMS[m.stack.id].name} x${m.stack.n}` : '']);
}
function guildMenu() {
  if (G.guild) return choose(['ROSTER', 'LEAVE GUILD', 'BACK'], k => { if (k === 0) say([`<${G.guild}>`, `Members: ${G.name}, ${SIM_NAMES.slice(0, 5).join(', ')}`]); if (k === 1) { G.guild = null; SFX.back(); } }, `<${G.guild}>`);
  choose(GUILD_NAMES.map(n => `JOIN <${n}>`).concat(['CREATE (100G)']), k => {
    if (k < 0) return;
    if (k < GUILD_NAMES.length) { G.guild = GUILD_NAMES[k]; } else { if (G.gold < 100) return say('Not enough gold.'); G.gold -= 100; G.guild = `${G.name}'S BAND`.slice(0, 16); }
    SFX.achievement(); checkAchievements(); say(`Welcome to <${G.guild}>!`); chatLog('Guild', 'GUILDMASTER', `${G.name} has joined the guild!`);
  }, 'GUILDMASTER: Strength in numbers.');
}
function honorMenu() {
  const items = [[150, 3, 'weapon'], [150, 3, 'armor'], [250, 4, 'weapon'], [250, 4, 'armor'], [200, 3, 'wondrous']];
  choose([`WAR MODE: ${G.pvpEnabled ? 'PVP' : 'PVE'}`, 'BATTLEGROUNDS', 'RANKED ARENA', 'HONOR GEAR', 'LEAVE'], k => {
    if (k === 0) {
      G.pvpEnabled = !G.pvpEnabled;
      saveGame(); SFX.confirm();
      say(G.pvpEnabled ? 'PvP flag raised. You can attack flagged rivals outside safe zones. Return here to opt out.' : 'PvP flag lowered. Open-world attacks are disabled.');
    }
    if (k === 1) battlegroundMenu();
    if (k === 2) arenaMenu();
    if (k === 3) choose(items.map(([c, r, kd]) => `${RARITY[r].name} ${kd.toUpperCase()} ${c}H`), i => {
      if (i < 0) return; const [c, r, kd] = items[i];
      if (G.honor < c) return say(`Need ${c} honor (you have ${G.honor}).`);
      G.honor -= c; const it = makeItem({ lvl: G.lvl, rarity: r, kind: kd }); it.name = 'GLADIATOR ' + it.name.replace(/^\+\d /, ''); addGear(it); SFX.buy(); saveGame();
    }, `QUARTERMASTER: Honor: ${G.honor}`);
  }, `QUARTERMASTER: Honor ${G.honor} / Rating ${G.rating}`);
}
function difficultyMenu() {
  choose(DIFFICULTY.map(d => `${d.n} ${d.name}${diffUnlocked(d.n) ? '' : ` (LV${d.req})`}`), i => {
    if (i < 0) return; if (!diffUnlocked(i + 1)) { SFX.error(); return say(`Unlocks at level ${DIFFICULTY[i].req}.`); }
    G.difficulty = i + 1; SFX.confirm(); const d = DIFFICULTY[i];
    say(`Difficulty ${d.n}: ${d.name}. Monsters +${d.lvl} LV, HP x${d.hp}, XP x${d.xp}, loot x${d.loot}.`);
  }, `ORACLE: Current: ${diffOf().name}`, { start: G.difficulty - 1 });
}
function stableMenu() {
  choose(['BUY RAPTOR (300G)', 'LEAVE'], k => { if (k === 0) trainerMenu(); }, 'STABLEMASTER: Fine mounts here.');
}
function portalMenu() {
  const opts = [{ name: 'ELDERWOOD', z: 'elderwood' }, { name: 'ARDENHOLD', z: 'ardenhold' }].concat(EXPANSIONS.map(x => ({ name: `${x.name} LV${x.lvl[0]}`, z: `${x.id}_0`, need: x.lvl[0] - 5 })));
  choose(opts.map(o => o.name.slice(0, 22)), i => {
    if (i < 0) return; const o = opts[i];
    if (o.need && G.lvl < o.need) return say(`The ship captain refuses: reach level ${o.need} first.`);
    travelTo(o.z);
  }, 'HARBORMASTER: Where to?');
}
function travelTo(zid, x, y) {
  const m = buildZoneCached(zid);
  SFX.waypoint();
  fadeTo(() => { G.inst = null; G.map = zid; G.x = x != null ? x : m.hub[0]; G.y = y != null ? y : m.hub[1] + 1; G.mounted = false; if (FIELD) FIELD.reload(); });
}
class WaypointMenu {
  constructor() { const ids = Object.keys(G.waypoints).filter(id => ZONE_BY_ID[id]); this.ids = ids; }
  update() {}
  enter() {
    removeScene(this);
    choose(this.ids.map(id => ZONE_BY_ID[id].name.slice(0, 20)), i => { if (i >= 0) travelTo(this.ids[i], buildZoneCached(this.ids[i]).poi.waypoint ? buildZoneCached(this.ids[i]).poi.waypoint.x : null, buildZoneCached(this.ids[i]).poi.waypoint ? buildZoneCached(this.ids[i]).poi.waypoint.y + 1 : null); }, 'WAYPOINT: fast travel');
  }
  draw() {}
}
function serverMenu() {
  const svs = NET.servers();
  const opts = [NET.server ? 'STOP HOSTING' : 'HOST SERVER', `JOIN SERVER (${svs.length})`, NET.hostOf ? 'LEAVE SERVER' : null, `PLAY MODE: ${modeOf().name}`, 'LIVE PLAYERS'].filter(Boolean);
  choose(opts, k => {
    const o = opts[k]; if (!o) return;
    if (o === 'HOST SERVER') { if (!NET.room) return say('Live multiplayer needs this page open in Claude with the room connected. Status: ' + (NET.status || 'OFFLINE')); NET.hostServer(); say([`Server "${NET.server.name}" is online.`, 'Friends who open this page can JOIN from their REALM STONE. They fight in your party (host runs every battle).']); }
    else if (o === 'STOP HOSTING') { NET.stopServer(); say('Server stopped.'); }
    else if (o.startsWith('JOIN')) { if (!svs.length) return say('No servers found. Ask a friend to HOST.'); choose(svs.map(s => `${s.name} (${s.players})`), i => { if (i >= 0) NET.joinServer(svs[i].peer); }); }
    else if (o === 'LEAVE SERVER') { NET.hostOf = null; say('You left the server.'); }
    else if (o.startsWith('PLAY MODE')) choose(PLAY_MODES.map(m => m.name + ': ' + m.desc.slice(0, 10)), i => { if (i >= 0) { G.playMode = PLAY_MODES[i].id; SFX.confirm(); say(`${PLAY_MODES[i].name}: ${PLAY_MODES[i].desc}`); } });
    else if (o === 'LIVE PLAYERS') say(NET.peers.length ? NET.peers.map(p => `${clean((p.presence || {}).n || 'HERO')} LV${(p.presence || {}).l || '?'} @${((ZONE_BY_ID[(p.presence || {}).z] || { name: '?' }).name).slice(0, 10)}`) : ['No other live players right now.']);
  }, `REALM STONE  [${NET.status || 'OFFLINE'}]`);
}
function arenaMenu() {
  choose(['RANKED 1V1', 'TEAM 3V3', 'LEAVE'], k => {
    if (k < 0 || k === 2) return;
    const n = k === 0 ? 1 : 3;
    const foes = Array.from({ length: n }, () => adventurerFoe(makeAdventurer(pick(CLASS_ORDER), Math.max(1, G.lvl + R() * 2 - 1 | 0), pick(SIM_NAMES))));
    startBattle(foes, { size: n, noFlee: true, kind: 'arena', noRewards: true, music: 'boss', onEnd: (r, battle) => {
      restorePvpParty(battle);
      if (r === 'win') { const h = GBQ_PVP.calculateHonor({ base: 20 + G.lvl }); G.honor += h; G.rating += 18; G.stats.pvpWins++; say(`Victory! +${h} honor. Rating ${G.rating}.`); checkAchievements(); saveGame(); }
      else if (r === 'lose') { G.rating = Math.max(0, G.rating - 12); G.stats.pvpDeaths++; G.hp = 1; say(`Defeat. Rating ${G.rating}.`); saveGame(); }
    } });
  }, `ARENA  Rating ${G.rating}  Honor ${G.honor}`);
}
function battlegroundMenu() {
  const modes = Object.values(GBQ_PVP.battlegroundModes);
  choose(modes.map(m => `${m.name.toUpperCase()}  ${m.teamSize}V${m.teamSize}`), i => {
    if (i < 0) return;
    const mode = modes[i], match = GBQ_PVP.createBattleground(mode.id);
    say([`${mode.name}: ${mode.objective}.`, `First team to ${match.targetScore} captures wins. Battles use your companions and simulated rivals.`], () => runBattlegroundRound(match));
  }, 'BATTLEGROUND QUEUE');
}
function runBattlegroundRound(match) {
  const mode = GBQ_PVP.battlegroundModes[match.modeId];
  const objectiveId = match.objectives[match.captured.length];
  const foes = Array.from({ length: match.teamSize }, () => {
    const level = Math.max(1, Math.min(LEVEL_CAP, G.lvl + (R() < 0.5 ? 0 : 1)));
    const rival = makeAdventurer(pick(CLASS_ORDER), level, pick(SIM_NAMES));
    return adventurerFoe(rival);
  });
  startBattle(foes, {
    size: match.teamSize, noFlee: true, kind: 'battleground', noRewards: true, music: 'boss',
    title: `${mode.name}: ${objectiveId}`,
    onEnd: (result, battle) => {
      restorePvpParty(battle);
      const team = result === 'win' ? 'blue' : 'red';
      if (result !== 'win') G.stats.pvpDeaths++;
      const score = GBQ_PVP.captureBattlegroundObjective(match, { team, objectiveId });
      saveGame();
      if (score.status === 'complete') {
        if (score.winner === 'blue') {
          const honor = GBQ_PVP.calculateHonor({ base: 100 + G.lvl });
          G.honor += honor; G.stats.pvpWins++; G.stats.battlegroundWins++;
          checkAchievements();
          say(`${mode.name} victory! ${score.score.blue}-${score.score.red}. +${honor} honor.`);
        } else if (score.winner === 'red') {
          say(`${mode.name} lost ${score.score.blue}-${score.score.red}. Regroup and queue again.`);
        } else {
          say(`${mode.name} ends in a draw, ${score.score.blue}-${score.score.red}.`);
        }
        saveGame();
        return;
      }
      say([`${objectiveId}: ${result === 'win' ? 'captured' : 'lost'}.`, `Score ${score.score.blue}-${score.score.red}. Continue to the next objective?`], () => runBattlegroundRound(match));
    },
  });
}
function lfgMenu() {
  const dgs = DUNGEONS.filter(d => d.lvl <= G.lvl + 6), rds = RAIDS.filter(r => r.lvl <= G.lvl + 6);
  const opts = dgs.map(d => ({ t: `DG ${d.name} ${d.lvl}`, k: 'dungeon', d })).concat(rds.map(r => ({ t: `RAID ${r.name} ${r.lvl}`, k: 'raid', d: r })));
  if (!opts.length) return say('Nothing available yet. Reach level 2.');
  choose(opts.map(o => o.t.slice(0, 22)), i => { if (i >= 0) instanceMenu(opts[i].k, opts[i].d); }, 'LOOKING FOR GROUP');
}

function worldEventWindow(event, now = Date.now()) {
  const epoch = Date.UTC(2026, 0, 1);
  const period = event.periodMinutes * 60000;
  const offset = event.offsetMinutes * 60000;
  const duration = event.durationMinutes * 60000;
  const cycle = Math.floor((now - epoch - offset) / period);
  let startsAt = epoch + cycle * period + offset;
  if (startsAt + duration <= now) startsAt += period;
  const endsAt = startsAt + duration;
  return { startsAt, endsAt, status: now >= startsAt && now < endsAt ? 'active' : 'upcoming' };
}
function worldEventMenu(event) {
  const window = worldEventWindow(event);
  const here = G.map === event.zone && !G.inst;
  const label = window.status === 'active' ? (here ? 'JOIN EVENT' : 'TRAVEL TO ZONE') : 'TRAVEL TO ZONE';
  const starts = window.status === 'active' ? 'ACTIVE NOW' : `STARTS IN ${Math.max(1, Math.ceil((window.startsAt - Date.now()) / 60000))} MIN`;
  choose([label, 'TRACK EVENT', 'BACK'], choice => {
    if (choice === 0) {
      if (!here) { G.trackedEvent = event.id; return travelTo(event.zone); }
      if (window.status !== 'active') return say(`${event.name} is not active yet. ${starts}.`);
      return startWorldEvent(event);
    }
    if (choice === 1) { G.trackedEvent = event.id; return say([`TRACKING: ${event.name}`, `${ZONE_BY_ID[event.zone].name} - ${starts}`]); }
  }, `${event.name}: ${starts}`);
}
function startWorldEvent(event) {
  const window = worldEventWindow(event);
  if (G.map !== event.zone || G.inst) return say('Travel to the event zone before joining.');
  if (window.status !== 'active') return say(`${event.name} is not active yet.`);
  G.eventDaily = G.eventDaily || {};
  const day = Math.floor(Date.now() / 86400000);
  if (G.eventDaily[event.id] === day) return say('You have already claimed this event reward today.');
  const boss = BOSSES.find(entry => entry.unique === event.boss);
  if (!boss) return say('This event encounter is unavailable.');
  const level = Math.max(event.lvl, G.lvl);
  const foe = makeMonster(boss, level, G.difficulty, { bossId: boss.id, cat: boss.cat });
  startBattle([foe], {
    size: Math.max(1, Math.min(4, fieldPartySize())),
    kind: 'world-event',
    music: 'boss',
    onEnd: result => {
      if (result === 'lose') return onPartyWipe();
      if (result !== 'win') return;
      G.eventDaily[event.id] = day;
      gainXP(G, xpForMonster(level) * 3);
      G.gold += event.rewardGold;
      saveGame();
      checkAchievements();
      say([`${event.name} COMPLETE!`, `+${event.rewardGold} G and bonus experience.`]);
    },
  });
}

// ================================================================ instances: dungeons, raids, tower
function instanceMenu(kind, def) {
  const size = kind === 'raid' ? 12 : 4;
  choose([`ENTER (GROUP OF ${size})`, `ENTER SOLO`, `DIFFICULTY: ${diffOf().name}`, 'LEAVE'], k => {
    if (k === 2) return difficultyMenu();
    if (k !== 0 && k !== 1) return;
    if (kind === 'raid' && G.raidWeek[def.id] === weekKey()) return say('You are locked to this raid until the weekly reset.');
    enterInstance(kind, def, 0, k === 0 ? size : 1);
  }, `${def.name} - LV${def.lvl}`);
}
const weekKey = () => { const d = new Date(); return `${d.getFullYear()}-${Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 6048e5)}`; };
function enterInstance(kind, def, floor, size) {
  const map = buildInstance(kind, def, floor);
  SFX.door(); Music.stop();
  fadeTo(() => {
    const ret = G.inst ? G.inst.return : { map: G.map, x: G.x, y: G.y };
    G.inst = { kind, def, floor, map, difficulty: map.difficulty || G.difficulty, cleared: [], chest: false, size, return: ret };
    G.x = map.entry.x; G.y = map.entry.y; G.mounted = false;
    if (FIELD) FIELD.reload();
    toast(map.name, kind === 'tower' ? `F${floor}/100 ${map.mod && map.mod.id !== 'none' ? map.mod.name : ''}` : `${map.roomCount || map.rooms.length} ROOMS TIER ${map.difficulty} GROUP ${size}`, kind === 'tower' ? 'px_tower' : 'item_key', 'stairs');
  });
}
function fightPull(p) {
  const inst = G.inst;
  const difficulty = p.difficulty || inst.difficulty || G.difficulty;
  let foes;
  if (p.boss) { const B = BOSS_BY_ID[p.boss]; const f = makeMonster(B, p.lvl, difficulty, { bossId: B.id, cat: B.cat }); f.name = B.name.slice(0, 16); foes = [f]; }
  else foes = p.mobs.map(id => makeMonster(BEAST_BY_ID[id] || BESTIARY[0], p.lvl, difficulty));
  if (p.elite) foes.forEach(f => { f.elite = true; f.maxhp = Math.round(f.maxhp * 1.5); f.hp = f.maxhp; f.name = ((p.miniboss ? 'MINI ' : 'ELITE ') + f.name).slice(0, 16); });
  applyFloorMod(foes, inst.map.mod);
  startBattle(foes, { size: inst.size, kind: inst.kind, diff: difficulty, music: p.boss ? (p.final ? 'arcboss' : 'boss') : 'battle', onEnd: r => {
    if (r === 'lose') return onPartyWipe();
    if (r !== 'win') return;
    inst.cleared.push(p.id); updateSeals(inst); checkAchievements();
    if (inst.kind === 'trial' && !p.final) { const nx = instVisiblePulls(inst)[0]; if (nx) toast('NEXT WAVE', nx.boss ? 'A CHAMPION ENTERS' : 'FOES POUR IN', 'px_skull', 'boss_appear'); }
    if (p.final) {
      if (inst.kind === 'dungeon') { G.stats.dungeons++; questEvent('dungeon', inst.def.id); toast('DUNGEON CLEARED', inst.def.name, 'item_chest', 'quest_done'); }
      if (inst.kind === 'raid') { G.stats.raids++; G.raidWeek[inst.def.id] = weekKey(); questEvent('raid', inst.def.id); toast('RAID CLEARED', inst.def.name, 'px_crown', 'act_complete'); }
      checkAchievements();
    }
    if (inst.kind === 'tower' && p.boss) { G.towerBest = Math.max(G.towerBest, inst.floor); NET.publishHero(); checkAchievements(); }
    if (p.boss && inst.size > 1 && R() < 0.6) push(new LootRoll(makeItem({ lvl: p.lvl, boss: true, mf: derive(G).mf, loot: DIFFICULTY[difficulty - 1].loot }), inst.size));
  } });
}
function openInstanceChest() {
  const inst = G.inst;
  if (!inst.cleared.some(id => inst.map.pulls.find(p => p.id === id && p.final)) && inst.kind !== 'tower' && inst.map.pulls.some(p => p.final)) return say('The chest is sealed by a powerful ward. Defeat the final boss.');
  inst.chest = true; SFX.chest();
  const tier = inst.difficulty || G.difficulty, loot = DIFFICULTY[tier - 1].loot;
  const it = makeItem({ lvl: inst.map.lvl + 2, mf: derive(G).mf, loot, rarity: Math.max(2, rollRarity(inst.map.lvl, derive(G).mf)) });
  addGear(it); const g = Math.round((20 + inst.map.lvl * 8) * loot); G.gold += g;
  say([`The chest holds ${g} G and:`, `[${RARITY[it.rarity].name}] ${it.name}`]);
}
function leaveInstance() {
  choose(['LEAVE', 'STAY'], k => { if (k !== 0) return; const r = G.inst.return; fadeTo(() => { G.inst = null; G.map = r.map; G.x = r.x; G.y = r.y + 1; FIELD.reload(); safeSpot(); }); }, 'Leave the instance? Progress resets.');
}
function towerMenu() {
  const cps = [1]; for (let f = 10; f <= Math.min(100, G.towerBest + 1); f += 10) if (f <= G.towerBest + 1) cps.push(f);
  choose(cps.map(f => `START FLOOR ${f}`).concat([`BEST: ${G.towerBest}F`]), i => {
    if (i < 0 || i >= cps.length) return;
    enterInstance('tower', { id: 'tower', name: TOWER.name, lvl: TOWER.baseLvl, theme: ['void', 'crypt', 'lava', 'ice', 'temple'][Math.floor(cps[i] / 20) % 5] }, cps[i], Math.max(1, Math.min(4, fieldPartySize())));
  }, `${TOWER.name}: 100 floors. Boss every 5th.`);
}
function towerNext() {
  const inst = G.inst;
  const bossLeft = inst.map.pulls.some(p => p.boss && !inst.cleared.includes(p.id));
  if (bossLeft) return say('The stairs are sealed. Defeat this floor\'s guardian.');
  G.towerBest = Math.max(G.towerBest, inst.floor);
  if (inst.floor >= TOWER.floors) { checkAchievements(); return say(['You stand atop the SPIRE OF A HUNDRED.', 'The whole of AELMOOR glitters below. LEGEND.']); }
  const def = Object.assign({}, inst.def, { theme: ['void', 'crypt', 'lava', 'ice', 'temple'][Math.floor((inst.floor + 1) / 20) % 5] });
  enterInstance('tower', def, inst.floor + 1, inst.size);
}

// ================================================================ trials (boss rush etc)
function trialsMenu() {
  choose(TRIALS.map(t => `${t.name.slice(0, 18)} ${t.lvl}`), i => {
    if (i < 0) return; const t = TRIALS[i];
    choose(['BEGIN', 'BACK'], k => { if (k === 0) runTrial(t, 0); }, `${t.name}: ${t.desc}`);
  }, 'TRIALS MASTER: Prove yourself.');
}
function runTrial(t, stage) {
  const bosses = BOSSES.filter(b => b.where === t.id).sort((a, b) => a.order - b.order);
  const lvl = Math.max(t.lvl, G.lvl) + stage;
  let foes;
  if (t.rule === 'waves') foes = Array.from({ length: 3 }, () => makeMonster(pick(BESTIARY), lvl - 1, G.difficulty));
  else if (t.rule === 'mirror') foes = [adventurerFoe(makeAdventurer(G.cls, G.lvl, 'MIRROR ' + G.name.slice(0, 8)))];
  else { const B = bosses[stage % bosses.length]; const f = makeMonster(B, lvl, G.difficulty, { bossId: B.id, cat: 'trial' }); f.name = B.name.slice(0, 16); foes = [f]; }
  const stages = t.rule === 'waves' ? 10 : t.rule === 'mirror' ? 3 : 5;
  startBattle(foes, { size: t.rule === 'solo' || t.rule === 'mirror' ? 1 : Math.min(4, fieldPartySize()), kind: 'trial', rule: t.rule, noFlee: true, music: 'boss', onEnd: r => {
    if (r !== 'win') { G.hp = Math.max(1, G.hp); return say(`Trial failed at stage ${stage + 1}.`); }
    if (stage + 1 >= stages) { G.stats.trials++; const it = makeItem({ lvl: lvl + 2, rarity: 4 }); addGear(it); checkAchievements(); return say([`${t.name} COMPLETE!`, `Reward: ${it.name}`]); }
    if (t.rule !== 'rush') { const D = derive(G); G.hp = Math.min(D.hpMax, G.hp + Math.ceil(D.hpMax * 0.3)); }
    say(`Stage ${stage + 1}/${stages} cleared! Next...`, () => runTrial(t, stage + 1));
  } });
}

// ================================================================ need / greed loot roll
class LootRoll {
  constructor(item, size) { this.opaque = false; this.it = item; this.size = size; this.i = 0; this.res = null; }
  update() {
    if (this.res) { if (P('a') || P('b')) { removeScene(this); } return; }
    if (nav('left') || nav('up')) { this.i = (this.i + 2) % 3; SFX.cursor(); }
    if (nav('right') || nav('down')) { this.i = (this.i + 1) % 3; SFX.cursor(); }
    if (P('a')) {
      const mine = this.i === 2 ? 0 : (this.i === 0 ? 100 : 0) + roll('1d100').total;
      const others = Array.from({ length: Math.min(4, this.size - 1) }, () => ({ n: pick(SIM_NAMES), r: (R() < 0.3 ? 100 : 0) + roll('1d100').total }));
      const best = others.reduce((a, b) => (b.r > a.r ? b : a), { n: '-', r: -1 });
      this.res = { mine, best, won: mine > best.r };
      if (this.res.won) { addGear(this.it); SFX.chest(); } else SFX.back();
    }
  }
  draw() {
    frame(6, 30, 148, 76);
    text('LOOT ROLL', 12, 34, 2);
    blit(sprFit(itemIcon(this.it), 14), 12, 46); text(this.it.name.slice(0, 18), 30, 48, rarityCol(this.it.rarity)); text(RARITY[this.it.rarity].name, 30, 58, 2);
    if (!this.res) ['NEED', 'GREED', 'PASS'].forEach((s, i) => { const x = 16 + i * 46; if (i === this.i) fill(x - 4, 80, 42, 12, 3); text(s, x, 82, i === this.i ? 0 : 3); });
    else { text(`You: ${this.res.mine || 'PASS'}  ${this.res.best.n}: ${this.res.best.r}`, 12, 74); text(this.res.won ? 'YOU WIN THE ITEM!' : `${this.res.best.n} wins.`, 12, 88, this.res.won ? 'green' : 2); }
  }
}

// ================================================================ fishing
class Fishing {
  constructor() { this.opaque = false; this.t = 0; this.state = 'cast'; this.wait = 60 + Math.floor(R() * 180); }
  update() {
    this.t++;
    if (this.state === 'cast') { if (this.t === 1) SFX.cast_line(); if (this.t > 20) this.state = 'wait'; return; }
    if (this.state === 'wait') { if (P('b')) { removeScene(this); return; } if (P('a')) return this.fail('Too early! The fish swims off.'); if (this.t > this.wait) { this.state = 'bite'; this.bt = this.t; SFX.bite(); FX.splash(80, 70); } return; }
    if (this.state === 'bite') { if (P('a')) return this.catch_(); if (this.t - this.bt > 28 + Math.floor(G.prof.fish / 10) + perkVal('fish', 'check') * 2) return this.fail('It got away...'); return; }
  }
  fail(msg) { removeScene(this); SFX.splash(); say(msg); }
  catch_() {
    removeScene(this);
    const z = ZONE_BY_ID[G.map], r = R() * 100 + G.prof.fish / 4 + perkVal('fish', 'respawn') * 40;
    let k = r < 8 ? 'old_boot' : r > 90 ? 'eel' : r > 70 ? 'big_fish' : 'small_fish';
    if (typeof gatherMaterial === 'function' && k !== 'old_boot' && R() < 0.6) { const fm = gatherMaterial('fish', (z && z.lvl[1]) || G.lvl, G.prof.fish || 1); if (fm && fm.slot > 0) k = fm.id; }
    let quantity = 1 + Math.floor(profTalentRank('fish', 'yield') / 24);
    if (R() < perkVal('fish', 'double')) quantity *= 2;
    perkAfterWork('fish');
    addItem(k, quantity); G.stats.fish += quantity; progressProfessionQuest('fish', 'fish', quantity); SFX.reel();
    const up = gainProf('fish', G.prof.fish);
    questEvent('fish', k); checkAchievements();
    toast(`${quantity > 1 ? `CAUGHT ${quantity} ` : 'CAUGHT '}${ITEMS[k].name}`, up ? `FISHING ${G.prof.fish}` : (z ? z.sub : ''), ITEMS[k].icon, 'pickup');
  }
  draw() {
    frame(30, 50, 100, 44);
    text(this.state === 'bite' ? '!!! PRESS A !!!' : this.state === 'wait' ? 'Waiting...' : 'Casting...', 40, 56, this.state === 'bite' ? 'red' : 3);
    const bob = this.state === 'bite' ? ((frameN >> 2) % 2) * 2 : Math.round(Math.sin(this.t / 10));
    fill(78, 74 + bob, 4, 4, 'red'); fill(40, 80, 80, 1, 'blue');
    text(`FISHING ${G.prof.fish}`, 40, 84, 2);
  }
}

// ================================================================ world map: an atlas drawn from the real terrain of all 90 zones
// WORLD view: 1 px per tile (each zone is 32x24 px), with coastlines, roads, towns, dungeons, raids,
// waypoints, world bosses, the story objective and fog over unvisited lands. ZONE view: 4 px per tile.
const MAP_TERRAIN = {
  water: [64, 112, 200], deep: [40, 76, 160], lava: [232, 96, 32], forest: [40, 110, 50], pine: [28, 84, 44], mountain: [120, 104, 92], snowcap: [236, 240, 248],
  grass: [124, 172, 80], grass2: [108, 156, 70], sand: [214, 190, 130], road: [196, 164, 112], town: [168, 64, 48], ocean: [176, 196, 214], parchment: [228, 214, 172], ink: [60, 44, 30],
};
const BIOME_TINT = { snow: { grass: [222, 230, 238], grass2: [206, 216, 228], forest: [70, 110, 100], water: [150, 196, 226] }, volcanic: { grass: [76, 56, 52], grass2: [64, 46, 44], forest: [70, 50, 40], water: 'lava' },
  marsh: { grass: [96, 120, 72], grass2: [86, 108, 64], water: [70, 104, 96] }, badlands: { grass: [178, 120, 80], grass2: [166, 108, 72], sand: [200, 132, 86] }, dusk: { grass: [88, 70, 110], grass2: [76, 60, 98], forest: [52, 44, 76], water: [70, 56, 120] },
  crystal: { grass: [110, 196, 190], grass2: [96, 180, 176], forest: [60, 140, 150], water: [80, 170, 230] }, jungle: { grass: [70, 160, 60], grass2: [60, 146, 52], forest: [24, 100, 40] } };
function terrainColor(ch, biome, x, y) {
  const t = BIOME_TINT[biome] || {}, P = k => (t[k] === 'lava' ? MAP_TERRAIN.lava : t[k]) || MAP_TERRAIN[k];
  if ('~Wwv'.includes(ch)) return ((x + y) % 7 === 0 ? P('water').map(v => v + 30) : ch === 'W' ? (t.water === 'lava' ? [200, 60, 20] : MAP_TERRAIN.deep) : P('water'));
  if ('TFD'.includes(ch)) return (x * 3 + y) % 4 === 0 ? MAP_TERRAIN.pine : P('forest');
  if (ch === 'P') return MAP_TERRAIN.pine;
  if (ch === 'M') return (x + y) % 3 === 0 ? MAP_TERRAIN.mountain.map(v => v - 30) : MAP_TERRAIN.mountain;
  if (ch === 'N') return MAP_TERRAIN.snowcap;
  if ('sS'.includes(ch)) return P('sand');
  if ('h|X='.includes(ch)) return MAP_TERRAIN.road;
  if ('AaKkHJrqRQ'.includes(ch)) return MAP_TERRAIN.town;
  return (x + y * 2) % 5 === 0 ? P('grass2') : P('grass');
}
function monoShade(ch) { return '~Wwv'.includes(ch) ? 1 : 'TFDPM'.includes(ch) ? 2 : 'AaKkHJrqRQ'.includes(ch) ? 3 : 0; }
const ATLAS = { canvas: null, key: null, w: 0, h: 0, bounds: null };
function buildAtlas() {
  const key = S.palette + ':' + Object.keys(G.visited || {}).length;
  if (ATLAS.key === key) return ATLAS;
  let maxX = 0, maxY = 0; for (const z of ZONES) { maxX = Math.max(maxX, z.fx); maxY = Math.max(maxY, z.fy); }
  const pad = 12, w = (maxX + 1) * ZW + pad * 2, h = (maxY + 1) * ZH + pad * 2;
  const c = ATLAS.canvas && ATLAS.w === w ? ATLAS.canvas : mkCanvas(w, h), x = c.getContext('2d');
  const id = x.createImageData(w, h), d = id.data, mono = MONO(S.palette), UIP = UI.ui;
  const land = new Uint8Array(w * h);
  const put = (px, py, rgb) => { const i = (py * w + px) * 4; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; };
  // ocean with a light wave texture
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const wave = ((px + (py >> 1) * 3) % 11 === 0 && py % 4 === 0);
    put(px, py, mono ? UIP[wave ? 1 : 0] : (wave ? [150, 176, 200] : MAP_TERRAIN.ocean));
  }
  for (const z of ZONES) {
    const m = buildZoneCached(z.id), ox = pad + z.fx * ZW, oy = pad + z.fy * ZH;
    const seen = !G.visited || G.visited[z.id] || G.waypoints[z.id];
    for (let ty = 0; ty < ZH; ty++) for (let tx = 0; tx < ZW; tx++) {
      const ch = m.rows[ty][tx]; let rgb = mono ? UIP[monoShade(ch)] : terrainColor(ch, z.biome, tx, ty);
      // soften the generated mountain borders so neighbouring zones read as one continent
      if (ch === 'M' && (tx === 0 || ty === 0 || tx === ZW - 1 || ty === ZH - 1)) rgb = mono ? UIP[2] : terrainColor('M', z.biome, tx + 1, ty);
      if (!seen) { rgb = mono ? UIP[(tx + ty) % 3 === 0 ? 2 : 1] : rgb.map((v, k) => Math.round(v * 0.35 + MAP_TERRAIN.parchment[k] * 0.45 - ((tx + ty) % 4 === 0 ? 18 : 0))); }
      put(ox + tx, oy + ty, rgb); land[(oy + ty) * w + ox + tx] = 1;
    }
  }
  // coastline: dark ink on ocean pixels touching land
  for (let py = 1; py < h - 1; py++) for (let px = 1; px < w - 1; px++) {
    if (land[py * w + px]) continue;
    if (land[py * w + px - 1] || land[py * w + px + 1] || land[(py - 1) * w + px] || land[(py + 1) * w + px]) put(px, py, mono ? UIP[3] : MAP_TERRAIN.ink);
  }
  x.putImageData(id, 0, 0);
  // region borders (dotted)
  x.fillStyle = mono ? css(UIP[3]) : 'rgba(60,40,30,0.75)';
  for (const z of ZONES) {
    const ox = pad + z.fx * ZW, oy = pad + z.fy * ZH;
    const r = ZONES.find(o => o.fx === z.fx + 1 && o.fy === z.fy), b = ZONES.find(o => o.fx === z.fx && o.fy === z.fy + 1);
    if (r && r.region !== z.region) for (let k = 0; k < ZH; k += 3) x.fillRect(ox + ZW - 1, oy + k, 1, 2);
    if (b && b.region !== z.region) for (let k = 0; k < ZW; k += 3) x.fillRect(ox + k, oy + ZH - 1, 2, 1);
  }
  Object.assign(ATLAS, { canvas: c, key, w, h, pad });
  return ATLAS;
}
class WorldMap {
  // zoom 0: all of VALENDRIA (160 px), zoom 1: detail map (320 px, scrolls), zoom 2: the zone's own tiles
  constructor() {
    this.opaque = true; this.zoom = 0; this.legend = false; this.settlementView = false;
    const z = ZONE_BY_ID[G.inst ? G.inst.return.map : G.map] || ZONE_BY_ID.elderwood;
    this.sel = z; G.visited = G.visited || {}; G.visited[z.id] = true;
  }
  move(dx, dy) {
    const [sx, sy] = zonePin(this.sel); let best = null, bd = 1e9;
    for (const o of ZONES) {
      if (o === this.sel || worldOf(o) !== worldOf(this.sel)) continue;
      const [ox, oy] = zonePin(o), vx = (ox - sx) * 1.6, vy = oy - sy, d = Math.hypot(vx, vy);
      if (!d || (vx * dx + vy * dy) / d < 0.5) continue;
      const score = d * (1.6 - (vx * dx + vy * dy) / d);
      if (score < bd) { bd = score; best = o; }
    }
    if (best) { this.sel = best; SFX.cursor(); }
  }
  update() {
    if (nav('left')) this.move(-1, 0); if (nav('right')) this.move(1, 0); if (nav('up')) this.move(0, -1); if (nav('down')) this.move(0, 1);
    if (P('start')) { this.legend = !this.legend; SFX.page(); }
    if (P('b') || P('select')) { if (this.zoom) { this.zoom--; SFX.back(); } else { removeScene(this); SFX.close(); } return; }
    if (P('a')) {
      if (this.zoom < 2) { this.zoom++; SFX.select(); return; }
      const z = this.sel;
      if (G.waypoints[z.id] && !G.inst && !G.ghost) { removeScene(this); const wp = buildZoneCached(z.id).poi.waypoint; travelTo(z.id, wp ? wp.x : null, wp ? wp.y + 1 : null); }
      else SFX.error();
    }
  }
  icons(z) { // points of interest for a zone, in tile coordinates
    const m = buildZoneCached(z.id), out = [];
    if (z.town) out.push({ x: m.hub[0], y: m.hub[1] - 2, k: 'town' });
    if (m.poi.waypoint && (G.visited[z.id] || G.waypoints[z.id])) out.push({ x: m.poi.waypoint.x, y: m.poi.waypoint.y, k: G.waypoints[z.id] ? 'wp' : 'wp0' });
    if (m.poi.dungeon) out.push({ x: m.poi.dungeon.x, y: m.poi.dungeon.y, k: 'dungeon' });
    if (m.poi.raid) out.push({ x: m.poi.raid.x, y: m.poi.raid.y, k: 'raid' });
    for (const b of m.bosses) if (G.visited[z.id]) out.push({ x: b.x, y: b.y, k: b.arc ? 'arc' : 'boss', dead: G.bossKills[b.id] && Date.now() - G.bossKills[b.id] < 1800e3 });
    const ch = chapterDef();
    if (ch && regionOf(z.id) === ch.region && (ch.type !== 'boss' || m.bosses.some(b => b.arc))) out.push({ x: m.hub[0], y: m.hub[1], k: 'quest' });
    return out;
  }
  drawIcon(k, x, y, big, dead) {
    const s = big ? 2 : 1;
    if (k === 'town') { fill(x - 2 * s, y - 2 * s, 5 * s, 4 * s, 3); fill(x - s, y - 3 * s, 3 * s, 2 * s, 'red'); fill(x - 1 * s, y - s, s * 2, s * 3, 0); }
    else if (k === 'wp' || k === 'wp0') { fill(x - s, y - 2 * s, 3 * s, 4 * s, k === 'wp' ? 'blue' : 1); fill(x, y - 3 * s, s, 6 * s, k === 'wp' ? 'blue' : 1); }
    else if (k === 'dungeon') { fill(x - 2 * s, y - 2 * s, 5 * s, 5 * s, 3); fill(x - s, y - s, 3 * s, 4 * s, 0); fill(x, y, s, 2 * s, 3); }
    else if (k === 'raid') { fill(x - 2 * s, y - s, 5 * s, 3 * s, 'gold'); fill(x - 2 * s, y - 3 * s, s, 2 * s, 'gold'); fill(x, y - 3 * s, s, 2 * s, 'gold'); fill(x + 2 * s, y - 3 * s, s, 2 * s, 'gold'); }
    else if ((k === 'boss' || k === 'arc') && !big) { fill(x - 1, y - 1, 3, 3, dead ? 1 : 3); fill(x, y, 1, 1, dead ? 1 : k === 'arc' ? 'purple' : 'red'); }
    else if (k === 'boss' || k === 'arc') { if (dead) { fill(x - s, y - s, 3 * s, 3 * s, 1); return; } fill(x - 2 * s, y - 2 * s, 5 * s, 4 * s, k === 'arc' ? 'purple' : 'red'); fill(x - s, y - s, s, s, 0); fill(x + s, y - s, s, s, 0); fill(x - s, y + s, 3 * s, s, k === 'arc' ? 'purple' : 'red'); }
    else if (k === 'quest' && (frameN >> 4) % 2) { fill(x - s, y - 4 * s, 3 * s, 5 * s, 3); fill(x, y - 3 * s, s, 2 * s, 'gold'); fill(x, y, s, s, 'gold'); }
    // settlement icons: city=gold walls, town=blue house, village=green dot
    else if (k === 'settlement_city') { fill(x - 3*s, y - 2*s, 7*s, 4*s, 'gold'); fill(x - 2*s, y - 4*s, 2*s, 2*s, 'gold'); fill(x + s, y - 4*s, 2*s, 2*s, 'gold'); fill(x - s, y - s, 2*s, 3*s, 0); }
    else if (k === 'settlement_town') { fill(x - 2*s, y - 2*s, 5*s, 3*s, 'blue'); fill(x - s, y - 4*s, 3*s, 2*s, 'blue'); fill(x - s, y - s, 2*s, 3*s, 0); }
    else if (k === 'settlement_village') { fill(x - s, y - 2*s, 3*s, 3*s, 'green'); fill(x, y - 3*s, s, s, 'green'); fill(x, y, s, s, 0); }
  }
  roads() {
    if (WorldMap._roads) return WorldMap._roads;
    const out = [], seen = new Set();
    for (const z of ZONES) {
      const m = buildZoneCached(z.id);
      for (const e of Object.values(m.exits || {})) {
        const o = ZONE_BY_ID[e.to]; if (!o) continue;
        const k = [z.id, o.id].sort().join('|'); if (seen.has(k)) continue; seen.add(k);
        out.push({ a: z, b: o, sea: continentOf(z) !== continentOf(o) });
      }
    }
    return (WorldMap._roads = out);
  }
  drawRoads(img, ox, oy, scale) {
    const P = o => { const [nx, ny] = zonePin(o); return [ox + nx * img.width * scale, oy + ny * img.height * scale]; };
    const wn = worldOf(this.sel);
    for (const r of this.roads()) {
      if (worldOf(r.a) !== wn || worldOf(r.b) !== wn) continue;
      const [x0, y0] = P(r.a), [x1, y1] = P(r.b);
      if (Math.max(x0, x1) < 0 || Math.min(x0, x1) > W || Math.max(y0, y1) < 12 || Math.min(y0, y1) > 110) continue;
      const known = (G.visited[r.a.id] || G.waypoints[r.a.id]) && (G.visited[r.b.id] || G.waypoints[r.b.id]);
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0))), gap = r.sea ? (scale > 1 || this.zoom ? 4 : 6) : 2;
      const c = r.sea ? 'blue' : known ? 'gold' : 3;
      for (let i = 0; i <= n; i += gap) {
        const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
        if (y < 12 || y > 110) continue;
        fill(x, y, 1, 1, c);
      }
    }
  }
  pinMarks(img, ox, oy, scale) {
    if (S.roads !== false) this.drawRoads(img, ox, oy, scale);
    const here = ZONE_BY_ID[G.inst ? G.inst.return.map : G.map], ch = chapterDef();
    for (const o of ZONES) {
      if (worldOf(o) !== worldOf(this.sel)) continue;
      const [nx, ny] = zonePin(o), x = Math.round(ox + nx * img.width * scale), y = Math.round(oy + ny * img.height * scale);
      if (x < -4 || x > W + 4 || y < 10 || y > 110) continue;
      const known = G.visited[o.id] || G.waypoints[o.id];
      const s = scale > 1 ? 2 : 1;
      fill(x - s, y - s, 2 * s + 1, 2 * s + 1, 3);
      fill(x - s + 1, y - s + 1, 2 * s - 1, 2 * s - 1, o.town ? 'red' : G.waypoints[o.id] ? 'blue' : known ? 0 : 1);
      if (ch && o.region === ch.region && o.last && (frameN >> 4) % 2) { fill(x - 1, y - 7, 3, 4, 'gold'); fill(x - 1, y - 2, 3, 1, 'gold'); }
    }
    if (here && worldOf(here) === worldOf(this.sel) && (frameN >> 3) % 2) { const [nx, ny] = zonePin(here), x = Math.round(ox + nx * img.width * scale), y = Math.round(oy + ny * img.height * scale); fill(x - 1, y - 6, 3, 3, 'red'); fill(x, y - 3, 1, 2, 'red'); }
    const [nx, ny] = zonePin(this.sel), x = Math.round(ox + nx * img.width * scale), y = Math.round(oy + ny * img.height * scale);
    ctx.strokeStyle = col((frameN >> 3) % 2 ? 0 : 3); ctx.lineWidth = 1; ctx.strokeRect(x - 4.5, y - 4.5, 9, 9);
  }
  draw() {
    fill(0, 0, W, H, 0);
    const z = this.sel, reg = REGIONS.find(r => r.id === z.region), pin = REGION_PINS[z.region] || [0, 0, ''];
    if (this.zoom === 0) {
      const wi = IMG[worldImg(worldOf(z), true)] ? worldImg(worldOf(z), true) : 'gm_dunia_s', img = IMG[wi]; const m = spr(wi, img.width, img.height);
      blit(m, 0, 12); this.pinMarks(img, 0, 12, 1);
    } else if (this.zoom === 1) {
      const wi = IMG[worldImg(worldOf(z))] ? worldImg(worldOf(z)) : 'gm_dunia', img = IMG[wi], m = spr(wi, img.width, img.height);
      const [nx, ny] = zonePin(z), tx = nx * img.width, ty = ny * img.height, vh = 97;
      const cx = Math.max(0, Math.min(img.width - W, tx - W / 2)), cy = Math.max(0, Math.min(img.height - vh, ty - vh / 2));
      this.camx = this.camx == null ? cx : this.camx + (cx - this.camx) * 0.25; this.camy = this.camy == null ? cy : this.camy + (cy - this.camy) * 0.25;
      ctx.drawImage(m, Math.round(this.camx), Math.round(this.camy), W, vh, 0, 12, W, vh);
      this.pinMarks(img, -Math.round(this.camx), 12 - Math.round(this.camy), 1);
    } else {
      const m = buildZoneCached(z.id), s = 4, ox = Math.floor((W - ZW * s) / 2), oy = 13;
      const seen = G.visited[z.id] || G.waypoints[z.id];
      for (let ty = 0; ty < ZH; ty++) for (let tx = 0; tx < ZW; tx++) {
        const ch = m.rows[ty][tx];
        const rgb = MONO(S.palette) ? UI.ui[monoShade(ch)] : terrainColor(ch, z.biome, tx, ty);
        ctx.fillStyle = css(seen ? rgb : rgb.map((v, k) => Math.round(v * 0.35 + MAP_TERRAIN.parchment[k] * 0.45))); ctx.fillRect(ox + tx * s, oy + ty * s, s, s);
        if (seen && 'TFD'.includes(ch) && (tx + ty) % 2 === 0) fill(ox + tx * s + 1, oy + ty * s, 2, 2, 3);
        if (seen && 'MN'.includes(ch) && (tx + ty) % 2 === 0) { fill(ox + tx * s + 1, oy + ty * s, 2, 1, 3); fill(ox + tx * s, oy + ty * s + 1, 4, 1, 3); }
      }
      fill(ox - 1, oy - 1, ZW * s + 2, 1, 3); fill(ox - 1, oy + ZH * s, ZW * s + 2, 1, 3); fill(ox - 1, oy - 1, 1, ZH * s + 2, 3); fill(ox + ZW * s, oy - 1, 1, ZH * s + 2, 3);
      if (seen) {
        for (const a of m.areas) if (G.areas[a.id]) { const [ax, ay] = a.r; text(a.name.split(' ').pop().slice(0, 8), ox + ax * s + 2, oy + ay * s + 2, 3); }
        for (const ic of this.icons(z)) this.drawIcon(ic.k, ox + ic.x * s + 2, oy + ic.y * s + 2, true, ic.dead);
        const nodes = G.nodes[z.id] || {}; m.nodes.forEach(([x, y, profession], i) => { if (!nodes[i] || G.stats.steps - nodes[i] > Math.round(250 * (1 - Math.min(0.8, perkVal(profession, 'respawn'))))) fill(ox + x * s + 1, oy + y * s + 1, 2, 2, 'green'); });
        for (const e in m.exits) { const ex = m.exits[e]; fill(ox + ex.x * s, oy + ex.y * s, s, s, 'gold'); }
      } else textC('UNEXPLORED', 80, oy + 44, 3);
      if (z.id === (G.inst ? G.inst.return.map : G.map) && (frameN >> 3) % 2) { const px = G.inst ? G.inst.return.x : G.x, py = G.inst ? G.inst.return.y : G.y; fill(ox + px * s - 1, oy + py * s - 1, s + 2, s + 2, 3); fill(ox + px * s, oy + py * s, s, s, 'red'); }
    }
    fill(0, 0, W, 12, 3); textC(this.zoom === 2 ? z.name.slice(0, 24) : [worldName(worldOf(z)), worldOf(z) ? worldName(worldOf(z)) : 'VALENDRIA - ' + continentOf(z)][this.zoom].slice(0, 25), 80, 2, 0);
    frame(2, 109, 156, 33);
    if (this.legend) {
      const L = [[0, 'red', 'TOWN'], [1, 'blue', 'WAYPOINT'], [2, 0, 'VISITED'], [3, 1, 'UNKNOWN'], [4, 'gold', 'STORY'], [5, 'red', 'YOU']];
      L.forEach(([i, c, n]) => { const x = 8 + (i % 3) * 50, y = 115 + Math.floor(i / 3) * 12; fill(x, y + 1, 5, 5, 3); fill(x + 1, y + 2, 3, 3, c); text(n, x + 8, y, 3); });
      return;
    }
    const seen = G.visited[z.id] || G.waypoints[z.id];
    text(seen ? z.name.slice(0, 18) : '??? UNEXPLORED', 6, 112, 3); textR(z.town ? 'SAFE' : `LV${z.lvl[0]}-${z.lvl[1]}`, 154, 112, 'gold');
    text(`${pin[2]}${seen ? ' - ' + z.sub : ''}`.slice(0, 24), 6, 122, 2);
    const hint = this.zoom < 2 ? 'A:ZOOM  B:BACK  START:KEY' : (G.waypoints[z.id] ? 'A:TRAVEL  B:BACK' : 'NO WAYPOINT  B:BACK');
    text(hint, 6, 132, this.zoom === 2 && G.waypoints[z.id] ? 'blue' : 1);
  }
}

// ================================================================ expansion maps: one terrain atlas for each endgame set
class ExpansionMapsScene {
  constructor() { this.opaque = true; this.expIndex = Math.max(0, (ZONE_BY_ID[G.map]?.exp || 1) - 1); this.zoneIndex = 0; }
  expansion() { return EXPANSIONS[this.expIndex]; }
  zones() {
    const x = this.expansion();
    return REGIONS.filter(r => r.exp === x.n).sort((a, b) => a.ex - b.ex)
      .flatMap(r => ZONES.filter(z => z.region === r.id).sort((a, b) => a.fx - b.fx || a.fy - b.fy));
  }
  update() {
    if (nav('left')) { this.zoneIndex = (this.zoneIndex + this.zones().length - 1) % this.zones().length; SFX.cursor(); }
    if (nav('right')) { this.zoneIndex = (this.zoneIndex + 1) % this.zones().length; SFX.cursor(); }
    if (nav('up') || nav('down')) { this.expIndex = (this.expIndex + (nav('down') ? 1 : EXPANSIONS.length - 1)) % EXPANSIONS.length; this.zoneIndex = 0; SFX.page(); }
    if (P('b')) { removeScene(this); SFX.back(); return; }
    if (P('a')) {
      const map = new WorldMap(); map.sel = this.zones()[this.zoneIndex]; map.zoom = 2;
      push(map); SFX.select();
    }
  }
  draw() {
    fill(0, 0, W, H, 0); fill(0, 0, W, 12, 3);
    const x = this.expansion(), zones = this.zones();
    blit(spr(EXPANSION_CAMPAIGNS[this.expIndex].icon, 10, 10), 4, 1);
    textC(`${x.n}. ${x.name}`.slice(0, 25), 80, 2, 0);
    textC(`LEVEL ${x.lvl[0]}-${x.lvl[1]}  ${x.desc}`.slice(0, 25), 80, 15, 'gold');
    zones.forEach((z, index) => {
      const colIndex = index % 4, row = Math.floor(index / 4), ox = colIndex * 40 + 4, oy = 29 + row * 49;
      const m = buildZoneCached(z.id), seen = !!(G.visited[z.id] || G.waypoints[z.id]);
      for (let ty = 0; ty < ZH; ty++) for (let tx = 0; tx < ZW; tx++) {
        const ch = m.rows[ty][tx], rgb = MONO(S.palette) ? UI.ui[monoShade(ch)] : terrainColor(ch, z.biome, tx, ty);
        ctx.fillStyle = css(seen ? rgb : rgb.map((v, k) => Math.round(v * 0.38 + MAP_TERRAIN.parchment[k] * 0.42)));
        ctx.fillRect(ox + tx, oy + 7 + ty, 1, 1);
      }
      if (m.poi.waypoint) fill(ox + m.poi.waypoint.x, oy + 7 + m.poi.waypoint.y, 2, 2, 'blue');
      if (m.poi.dungeon) { fill(ox + m.poi.dungeon.x, oy + 7 + m.poi.dungeon.y, 2, 2, 'red'); text('D', ox + m.poi.dungeon.x - 1, oy + 6 + m.poi.dungeon.y, 0); }
      if (m.poi.raid) { fill(ox + m.poi.raid.x, oy + 7 + m.poi.raid.y, 2, 2, 'gold'); text('R', ox + m.poi.raid.x - 1, oy + 6 + m.poi.raid.y, 3); }
      if (index === this.zoneIndex) { ctx.strokeStyle = col('gold'); ctx.lineWidth = 1; ctx.strokeRect(ox - 2.5, oy + 4.5, ZW + 5, ZH + 5); }
      text(`${index + 1} ${z.name}`.slice(0, 10), ox - 2, oy + 34, index === this.zoneIndex ? 'gold' : 2);
      textR(`LV${z.lvl[0]}`, ox + ZW + 1, oy + 34, 2);
    });
    const campaign = EXPANSION_CAMPAIGNS[this.expIndex], progress = G.expansionCampaigns && G.expansionCampaigns[x.id];
    const story = progress ? (progress.done ? campaign.epilogue : campaign.beats[progress.step] || campaign.intro) : campaign.beats[0];
    const step = campaign.steps[progress?.step || 0];
    const objective = progress?.done ? 'CAMPAIGN COMPLETE' : !progress ? '0/4 ARRIVE AT FRONTIER' : step.kind === 'slay' ? `2/4 FOES ${progress.kills || 0}/${step.target}` : `${progress.step + 1}/4 ${step.kind === 'raid' ? 'RAID' : step.kind === 'dungeon' ? 'DUNGEON' : 'REACH'}: ${step.kind === 'raid' ? x.raid : step.kind === 'dungeon' ? EXP_ZONE_NAMES[this.expIndex][1] : EXP_ZONE_NAMES[this.expIndex][0]}`;
    textC(story.toUpperCase().slice(0, 25), 80, 105, 2);
    textC(objective.slice(0, 25), 80, 116, progress?.done ? 'gold' : 2);
    const selected = zones[this.zoneIndex];
    fill(0, 125, W, 19, 0); textC(`${selected?.name || ''}  LV${selected?.lvl[0] || 0}-${selected?.lvl[1] || 0}`, 80, 126, 'gold');
    textC('UP/DN: EXPANSION  LEFT/RIGHT: ZONE  A: DETAIL', 80, 136, 2);
  }
}

// ================================================================ level up
class LevelUpScene {
  constructor(g, cb) { this.opaque = true; this.g = g; this.cb = cb; this.t = 0; }
  enter() { SFX.levelup(); }
  update() { this.t++; if (this.t > 30 && (P('a') || P('b') || P('start'))) { SFX.select(); removeScene(this); this.cb && this.cb(); } }
  draw() {
    fill(0, 0, W, H, 0); frame(3, 3, 154, 138);
    blit(heroPortrait(G) ? sprFit(heroPortrait(G), 46) : sprH(`c_${G.cls}_0`, 44), 8, 40 + (this.t < 20 ? Math.round(Math.sin(this.t / 2) * 3) : 0));
    for (let i = 0; i < 9; i++) { const x = 50 + ((i * 37) % 100), y = 20 + ((i * 53) % 110); if (((this.t >> 3) + i) % 3 === 0) text('+', x, y, 'gold'); }
    textC('LEVEL UP!', 100, 10, 'gold', 2);
    textC(`LEVEL ${this.g.lvl}`, 100, 34, 3);
    if (this.g.hp) text(`MAX HP +${this.g.hp}`, 56, 48, 2);
    (this.g.notes || []).slice(0, 5).forEach((n, i) => text(n.slice(0, 16), 56, 62 + i * 12, 3));
    if (this.t > 30 && (this.t >> 4) % 2) text('v', 146, 128);
  }
}

// ================================================================ remote battle (joined a host's server)
class RemoteBattleView {
  constructor() { this.opaque = true; this.i = 0; }
  update() {
    const t = NET.myTurn;
    if (!NET.remoteView) { removeScene(this); return; }
    if (!t) return;
    const foes = t.foes || [];
    if (nav('up')) { this.i = (this.i + foes.length) % (foes.length + 1); SFX.cursor(); }
    if (nav('down')) { this.i = (this.i + 1) % (foes.length + 1); SFX.cursor(); }
    if (P('a')) { SFX.select(); if (this.i < foes.length) NET.sendAct({ kind: 'attack', target: foes[this.i][0] }); else { const D = derive(G); const sp = D.spell && D.spell.known.filter(s => s.eff === 'dmg').pop(); NET.sendAct(sp ? { kind: 'spell', id: sp.id, target: foes[0] && foes[0][0] } : { kind: 'attack', target: foes[0] && foes[0][0] }); } }
  }
  draw() {
    const v = NET.remoteView || { party: [], foes: [], text: '' };
    fill(0, 0, W, H, 0);
    v.party.slice(0, 6).forEach(([n, hp, mx], i) => { text(n.slice(0, 6), 2, 1 + i * 9); bar(40, 2 + i * 9, 36, 4, hp, mx, 'hp'); });
    v.foes.slice(0, 4).forEach(([n, hp, mx, id, sp], i) => { textR(n.slice(0, 7), 120, 1 + i * 9); bar(122, 2 + i * 9, 36, 4, hp, mx, 'red'); const s = sprH(IMG[sp] ? sp : 'enemy_goblin', 26, { flip: true }); if (s && hp > 0) blit(s, 92 + (i % 2) * 32, 60 + Math.floor(i / 2) * 20 - s.height + 26); });
    { const por = heroPortrait(G); const s = por ? sprFit(por, 34) : sprH(`c_${G.cls}_4`, 30); blit(s, 30 - s.width / 2, 92 - s.height); }
    frame(2, 95, 156, 47);
    if (NET.myTurn) { text('YOUR TURN! Attack:', 7, 99, 'gold'); (NET.myTurn.foes || []).slice(0, 2).concat([['', 'BEST SPELL']]).forEach((f, i) => { if (i === this.i) text('>', 7, 110 + i * 10); text(f[1], 14, 110 + i * 10); }); }
    else text(wrap(v.text || 'Battle in progress...', 24).slice(0, 4).join('\n'), 7, 99);
    textR('SERVER', 156, 132, 'blue');
  }
}

// ================================================================ credits / ending
class Credits {
  constructor(ending) { this.opaque = true; this.t = 0; this.ending = ending; }
  enter() { Music.play('credits'); if (this.ending) saveGame(); }
  update() { this.t++; if (this.t > 60 && (P('a') || P('b') || P('start'))) { removeScene(this); if (this.ending) { const f = currentField(); if (f) f.resume(); } } }
  draw() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#080c27'); bg.addColorStop(.6, '#211b40'); bg.addColorStop(1, '#3d2a4b');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (let n = 0; n < 24; n++) {
      ctx.globalAlpha = .2 + (n % 4) * .1;
      fill((n * 29 + 3) % W, (n * 17 + 6) % H, n % 8 === 0 ? 2 : 1, 1, n % 5 ? '#d5c6ff' : '#ffd17b');
    }
    ctx.globalAlpha = 1;
    frame(5, 4, 150, 136, 1);
    fill(8, 7, 144, 14, '#17112d');
    textC(this.ending ? 'THE LANTERNS OF AELMOOR' : 'GB QUEST  •  CREDITS', 80, 12, 'gold');
    const lines = [this.ending ? 'DAWN RETURNS TO AELMOOR' : '', '', BUILD.gameLines[0], BUILD.gameLines[1], BUILD.subtitle, '', 'A GAME BY', BUILD.studio, '', 'DESIGN & CODE', BUILD.studio, '', 'ART', 'Original pixel-art direction', 'and generated game assets', '', 'RULES', 'A d20 system modelled on', 'the 5E SRD (CC-BY-4.0)', 'with original lore', '', 'MUSIC & SFX', 'Procedural 4-channel chip', '', `v${BUILD.version}  ${BUILD.build}`, '', 'THANK YOU FOR PLAYING!'];
    lines.forEach((line, index) => {
      const y = 150 + index * 12 - this.t * .5 + (this.t > 520 ? this.t * .5 - 260 : 0);
      if (y > 23 && y < 132) textC(line, 80, y, index === 2 || index === 3 || index === 7 ? 'gold' : 0);
    });
    textC('A / B / START: RETURN', 80, 135, 2);
  }
}

// ---------------------------------------------------------------- stairs, exits and safe arrival
// never arrive inside a wall, water or an NPC: step to the nearest free tile (rings out to 4 tiles)
function safeSpot() {
  const f = FIELD; if (!f || !f.blocked || !f.blocked(G.x, G.y)) return;
  for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (!f.blocked(G.x + dx, G.y + dy)) { G.x += dx; G.y += dy; return; }
  }
}
// stepping onto stairs asks right away (no need to face them and press A)
{
  const u0 = Field.prototype.update;
  Field.prototype.update = function () {
    const r = u0.apply(this, arguments);
    try {
      if (G && G.inst && scenes[scenes.length - 1] === this && !this.ox && !this.oy) {
        const here = `${G.map}|${G.x},${G.y}`, ch = this.chAt(G.x, G.y);
        if (here !== this._stairAt && (ch === 'U' || ch === 'L')) { this._stairAt = here; if (ch === 'U') towerNext(); else leaveInstance(); }
        else if (ch !== 'U' && ch !== 'L') this._stairAt = null;
      }
    } catch (e) { /* movement must never break */ }
    return r;
  };
}
