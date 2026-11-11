#!/usr/bin/env node
// ================================================================ MySQL schema + seed export
// Generates a MySQL 8 / MariaDB 10.6+ database from the game's own catalogues, so a realm server, admin tools or
// analytics can query every class, spell, item, zone, creature and boss by id, number and name.
//
//   node tools/export_sql.cjs                          -> data/sql/schema.sql and data/sql/seed.sql
//   node tools/export_sql.cjs --realm server/data/realm.json
//                                                      -> also data/sql/realm.sql (accounts, saves, guilds, market...)
//   node tools/export_sql.cjs --out some/dir           write somewhere else
//
// Load it with:  mysql -u root -p -e "CREATE DATABASE gbquest CHARACTER SET utf8mb4"
//                mysql -u root -p gbquest < data/sql/schema.sql && mysql -u root -p gbquest < data/sql/seed.sql
//
// The browser game stays the source of truth: catalogues are read from src/*.js (no browser needed) and the files
// are regenerated, never edited by hand. Every catalogue table has
//   id    the game's string id (stable; what saves and the server use)
//   num   a 1-based number in catalogue order (stable while catalogues only grow at the end)
//   name  the display name
//   data  the full record as JSON, so nothing the game knows is lost
// plus a few typed columns worth filtering on. realm.sql is a one-off migration snapshot of a running realm: it
// includes scrypt password hashes, so treat it like the realm.json it came from and never commit it.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------- load the game catalogues (pure data modules)
function loadCatalogues(root = ROOT) {
  const ctx = { console, Math, JSON, Date, Object, Array, Number, String, Set, Map, Infinity };
  ctx.globalThis = ctx; vm.createContext(ctx);
  for (const m of ['data_rules', 'jobs_data', 'data_world', 'gen', 'creatures']) vm.runInContext(fs.readFileSync(path.join(root, 'src', m + '.js'), 'utf8'), ctx, { filename: `src/${m}.js` });
  const get = n => vm.runInContext(`typeof ${n} !== 'undefined' ? ${n} : undefined`, ctx);
  const names = ['CLASSES', 'CLASS_ORDER', 'SPECIES', 'BACKGROUNDS', 'SKILLS', 'FEATS', 'SPELLS', 'WEAPONS', 'ARMORS', 'WONDROUS', 'ITEMS', 'RARITY', 'SUBSTATS',
    'BIOMES', 'EXPANSIONS', 'REGIONS', 'ZONES', 'DUNGEONS', 'RAIDS', 'TRIALS', 'FAMILIES', 'BESTIARY', 'BOSSES', 'FACTIONS', 'ACHIEVEMENTS', 'RECIPES', 'ACTS', 'CHAPTERS', 'BUILD'];
  const out = {};
  for (const n of names) { const v = get(n); if (v === undefined) throw new Error(`catalogue ${n} is missing from src/`); out[n] = JSON.parse(JSON.stringify(v, (k, x) => typeof x === 'function' ? undefined : x instanceof Set ? [...x] : x)); }
  return out;
}

