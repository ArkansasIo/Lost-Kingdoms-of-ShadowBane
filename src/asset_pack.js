'use strict';
// ================================================================ ASSET PACK ART IN THE GAME
// The sliced reference sheets are installed as ap_* (world/game art) and au_* (UI kit).
// Every route is deterministic and falls back to the existing sprite when pack art is unavailable.

const GBQ_REFERENCE_SHEETS = Object.freeze({
  title: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/CF4ED177-83D0-46D9-B88E-9C9BADBB982F-HQp5koURRXHe9VIjxyNQLHg5Jp0ry7.png',
  catalog: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4352877E-889F-40F4-906D-B00E3E84961D.png-gmVnINuXmP4gdkUzvMIZHeh3P7ksiw.jpeg',
  systems: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/B5E2A986-8590-4303-8486-0CB7F47C926A.png-72EVK7Fu4cRDu7MD6eGuassykjDgbC.jpeg',
  systemsAlt: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/B5E2A986-8590-4303-8486-0CB7F47C926A.png-rJePJeZUBBC8AaXltUwfMUfKeBuNt6.jpeg',
});
const AP_COUNTS = Object.freeze({
  characters: 43, npcs: 33, enemies: 19, monsters: 24, weapons: 42, armor: 52,
  items: 54, terrain: 34, environment: 26, buildings: 27, dungeon: 48,
  ui_icons: 40, portraits: 30, particles: 24, mounts: 22, map_elements: 12,
});
const AU_COUNTS = Object.freeze({
  rarity_frames: 9, socket_gems: 8, consumables: 12, frames: 4, buttons: 3,
  checkboxes: 12, system_icons: 14, hotbar_skills: 4, hotbar_potions: 3,
  skill_icons: 12, inventory_items: 23, storage_items: 17, shop_items: 13,
  menu_icons: 12, banners: 2,
});
const AP_ITEM_ART = {
  potion: 'ap_items_000', greater: 'ap_items_001', superior: 'ap_items_005', supreme: 'ap_items_029', ether: 'ap_items_002', antitoxin: 'ap_items_003',
  might: 'ap_items_004', ration: 'ap_items_020', grilled: 'ap_items_022', feast: 'ap_items_017', scroll_flame: 'ap_items_007', scroll_mend: 'ap_items_008',
  scroll_dawn: 'ap_items_007', codex_page: 'ap_items_006', coinpurse: 'ap_items_014', gold_dust: 'ap_items_014', tower_key: 'ap_items_016', idol_shard: 'ap_items_028',
  repair_kit: 'ap_items_013',
};
const AP_GEM_ART = { ruby: 'au_socket_gems_000', sapphire: 'au_socket_gems_001', emerald: 'au_socket_gems_002', topaz: 'au_socket_gems_003', garnet: 'au_socket_gems_004', onyx: 'au_socket_gems_004', opal: 'au_socket_gems_005', diamond: 'au_socket_gems_006', amethyst: 'au_socket_gems_007' };
// Pack monster art by family. The wider pools make every supplied monster/enemy image eligible.
const AP_MONSTERS = {
  dragon: ['ap_monsters_000', 'ap_monsters_007', 'ap_monsters_008', 'ap_monsters_023'],
  fiend: ['ap_monsters_002', 'ap_monsters_017', 'ap_monsters_018'],
  construct: ['ap_monsters_001', 'ap_monsters_019'], elemental: ['ap_monsters_001', 'ap_monsters_020'], giant: ['ap_monsters_001', 'ap_monsters_021'],
  beast: ['ap_monsters_004', 'ap_monsters_005', 'ap_monsters_006', 'ap_monsters_011', 'ap_monsters_012', 'ap_monsters_013', 'ap_monsters_014', 'ap_monsters_015', 'ap_monsters_016'],
  monstrosity: ['ap_monsters_003', 'ap_monsters_005', 'ap_monsters_022'], aberration: ['ap_monsters_003', 'ap_monsters_022'], ooze: ['ap_monsters_009', 'ap_monsters_010'],
  humanoid: ['ap_enemies_002', 'ap_enemies_004', 'ap_enemies_005', 'ap_enemies_006', 'ap_enemies_007', 'ap_enemies_008', 'ap_enemies_009', 'ap_enemies_010', 'ap_enemies_011', 'ap_enemies_012', 'ap_enemies_013', 'ap_enemies_014', 'ap_enemies_015', 'ap_enemies_016', 'ap_enemies_017', 'ap_enemies_018', 'ap_monsters_019', 'ap_monsters_020', 'ap_monsters_021', 'ap_monsters_022'],
  undead: ['ap_enemies_000', 'ap_enemies_001', 'ap_enemies_003'],
};
const AP_PORTRAITS = Array.from({ length: AP_COUNTS.portraits }, (_, i) => `ap_portraits_${String(i).padStart(3, '0')}`);
function apHash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function apPick(category, identity, prefix = 'ap_') {
  const counts = prefix === 'au_' ? AU_COUNTS : AP_COUNTS, count = counts[category] || 0;
  if (!count) return null;
  const name = `${prefix}${category}_${String(apHash(`${category}|${identity}`) % count).padStart(3, '0')}`;
  return typeof IMG === 'undefined' || IMG[name] ? name : null;
}
const apCharacterFor = character => apPick('characters', typeof character === 'object' && character ? `${character.name || ''}|${character.cls || ''}|${character.species || character.race || ''}` : character);
const apNpcFor = entity => apPick('npcs', typeof entity === 'object' && entity ? `${entity.name || ''}|${entity.svc || ''}|${entity.prof || ''}|${entity.spr || ''}` : entity);
const apMountFor = mount => apPick('mounts', typeof mount === 'object' && mount ? `${mount.id || ''}|${mount.family || ''}|${mount.variant || ''}` : mount);
function apEquipmentFor(item) {
  if (!item) return null;
  const id = String(item.base || item.id || item.name || item.kind || 'item');
  if (AP_ITEM_ART[id]) return AP_ITEM_ART[id];
  if (item.kind === 'weapon') return apPick('weapons', `${id}|${item.name || ''}|${item.fam || ''}`);
  if (item.kind === 'armor' || item.kind === 'armour') return apPick('armor', `${id}|${item.name || ''}|${item.slot || ''}`);
  return apPick('items', `${id}|${item.name || ''}|${item.kind || ''}`);
}
function apFieldArtFor(name) {
  if (!name || typeof name !== 'string' || name.startsWith('ap_') || name.startsWith('au_')) return null;
  const lower = name.toLowerCase();
  if (/^gt_/.test(lower)) {
    if (/_(house|inn|shop|temple|tower|building|windmill)(_|$)/.test(lower)) return apPick('buildings', lower);
    if (/_(tree|pine|dense|single|rock|bush|plant)(_|$)/.test(lower)) return apPick('environment', lower);
    return apPick('terrain', lower);
  }
  if (/^(gd_|d_[a-z])/.test(lower)) return apPick('dungeon', lower);
  if (/^go_/.test(lower) || /^(px_waypoint|item_chest)/.test(lower)) return apPick('map_elements', lower);
  if (/^mt_/.test(lower)) return apPick('mounts', lower);
  if (/^gh_npc_/.test(lower) || /^(villager|elder|hero)_/.test(lower)) return apPick('npcs', lower);
  if (/^(gh_|c_)/.test(lower)) return apPick('characters', lower);
  if (/^world_/.test(lower)) return apPick('environment', lower);
  if (/^b_/.test(lower)) return apPick('buildings', lower);
  return null;
}
// A bestiary subtype gets pack art about half the time (stable per subtype).
const apMonsterArt = (fam, key) => { const L = AP_MONSTERS[fam]; if (!L) return null; const h = apHash('ap|' + key); return h % 2 ? L[(h >>> 1) % L.length] : null; };
const apPortraitFor = name => name ? AP_PORTRAITS[apHash('face|' + name) % AP_PORTRAITS.length] : null;
// which painted scene a battle uses
function apSceneFor(kind, foes, inDungeon, inTown) {
  if ((foes || []).some(f => f && f.boss)) return 'ap_scene_boss_fight';
  if (inDungeon || ['dungeon', 'tower', 'trial', 'raid'].includes(kind)) return 'ap_scene_dungeon';
  if (inTown || ['arena', 'pvp'].includes(kind)) return 'ap_scene_city';
  return 'ap_scene_wilderness';
}
const BATTLE_BG_MODES = ['clean', 'painted', 'scenes'];
const nextBattleBg = cur => BATTLE_BG_MODES[(BATTLE_BG_MODES.indexOf(cur) + 1) % BATTLE_BG_MODES.length];

