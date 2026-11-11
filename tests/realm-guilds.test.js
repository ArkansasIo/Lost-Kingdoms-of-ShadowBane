import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const G = require("../backend/guilds.cjs");

const who = (uid, name = uid.toUpperCase(), now = 1_700_000_000_000) => ({ uid, name, now });

function guildWith(...extra) {
  const db = {};
  const r = G.create(db, who("lead"), { name: "Iron Wolves", tag: "wolf" });
  assert.equal(r.ok, true);
  for (const [uid, rank] of extra) {
    assert.equal(G.invite(db, who("lead"), uid, uid).ok, true);
    assert.equal(G.accept(db, who(uid), r.guild.id).ok, true);
    if (rank !== "recruit") assert.equal(G.setRank(db, who("lead"), uid, rank).ok, true);
  }
  return { db, g: r.guild };
}

test("guild names and tags are validated and unique", () => {
  const db = {};
  assert.equal(G.create(db, who("a"), { name: "x", tag: "ab" }).code, 400);
  assert.equal(G.create(db, who("a"), { name: "Good Name", tag: "!" }).code, 400);
  const ok = G.create(db, who("a"), { name: "Good Name", tag: "gn" });
  assert.equal(ok.guild.tag, "GN");
  assert.equal(G.create(db, who("b"), { name: "good name", tag: "zz" }).code, 409, "name is case-insensitive unique");
  assert.equal(G.create(db, who("b"), { name: "Other", tag: "Gn" }).code, 409, "tag is unique");
  assert.equal(G.create(db, who("a"), { name: "Second", tag: "SE" }).code, 409, "one guild per account");
});

test("invites expire, only officers invite, and new members join as recruits", () => {
  const { db, g } = guildWith(["off", "officer"], ["mem", "member"]);
  assert.equal(G.invite(db, who("mem"), "x", "x").code, 403);
  assert.equal(G.invite(db, who("off"), "x", "x").ok, true);
  assert.equal(G.accept(db, who("x", "X", 1_700_000_000_000 + 8 * 864e5), g.id).code, 404, "a week-old invite has expired");
  assert.equal(G.invite(db, who("off"), "y", "y").ok, true);
  assert.deepEqual(G.invitesFor(db, "y", 1_700_000_000_000).map(i => i.tag), ["WOLF"]);
  assert.equal(G.accept(db, who("y"), g.id).ok, true);
  assert.equal(g.members.find(m => m.uid === "y").rank, "recruit");
  assert.equal(G.invite(db, who("lead"), "y", "y").code, 409, "already in a guild");
});

test("kicks and ranks respect the hierarchy; leadership can be passed on", () => {
  const { db, g } = guildWith(["off", "officer"], ["off2", "officer"], ["mem", "member"]);
  assert.equal(G.kick(db, who("off"), "off2").code, 403, "officers cannot remove officers");
  assert.equal(G.kick(db, who("mem"), "off").code, 403);
  assert.equal(G.kick(db, who("off"), "mem").ok, true);
  assert.equal(G.guildFor(db, "mem"), undefined);
  assert.equal(G.setRank(db, who("off"), "off2", "member").code, 403, "only the leader sets ranks");
  assert.equal(G.leave(db, who("lead")).code, 409, "leader must pass leadership first");
  assert.equal(G.setRank(db, who("lead"), "off", "leader").ok, true);
  assert.equal(g.members.find(m => m.uid === "off").rank, "leader");
  assert.equal(g.members.find(m => m.uid === "lead").rank, "officer");
  assert.equal(G.leave(db, who("lead")).ok, true);
});

test("guild bank: soulbound refused, tabs fill, recruits cannot withdraw, daily caps apply", () => {
  const { db, g } = guildWith(["off", "officer"], ["mem", "member"], ["rec", "recruit"]);
  assert.equal(G.deposit(db, who("rec"), { tab: 0, item: { id: "ring", bound: true } }).code, 400);
  assert.equal(G.deposit(db, who("rec"), { tab: 3, item: { id: "ring" } }).code, 400);
  assert.equal(G.deposit(db, who("rec"), { tab: 0, item: { id: "x", pad: "a".repeat(5000) } }).code, 413);
  for (let i = 0; i < G.TAB_SIZE; i++) assert.equal(G.deposit(db, who("rec"), { tab: 0, item: { id: "potion" + i, name: "POTION " + i } }).ok, true);
  assert.equal(G.deposit(db, who("rec"), { tab: 0, item: { id: "extra" } }).code, 409, "tab full");
  assert.equal(G.withdraw(db, who("rec"), { tab: 0, slot: 0 }).code, 403);

  // expect guards against a slot that changed under the player
  assert.equal(G.withdraw(db, who("mem"), { tab: 0, slot: 0, expect: "potion5" }).code, 409);
  for (let i = 0; i < G.DAILY_ITEM_WITHDRAWALS.member; i++) assert.equal(G.withdraw(db, who("mem"), { tab: 0, slot: 0 }).ok, true);
  assert.equal(G.withdraw(db, who("mem"), { tab: 0, slot: 0 }).code, 429, "member daily item cap");
  assert.equal(G.withdraw(db, who("mem", "MEM", 1_700_000_000_000 + 864e5), { tab: 0, slot: 0 }).ok, true, "cap resets the next day");
  assert.equal(g.bank[0].length, G.TAB_SIZE - G.DAILY_ITEM_WITHDRAWALS.member - 1);

  // gold vault
  assert.equal(G.deposit(db, who("rec"), { gold: 100000 }).gold, 100000);
  assert.equal(G.withdraw(db, who("mem"), { gold: 1 }).code, 403, "members cannot take gold");
  assert.equal(G.withdraw(db, who("off"), { gold: 60000 }).code, 429, "officer daily gold cap");
  assert.equal(G.withdraw(db, who("off"), { gold: 50000 }).ok, true);
  assert.equal(G.withdraw(db, who("lead"), { gold: 60000 }).code, 409, "not enough in the vault");
  assert.equal(G.withdraw(db, who("lead"), { gold: 50000 }).vault, 0);
  assert.equal(G.deposit(db, who("rec"), { gold: -5 }).code, 400);
  assert.equal(G.deposit(db, who("rec"), { gold: 5, item: { id: "x" } }).code, 400, "one thing at a time");
});