// ---------------------------------------------------------------- table definitions
// cols: [column, SQL type, value(record, key)]; rows(): [[key, record], ...] in catalogue order
const entries = o => Object.entries(o);
const byId = a => a.map(r => [r.id, r]);
const up = s => String(s || '').toUpperCase();
const lvl = (r, i) => Array.isArray(r.lvl) ? r.lvl[i] : r.lvl;
function tables(C) {
  return [
    { name: 'classes', rows: () => C.CLASS_ORDER.map(k => [k, C.CLASSES[k]]), cols: [['hit_die', 'TINYINT UNSIGNED', r => r.hd], ['primary_ability', 'CHAR(3)', r => r.primary], ['role', 'VARCHAR(16)', r => r.role], ['caster', 'VARCHAR(16)', r => r.caster]] },
    { name: 'species', rows: () => entries(C.SPECIES) },
    { name: 'backgrounds', rows: () => entries(C.BACKGROUNDS), cols: [['gold', 'INT UNSIGNED', r => r.gold]] },
    { name: 'skills', rows: () => entries(C.SKILLS).map(([k, ab]) => [k, { name: up(k), ability: ab }]), cols: [['ability', 'CHAR(3)', r => r.ability]] },
    { name: 'feats', rows: () => entries(C.FEATS) },
    { name: 'rarities', rows: () => byId(C.RARITY), cols: [['color', 'VARCHAR(16)', r => r.color]] },
    { name: 'substats', rows: () => entries(C.SUBSTATS), cols: [['unit', 'VARCHAR(8)', r => r.unit], ['max_value', 'INT', r => r.max]] },
    { name: 'spells', rows: () => byId(C.SPELLS), cols: [['school', 'VARCHAR(24)', r => r.school], ['spell_level', 'TINYINT UNSIGNED', r => r.lvl], ['damage_type', 'VARCHAR(16)', r => r.dt]] },
    { name: 'weapons', rows: () => entries(C.WEAPONS), cols: [['damage', 'VARCHAR(16)', r => r.dmg], ['damage_type', 'VARCHAR(16)', r => r.type], ['category', 'VARCHAR(16)', r => r.cat], ['cost', 'INT UNSIGNED', r => r.cost]] },
    { name: 'armors', rows: () => entries(C.ARMORS), cols: [['armor_class', 'TINYINT UNSIGNED', r => r.ac], ['armor_type', 'VARCHAR(16)', r => r.type], ['cost', 'INT UNSIGNED', r => r.cost]] },
    { name: 'wondrous_items', rows: () => byId(C.WONDROUS), cols: [['slot', 'VARCHAR(16)', r => r.slot]] },
    { name: 'items', rows: () => entries(C.ITEMS), cols: [['item_type', 'VARCHAR(16)', r => r.type], ['price', 'INT UNSIGNED', r => r.price]] },
    { name: 'biomes', rows: () => entries(C.BIOMES).map(([k, r]) => [k, { name: up(k), ...r }]) },
    { name: 'expansions', rows: () => byId(C.EXPANSIONS), cols: [['expansion_no', 'TINYINT UNSIGNED', r => r.n], ['level_min', 'SMALLINT UNSIGNED', r => lvl(r, 0)], ['level_max', 'SMALLINT UNSIGNED', r => lvl(r, 1)]] },
    { name: 'regions', rows: () => byId(C.REGIONS), cols: [['biome_id', 'VARCHAR(64)', r => r.biome, 'biomes'], ['level_min', 'SMALLINT UNSIGNED', r => lvl(r, 0)], ['level_max', 'SMALLINT UNSIGNED', r => lvl(r, 1)], ['act', 'TINYINT UNSIGNED', r => r.act], ['town', 'BOOLEAN', r => !!r.town]] },
    { name: 'zones', rows: () => byId(C.ZONES), cols: [['region_id', 'VARCHAR(64)', r => r.region, 'regions'], ['biome_id', 'VARCHAR(64)', r => r.biome, 'biomes'], ['level_min', 'SMALLINT UNSIGNED', r => lvl(r, 0)], ['level_max', 'SMALLINT UNSIGNED', r => lvl(r, 1)], ['town', 'BOOLEAN', r => !!r.town]] },
    { name: 'dungeons', rows: () => byId(C.DUNGEONS), cols: [['zone_id', 'VARCHAR(64)', r => r.zone, 'zones'], ['level', 'SMALLINT UNSIGNED', r => lvl(r, 0)], ['theme', 'VARCHAR(16)', r => r.theme]] },
    { name: 'raids', rows: () => byId(C.RAIDS), cols: [['zone_id', 'VARCHAR(64)', r => r.zone, 'zones'], ['level', 'SMALLINT UNSIGNED', r => lvl(r, 0)], ['boss_count', 'TINYINT UNSIGNED', r => r.bosses]] },
    { name: 'trials', rows: () => byId(C.TRIALS), cols: [['level', 'SMALLINT UNSIGNED', r => lvl(r, 0)], ['rule', 'VARCHAR(16)', r => r.rule]] },
    { name: 'creature_families', rows: () => entries(C.FAMILIES) },
    { name: 'creatures', rows: () => byId(C.BESTIARY), cols: [['family_id', 'VARCHAR(64)', r => r.fam, 'creature_families'], ['creature_type', 'VARCHAR(24)', r => r.type], ['combat_role', 'VARCHAR(16)', r => r.role], ['creature_rank', 'VARCHAR(16)', r => r.rank], ['damage_type', 'VARCHAR(16)', r => r.dt]] },
    { name: 'bosses', rows: () => byId(C.BOSSES), cols: [['category', 'VARCHAR(16)', r => r.cat], ['level', 'SMALLINT UNSIGNED', r => r.lvl], ['family_id', 'VARCHAR(64)', r => r.fam, 'creature_families'], ['title', 'VARCHAR(64)', r => r.title], ['act', 'TINYINT UNSIGNED', r => r.act]] },
    { name: 'factions', rows: () => entries(C.FACTIONS).map(([k, n]) => [k, { name: n }]) },
    { name: 'achievements', rows: () => byId(C.ACHIEVEMENTS), cols: [['description', 'VARCHAR(255)', r => r.desc]] },
    { name: 'recipes', rows: () => byId(C.RECIPES), cols: [['profession', 'VARCHAR(16)', r => r.prof], ['skill', 'SMALLINT UNSIGNED', r => r.skill], ['makes', 'VARCHAR(64)', r => r.makes]] },
    { name: 'acts', rows: () => C.ACTS.map(a => ['act_' + a.n, a]), cols: [['act_no', 'TINYINT UNSIGNED', r => r.n], ['zone_id', 'VARCHAR(64)', r => r.zone, 'zones']] },
    { name: 'chapters', rows: () => C.CHAPTERS.map((c, i) => ['ch_' + (i + 1), { act: c[0], name: c[1], goal: c[2], text: c[3] }]), cols: [['act_id', 'VARCHAR(64)', r => 'act_' + r.act, 'acts'], ['goal', 'VARCHAR(64)', r => r.goal]] },
  ];
}