if (typeof globalThis !== 'undefined') globalThis.GBQAssetPack = {
  GBQ_REFERENCE_SHEETS, AP_ITEM_ART, AP_GEM_ART, AP_MONSTERS, AP_PORTRAITS, AP_COUNTS, AU_COUNTS,
  apPick, characterFor: apCharacterFor, npcFor: apNpcFor, mountFor: apMountFor,
  equipmentFor: apEquipmentFor, fieldArtFor: apFieldArtFor, portraitFor: apPortraitFor,
  apMonsterArt, apPortraitFor, apSceneFor, BATTLE_BG_MODES, nextBattleBg,
};

if (typeof window !== 'undefined' && typeof IMG !== 'undefined') {
  window.gemArt = type => (typeof artOn !== 'function' || artOn()) && AP_GEM_ART[type] && IMG[AP_GEM_ART[type]] ? AP_GEM_ART[type] : null;

  // Route item/gear icons through the matching item, weapon, or armour collection.
  if (typeof itemIcon === 'function') {
    const itemIconBase = itemIcon;
    itemIcon = function (it) {
      if (it && artOn()) {
        const named = it.named && IMG['nn_' + it.named];
        if (!named) {
          const packed = apEquipmentFor(it);
          if (packed && IMG[packed]) return packed;
        }
      }
      return itemIconBase.apply(this, arguments);
    };
  }

  // Replace map tiles, people, and mounts by the semantically matching pack family.
  // Each mapper is deterministic and uses the original renderer as a fallback.
  const packSpriteName = name => {
    if (typeof artOn !== 'function' || !artOn()) return null;
    const candidate = apFieldArtFor(name);
    return candidate && IMG[candidate] ? candidate : null;
  };
  if (typeof spr === 'function') {
    const sprBase = spr;
    spr = function (name, w, h, opt) { return sprBase(packSpriteName(name) || name, w, h, opt); };
  }
  if (typeof sprH === 'function') {
    const sprHBase = sprH;
    sprH = function (name, h, opt) { return sprHBase(packSpriteName(name) || name, h, opt); };
  }
  if (typeof sprFit === 'function') {
    const sprFitBase = sprFit;
    sprFit = function (name, box, opt) { return sprFitBase(packSpriteName(name) || name, box, opt); };
  }

  // The full-body character collection appears in the field, class select, and character panels.
  if (typeof worldPortrait === 'function') {
    const worldPortraitBase = worldPortrait;
    worldPortrait = function (character, dir, ghost) {
      if (artOn() && !ghost) {
        const packed = apCharacterFor(character);
        if (packed && IMG[packed]) return sprFit(packed, 24, { flip: dir === 'left' });
      }
      return worldPortraitBase.apply(this, arguments);
    };
  }
  if (typeof npcSprite === 'function') {
    const npcSpriteBase = npcSprite;
    npcSprite = function (entity) {
      if (artOn() && entity) {
        const packed = apNpcFor(entity);
        if (packed && IMG[packed]) return spr(packed, 16, 16);
      }
      return npcSpriteBase.apply(this, arguments);
    };
    window.npcSprite = npcSprite;
  }

  // Expose all supplied main-pack monsters across matching families and relevant bosses.
  if (typeof BESTIARY !== 'undefined') {
    for (const b of BESTIARY) if (!b.ccArt) { const n = apMonsterArt(b.fam, `${b.sub}|${b.variant}`); if (n) b.nspr = n; }
    if (typeof BOSSES !== 'undefined') for (const b of BOSSES) if (b.cat !== 'arc' && ['dragon', 'fiend', 'construct'].includes(b.fam)) { const n = apMonsterArt(b.fam, b.id); if (n) b.nspr = n; }
  }

  // Scene paintings are selected in SETTINGS > BATTLE BG > SCENES.
  if (typeof drawBattleBackdrop === 'function') {
    const d0 = drawBattleBackdrop;
    drawBattleBackdrop = function (battle) {
      if (S.battleBg !== 'scenes') return d0.apply(this, arguments);
      const zone = typeof ZONE_BY_ID !== 'undefined' && G ? ZONE_BY_ID[G.map] : null;
      const name = apSceneFor(battle.kind, battle.foes, !!(G && G.inst && G.inst.kind !== 'raid'), !!(zone && zone.town));
      const im = IMG[name];
      if (!im) return d0.apply(this, arguments);
      const band = BBG_BOT - BBG_TOP, sy = Math.max(0, Math.round(im.height * 0.5 - band / 2));
      ctx.drawImage(spr(name, im.width, im.height), 0, sy, im.width, band, 0, BBG_TOP, W, band);
      ctx.fillStyle = 'rgba(10,8,16,0.38)'; ctx.fillRect(0, BBG_TOP, W, band);
      fill(0, BBG_BOT - 1, W, 1, 3);
    };
  }

  // Pack spell particles are used by the existing battle-effect renderer.
  if (typeof spellArt === 'function') {
    const spellArtBase = spellArt;
    spellArt = function (spell) {
      if (artOn() && spell) {
        const packed = apPick('particles', `${spell.dt || ''}|${spell.school || ''}|${spell.id || spell.name || ''}`);
        if (packed && IMG[packed]) return packed;
      }
      return spellArtBase.apply(this, arguments);
    };
  }

  // Item cells get the ornate rarity ring from the UI kit.
  if (typeof drawItemCell === 'function') {
    const drawItemCellBase = drawItemCell;
    drawItemCell = function (it, x, y) {
      const result = drawItemCellBase.apply(this, arguments);
      if (it && artOn() && !MONO(S.palette)) {
        const n = `au_rframe_${Math.max(0, Math.min(8, it.rarity === undefined ? 1 : it.rarity))}`;
        if (IMG[n]) blit(spr(n, 18, 18), x, y);
      }
      return result;
    };
  }

  // Talking to a townsperson shows a stable face portrait beside the dialogue box.
  let speaker = null;
  if (typeof npcService === 'function') {
    const npcServiceBase = npcService;
    npcService = function (entity) { speaker = entity && entity.name && entity.kind === 'npc' ? entity.name : null; return npcServiceBase.apply(this, arguments); };
  }
  if (typeof Field !== 'undefined') {
    const fieldUpdateBase = Field.prototype.update;
    Field.prototype.update = function () { if (scenes[scenes.length - 1] === this) speaker = null; return fieldUpdateBase.apply(this, arguments); };
  }
  if (typeof Dialog !== 'undefined') {
    const dialogDrawBase = Dialog.prototype.draw;
    Dialog.prototype.draw = function () {
      if (this.face === undefined) this.face = this.portrait || (speaker && artOn() ? apPortraitFor(speaker) : null);
      dialogDrawBase.apply(this, arguments);
      if (this.face && IMG[this.face]) { const y = H - 44 - 34; frame(W - 38, y, 36, 36); blit(sprFit(this.face, 32), W - 36, y + 2); }
    };
  }
}
