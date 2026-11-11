import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const X = require("../tools/export_sql.cjs");
const C = X.loadCatalogues();
const out = X.build(C);

test("every catalogue table has rows with unique ids and 1-based numbers", () => {
  for (const t of X.tables(C)) {
    const rows = t.rows();
    assert.ok(rows.length > 0, `${t.name} has rows`);
    const ids = rows.map(([k]) => String(k));
    assert.equal(new Set(ids).size, ids.length, `${t.name} ids are unique`);
    assert.ok(ids.every(id => id.length <= 64), `${t.name} ids fit VARCHAR(64)`);
    assert.equal(out.counts[t.name], rows.length);
  }
  assert.equal(out.counts.creatures, C.BESTIARY.length);
  assert.equal(out.counts.bosses, 350);
  assert.equal(out.counts.zones, C.ZONES.length);
});

test("foreign keys in the catalogues point at rows that exist", () => {
  const defs = X.tables(C), ids = Object.fromEntries(defs.map(d => [d.name, new Set(d.rows().map(([k]) => String(k)))]));
  for (const d of defs) for (const [col, , f, ref] of d.cols || []) {
    if (!ref) continue;
    assert.ok(ids[ref], `${d.name}.${col} references a generated table`);
    const missing = d.rows().map(([k, r]) => f(r, k)).filter(v => v != null && !ids[ref].has(String(v)));
    assert.deepEqual(missing, [], `${d.name}.${col} -> ${ref}`);
  }
});

test("schema creates every table, and the seed inserts into each, in a loadable order", () => {
  for (const t of X.tables(C)) {
    assert.match(out.schema, new RegExp("CREATE TABLE `" + t.name + "` \\("));
    assert.match(out.seed, new RegExp("INSERT INTO `" + t.name + "` \\("));
  }
  for (const t of ["accounts", "characters", "friendships", "guilds", "guild_members", "guild_bank_items", "market_listings", "leaderboard"]) assert.match(out.schema, new RegExp("CREATE TABLE `" + t + "`"));
  assert.match(out.schema, /SET FOREIGN_KEY_CHECKS = 0;/);
  assert.match(out.seed, /INSERT INTO `schema_info` VALUES \(1, '2\.1\.1/);
});

test("string literals are escaped for MySQL", () => {
  assert.equal(X.lit("it's"), "'it\\'s'");
  assert.equal(X.lit("a\\b"), "'a\\\\b'");
  assert.equal(X.lit("x\ny\0"), "'x\\ny\\0'");
  assert.equal(X.lit(null), "NULL");
  assert.equal(X.lit(Infinity), "NULL");
  assert.equal(X.lit(true), "1");
});

test("a realm.json snapshot becomes INSERTs for the realm tables, skipping dangling references", () => {
  const db = {
    accounts: { ann: { id: "u1", name: "ann", hash: "a".repeat(128), salt: "b".repeat(32), created: 1700000000000 } },
    staffRoles: { u1: "admin" }, bans: {},
    saves: { u1: { 0: { state: { name: "ANN", cls: "warden" }, saved: 1700000000000, meta: { name: "ANN", lvl: 3, cls: "warden" } } }, ghost: { 0: { meta: { name: "X", lvl: 1 }, state: {} } } },
    friendships: { u1: ["ghost"] }, friendRequests: {},
    guilds: { g1: { id: "g1", name: "Dawn", tag: "DW", motd: "", gold: 5, created: 1700000000000, members: [{ uid: "u1", rank: "leader", joined: 1700000000000 }, { uid: "ghost", rank: "member", joined: 1 }], bank: [[{ id: "sword" }], [], []] } },
    market: {}, heroes: { u1: { name: "ANN", cls: "warden", lvl: 3, ach: 0, tower: 0, rating: 1000, ch: 0, ts: 1700000000000 } },
  };
  const sql = X.realmSql(db);
  assert.match(sql, /INSERT INTO `accounts`[^;]*'u1', 'ann', 'ann'[^;]*'admin'/);
  assert.match(sql, /INSERT INTO `characters`/);
  assert.doesNotMatch(sql, /'ghost'/, "rows for accounts that no longer exist are dropped");
  assert.match(sql, /INSERT INTO `guild_bank_items`[^;]*'g1', 0, 0, '\{"id":"sword"\}'/);
  assert.match(sql, /INSERT INTO `leaderboard`/);
  assert.match(sql, /2023-11-14 22:13:20\.000/);
});