// ---------------------------------------------------------------- SQL helpers
function lit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') { if (!Number.isFinite(v)) return 'NULL'; return String(v); }
  // MySQL string literal: escape backslash, quote and control characters (NO_BACKSLASH_ESCAPES is off by default)
  return "'" + String(v).replace(/[\0\n\r\b\t\x1a\\']/g, c => ({ '\0': '\\0', '\n': '\\n', '\r': '\\r', '\b': '\\b', '\t': '\\t', '\x1a': '\\Z', '\\': '\\\\', "'": "\\'" })[c]) + "'";
}
const ident = s => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('bad identifier ' + s); return '`' + s + '`'; };
const nameOf = (r, k) => String(r && (r.name || r.title) || up(k)).slice(0, 96);
function insertRows(table, columns, rows, chunk = 200) {
  const out = [];
  for (let i = 0; i < rows.length; i += chunk)
    out.push(`INSERT INTO ${ident(table)} (${columns.map(ident).join(', ')}) VALUES\n` + rows.slice(i, i + chunk).map(r => '  (' + r.map(lit).join(', ') + ')').join(',\n') + ';');
  return out.join('\n');
}

// ---------------------------------------------------------------- realm tables (what backend/server.cjs keeps in realm.json)
const REALM_SCHEMA = `
-- ---------------------------------------------------------------- realm (live server state)
CREATE TABLE \`accounts\` (
  \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(16) NOT NULL,
  \`name_key\` VARCHAR(16) NOT NULL UNIQUE,
  \`password_hash\` CHAR(128) NOT NULL,
  \`password_salt\` CHAR(32) NOT NULL,
  \`staff_role\` ENUM('player','moderator','admin','root') NOT NULL DEFAULT 'player',
  \`banned_reason\` VARCHAR(200) NULL,
  \`created_at\` DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE \`characters\` (
  \`account_id\` VARCHAR(64) NOT NULL,
  \`slot\` TINYINT UNSIGNED NOT NULL,
  \`name\` VARCHAR(12) NOT NULL,
  \`class_id\` VARCHAR(64) NULL,
  \`level\` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  \`state\` JSON NOT NULL,
  \`saved_at\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`account_id\`, \`slot\`),
  CONSTRAINT \`fk_characters_account\` FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE \`friendships\` (
  \`account_id\` VARCHAR(64) NOT NULL,
  \`friend_id\` VARCHAR(64) NOT NULL,
  \`status\` ENUM('friends','requested') NOT NULL,
  PRIMARY KEY (\`account_id\`, \`friend_id\`),
  CONSTRAINT \`fk_friend_a\` FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_friend_b\` FOREIGN KEY (\`friend_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE \`guilds\` (
  \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
  \`name\` VARCHAR(20) COLLATE utf8mb4_general_ci NOT NULL,
  \`tag\` VARCHAR(4) NOT NULL UNIQUE,
  \`motd\` VARCHAR(120) NOT NULL DEFAULT '',
  \`gold\` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  \`created_at\` DATETIME(3) NOT NULL,
  UNIQUE KEY \`uq_guild_name\` (\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE \`guild_members\` (
  \`guild_id\` VARCHAR(64) NOT NULL,
  \`account_id\` VARCHAR(64) NOT NULL PRIMARY KEY,
  \`guild_rank\` ENUM('recruit','member','officer','leader') NOT NULL,
  \`joined_at\` DATETIME(3) NOT NULL,
  KEY \`ix_guild_members_guild\` (\`guild_id\`),
  CONSTRAINT \`fk_gm_guild\` FOREIGN KEY (\`guild_id\`) REFERENCES \`guilds\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_gm_account\` FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE \`guild_bank_items\` (
  \`guild_id\` VARCHAR(64) NOT NULL,
  \`tab\` TINYINT UNSIGNED NOT NULL,
  \`slot\` TINYINT UNSIGNED NOT NULL,
  \`item\` JSON NOT NULL,
  PRIMARY KEY (\`guild_id\`, \`tab\`, \`slot\`),
  CONSTRAINT \`fk_gbi_guild\` FOREIGN KEY (\`guild_id\`) REFERENCES \`guilds\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE \`market_listings\` (
  \`id\` VARCHAR(32) NOT NULL PRIMARY KEY,
  \`seller_id\` VARCHAR(64) NOT NULL,
  \`seller_name\` VARCHAR(12) NOT NULL,
  \`item\` JSON NULL,
  \`stack_item_id\` VARCHAR(64) NULL,
  \`stack_count\` SMALLINT UNSIGNED NULL,
  \`price\` BIGINT UNSIGNED NOT NULL,
  \`listed_at\` DATETIME(3) NOT NULL,
  \`expires_at\` DATETIME(3) NOT NULL,
  KEY \`ix_market_expires\` (\`expires_at\`),
  CONSTRAINT \`fk_market_seller\` FOREIGN KEY (\`seller_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE \`leaderboard\` (
  \`account_id\` VARCHAR(64) NOT NULL PRIMARY KEY,
  \`hero_name\` VARCHAR(12) NOT NULL,
  \`class_id\` VARCHAR(16) NULL,
  \`level\` SMALLINT UNSIGNED NOT NULL,
  \`achievement_points\` INT UNSIGNED NOT NULL DEFAULT 0,
  \`tower_floor\` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  \`rating\` INT UNSIGNED NOT NULL DEFAULT 1000,
  \`chapter\` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  \`updated_at\` DATETIME(3) NOT NULL,
  KEY \`ix_leaderboard_level\` (\`level\`),
  CONSTRAINT \`fk_lb_account\` FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
`;