test("a guild with a stocked bank cannot be disbanded; an empty one can", () => {
  const { db, g } = guildWith(["mem", "member"]);
  G.deposit(db, who("mem"), { gold: 10 });
  assert.equal(G.disband(db, who("mem")).code, 403);
  assert.equal(G.disband(db, who("lead")).code, 409);
  G.withdraw(db, who("lead"), { gold: 10 });
  assert.equal(G.disband(db, who("lead")).ok, true);
  assert.equal(db.guilds[g.id], undefined);
  assert.equal(G.guildFor(db, "mem"), undefined);
  assert.equal(G.guildFor(db, "lead"), undefined);
});

test("guild ids of prototype names are not guilds", () => {
  const db = {};
  assert.equal(G.accept(db, who("a"), "__proto__").code, 404);
  assert.equal(G.accept(db, who("a"), "constructor").code, 404);
  assert.equal(G.guildFor(db, "__proto__"), undefined);
});

// ---------------------------------------------------------------- through the realm server
function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["backend/server.cjs"], { env: { ...process.env, HOST: "127.0.0.1", GBQ_ROOT_ID: "", GBQ_ADMIN_ID: "", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; const timer = setTimeout(() => { child.kill(); reject(new Error("no start: " + out)); }, 8000);
    const on = d => { out += d; if (out.includes("realm server on")) { clearTimeout(timer); resolve(child); } };
    child.stdout.on("data", on); child.stderr.on("data", on);
  });
}
const stop = child => new Promise(r => { child.on("exit", r); child.kill("SIGTERM"); });

test("realm server: guild lifecycle and bank over HTTP", async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "gbq-guild-")), port = String(20000 + Math.floor(Math.random() * 20000)), base = `http://127.0.0.1:${port}`;
  const call = async (p, { method = "GET", body, token } = {}) => {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const server = await startServer({ PORT: port, GBQ_DATA: data, GBQ_LOG_DIR: path.join(data, "logs") });
  try {
    const reg = async n => (await call("/api/register", { method: "POST", body: { username: n, password: "password1" } })).body.token;
    const ann = await reg("ann"), ben = await reg("ben");
    assert.deepEqual((await call("/api/guild", { token: ann })).body, { guild: null, invites: [] });
    const made = await call("/api/guild", { method: "POST", token: ann, body: { name: "Dawn Riders", tag: "DR" } });
    assert.equal(made.status, 201);
    assert.equal(made.body.guild.myRank, "leader");
    assert.equal((await call("/api/guild/invite", { method: "POST", token: ann, body: { username: "nobody" } })).status, 404);
    assert.equal((await call("/api/guild/invite", { method: "POST", token: ann, body: { username: "ben" } })).status, 200);
    const inv = (await call("/api/guild", { token: ben })).body.invites;
    assert.equal(inv[0].name, "Dawn Riders");
    const joined = await call("/api/guild/accept", { method: "POST", token: ben, body: { id: inv[0].id } });
    assert.equal(joined.body.guild.myRank, "recruit");
    assert.equal((await call("/api/guild/bank/deposit", { method: "POST", token: ben, body: { tab: 0, item: { id: "sword", name: "IRON SWORD" } } })).status, 200);
    assert.equal((await call("/api/guild/bank/withdraw", { method: "POST", token: ben, body: { tab: 0, slot: 0 } })).status, 403);
    const benId = joined.body.guild.members.find(m => m.name === "ben").id;
    assert.equal((await call("/api/guild/rank", { method: "POST", token: ann, body: { accountId: benId, rank: "member" } })).status, 200);
    const took = await call("/api/guild/bank/withdraw", { method: "POST", token: ben, body: { tab: 0, slot: 0, expect: "sword" } });
    assert.equal(took.body.item.name, "IRON SWORD");
    assert.deepEqual(took.body.guild.bank.tabs[0], []);
    assert.equal((await call("/api/guilds", { token: ben })).body.guilds[0].members, 2);
    assert.equal((await call("/api/guild/frob", { method: "POST", token: ben, body: {} })).status, 404);
  } finally { await stop(server); }
  const db = JSON.parse(fs.readFileSync(path.join(data, "realm.json"), "utf8"));
  assert.equal(Object.values(db.guilds)[0].members.length, 2, "guilds are saved with the realm");
});