// ---------------------------------------------------------------- build
function build(C) {
  const defs = tables(C), schema = [], seed = [], counts = {};
  const known = Object.fromEntries(defs.map(d => [d.name, new Set(d.rows().map(([k]) => String(k)))]));
  schema.push(`-- Lost Kingdom of Shadowbane Chronicles: database schema v${SCHEMA_VERSION}`, '-- GENERATED by tools/export_sql.cjs from src/*.js. Do not edit; re-run the tool.', '-- MySQL 8.0+ / MariaDB 10.6+', 'SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS = 0;', '');
  schema.push('CREATE TABLE `schema_info` (`schema_version` INT UNSIGNED NOT NULL, `game_version` VARCHAR(32) NOT NULL, `generated_at` DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;', '');
  seed.push('-- Lost Kingdom of Shadowbane Chronicles: catalogue seed data', '-- GENERATED by tools/export_sql.cjs from src/*.js. Do not edit; re-run the tool.', 'SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS = 0;', '');
  for (const d of defs) {
    const cols = d.cols || [], fks = cols.filter(c => c[3]);
    const lines = ['  `id` VARCHAR(64) NOT NULL PRIMARY KEY', '  `num` INT UNSIGNED NOT NULL', '  `name` VARCHAR(96) NOT NULL',
      ...cols.map(([c, t, , ref]) => `  ${ident(c)} ${t} NULL`), '  `data` JSON NOT NULL', `  UNIQUE KEY ${ident('uq_' + d.name + '_num')} (\`num\`)`, `  KEY ${ident('ix_' + d.name + '_name')} (\`name\`)`,
      ...fks.map(([c, , , ref]) => `  CONSTRAINT ${ident('fk_' + d.name + '_' + c)} FOREIGN KEY (${ident(c)}) REFERENCES ${ident(ref)} (\`id\`)`)];
    schema.push(`CREATE TABLE ${ident(d.name)} (\n${lines.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;`, '');
    const rows = d.rows().map(([k, r], i) => {
      const vals = cols.map(([c, , f, ref]) => {
        const v = f(r, k);
        // a reference to something the catalogues do not define becomes NULL (it stays visible in data)
        return ref && v != null && !known[ref].has(String(v)) ? null : v;
      });
      return [String(k), i + 1, nameOf(r, k), ...vals, JSON.stringify(r)];
    });
    counts[d.name] = rows.length;
    seed.push(`-- ${d.name}: ${rows.length}`, insertRows(d.name, ['id', 'num', 'name', ...cols.map(c => c[0]), 'data'], rows), '');
  }
  schema.push(REALM_SCHEMA.trim(), '', 'SET FOREIGN_KEY_CHECKS = 1;', '');
  const version = C.BUILD && C.BUILD.version ? `${C.BUILD.version} ${C.BUILD.build || ''}`.trim() : 'unknown';
  seed.push(`INSERT INTO \`schema_info\` VALUES (${SCHEMA_VERSION}, ${lit(String(version))}, '2000-01-01 00:00:00');`, 'UPDATE `schema_info` SET `generated_at` = NOW();', '', 'SET FOREIGN_KEY_CHECKS = 1;', '');
  return { schema: schema.join('\n'), seed: seed.join('\n'), counts };
}

// realm.json -> INSERTs for the realm tables (one-off migration)
function realmSql(db) {
  const dt = ms => { const n = +ms; return Number.isFinite(n) && n > 0 ? new Date(n).toISOString().slice(0, 23).replace('T', ' ') : '1970-01-01 00:00:01.000'; };
  const out = ['-- realm snapshot GENERATED by tools/export_sql.cjs --realm. Contains password hashes: do not commit or share.', 'SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS = 0;', ''];
  const accts = Object.entries(db.accounts || {}), ids = new Set(accts.map(([, a]) => a.id));
  const role = id => ['moderator', 'admin', 'root'].includes((db.staffRoles || {})[id]) ? db.staffRoles[id] : 'player';
  const ban = id => (db.bans || {})[id] ? String(db.bans[id].reason || 'banned').slice(0, 200) : null;
  if (accts.length) out.push(insertRows('accounts', ['id', 'name', 'name_key', 'password_hash', 'password_salt', 'staff_role', 'banned_reason', 'created_at'], accts.map(([key, a]) => [a.id, a.name, key, a.hash, a.salt, role(a.id), ban(a.id), dt(a.created)])));
  const chars = []; for (const [uid, slots] of Object.entries(db.saves || {})) if (ids.has(uid)) for (const [slot, s] of Object.entries(slots)) if (s && s.meta) chars.push([uid, +slot, s.meta.name, s.meta.cls, s.meta.lvl, JSON.stringify(s.state), dt(s.saved)]);
  if (chars.length) out.push(insertRows('characters', ['account_id', 'slot', 'name', 'class_id', 'level', 'state', 'saved_at'], chars, 20));
  const fr = new Map();
  for (const [uid, list] of Object.entries(db.friendships || {})) for (const f of list) if (ids.has(uid) && ids.has(f)) fr.set(uid + '|' + f, [uid, f, 'friends']);
  for (const [uid, list] of Object.entries(db.friendRequests || {})) for (const f of list) if (ids.has(uid) && ids.has(f) && !fr.has(f + '|' + uid)) fr.set(f + '|' + uid, [f, uid, 'requested']);
  if (fr.size) out.push(insertRows('friendships', ['account_id', 'friend_id', 'status'], [...fr.values()]));
  const guilds = Object.values(db.guilds || {});
  if (guilds.length) {
    out.push(insertRows('guilds', ['id', 'name', 'tag', 'motd', 'gold', 'created_at'], guilds.map(g => [g.id, g.name, g.tag, g.motd || '', g.gold || 0, dt(g.created)])));
    const members = guilds.flatMap(g => g.members.filter(m => ids.has(m.uid)).map(m => [g.id, m.uid, m.rank, dt(m.joined)]));
    if (members.length) out.push(insertRows('guild_members', ['guild_id', 'account_id', 'guild_rank', 'joined_at'], members));
    const bank = guilds.flatMap(g => g.bank.flatMap((tab, t) => tab.map((it, s) => [g.id, t, s, JSON.stringify(it)])));
    if (bank.length) out.push(insertRows('guild_bank_items', ['guild_id', 'tab', 'slot', 'item'], bank));
  }
  const listings = Object.values(db.market || {}).filter(l => ids.has(l.seller));
  if (listings.length) out.push(insertRows('market_listings', ['id', 'seller_id', 'seller_name', 'item', 'stack_item_id', 'stack_count', 'price', 'listed_at', 'expires_at'], listings.map(l => [l.id, l.seller, l.sellerName, l.item ? JSON.stringify(l.item) : null, l.stack ? l.stack.id : null, l.stack ? l.stack.n : null, l.price, dt(l.ts), dt(l.expires)])));
  const heroes = Object.entries(db.heroes || {}).filter(([uid]) => ids.has(uid));
  if (heroes.length) out.push(insertRows('leaderboard', ['account_id', 'hero_name', 'class_id', 'level', 'achievement_points', 'tower_floor', 'rating', 'chapter', 'updated_at'], heroes.map(([uid, h]) => [uid, h.name, h.cls || null, h.lvl, h.ach, h.tower, h.rating, h.ch, dt(h.ts)])));
  out.push('', 'SET FOREIGN_KEY_CHECKS = 1;', '');
  return out.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const outDir = path.resolve(opt('--out') || path.join(ROOT, 'data', 'sql'));
  fs.mkdirSync(outDir, { recursive: true });
  const { schema, seed, counts } = build(loadCatalogues());
  fs.writeFileSync(path.join(outDir, 'schema.sql'), schema); fs.writeFileSync(path.join(outDir, 'seed.sql'), seed);
  console.log(`wrote ${path.relative(ROOT, outDir) || '.'}/schema.sql and seed.sql: ${Object.values(counts).reduce((a, b) => a + b, 0)} rows in ${Object.keys(counts).length} catalogue tables`);
  const realm = opt('--realm');
  if (realm) { fs.writeFileSync(path.join(outDir, 'realm.sql'), realmSql(JSON.parse(fs.readFileSync(realm, 'utf8')))); console.log(`wrote realm.sql from ${realm} (contains password hashes: keep it private)`); }
}
module.exports = { SCHEMA_VERSION, loadCatalogues, tables, build, realmSql, lit };
