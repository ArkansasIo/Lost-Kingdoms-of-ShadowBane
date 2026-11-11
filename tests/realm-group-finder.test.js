import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const F = require("../backend/groupfinder.cjs");
const T0 = 1_700_000_000_000;
const P = uid => ({ uid, name: uid.toUpperCase() });

function queueDungeon(f, specs, t = T0) {
  const events = [];
  specs.forEach(([uid, roles, level = 30], i) => {
    const r = F.join(f, P(uid), { activity: "crypt", mode: "dungeon", roles, level }, t + i);
    assert.equal(r.ok, true, `${uid} queued`);
    events.push(...r.formed);
  });
  return events;
}

test("join validates the activity, roles and level", () => {
  const f = F.createFinder();
  assert.equal(F.join(f, P("a"), { activity: "crypt", mode: "pvp", roles: ["tank"], level: 10 }).code, 400);
  assert.equal(F.join(f, P("a"), { activity: "bad activity!", roles: ["tank"], level: 10 }).code, 400);
  assert.equal(F.join(f, P("a"), { activity: "crypt", roles: ["wizard"], level: 10 }).code, 400);
  assert.equal(F.join(f, P("a"), { activity: "crypt", roles: ["tank"], level: 721 }).code, 400);
  assert.equal(F.join(f, P("a"), { activity: "crypt", roles: "tank", level: 10 }).status.state, "queued", "a single role string works");
});

test("a dungeon group needs 1 tank, 1 healer and 3 damage; flexible players fill scarce roles", () => {
  const f = F.createFinder();
  const events = queueDungeon(f, [["d1", ["damage"]], ["d2", ["damage"]], ["flex", ["tank", "damage"]], ["d3", ["damage"]], ["d4", ["damage"]]]);
  assert.equal(events.length, 0, "no healer yet");
  assert.deepEqual(F.status(f, "d1").counts, { tank: 1, healer: 0, damage: 5 });
  const [ev] = queueDungeon(f, [["h", ["healer"]]], T0 + 100);
  assert.equal(ev.type, "ready-check");
  const roles = Object.fromEntries(ev.check.members.map(m => [m.uid, m.role]));
  assert.equal(roles.flex, "tank", "the flexible player tanks");
  assert.equal(roles.h, "healer");
  assert.deepEqual(Object.keys(roles).sort(), ["d1", "d2", "d3", "flex", "h"], "oldest damage dealers win; d4 waits");
  assert.equal(F.status(f, "d4").state, "queued");
});

test("players far apart in level are not grouped together", () => {
  const f = F.createFinder();
  const events = queueDungeon(f, [["t", ["tank"], 10], ["h", ["healer"], 200], ["d1", ["damage"], 10], ["d2", ["damage"], 12], ["d3", ["damage"], 15]]);
  assert.equal(events.length, 0);
  const [ev] = queueDungeon(f, [["h2", ["healer"], 20]], T0 + 50);
  assert.ok(ev && ev.check.members.every(m => m.level <= 25));
});

test("ready check: all accept -> grouped; a decline requeues the others in their old order", () => {
  const f = F.createFinder();
  queueDungeon(f, [["t", ["tank"]], ["h", ["healer"]], ["d1", ["damage"]], ["d2", ["damage"]], ["d3", ["damage"]]]);
  assert.equal(F.status(f, "t").state, "ready-check");
  assert.equal(F.join(f, P("t"), { activity: "crypt", roles: ["tank"], level: 30 }).code, 409);
  const declined = F.respond(f, "d2", false, T0 + 1000);
  assert.equal(declined.events[0].type, "ready-failed");
  assert.deepEqual(declined.events[0].dropped, ["d2"]);
  assert.equal(F.status(f, "d2").state, "idle");
  assert.equal(F.status(f, "t").state, "queued");
  assert.equal(F.status(f, "t", T0 + 1000).waitedMs, 1000, "kept the original queue time");

  const [ev] = queueDungeon(f, [["d4", ["damage"]]], T0 + 2000);
  assert.equal(ev.type, "ready-check");
  let last;
  for (const m of ev.check.members) last = F.respond(f, m.uid, true, T0 + 2500);
  assert.equal(last.events[0].type, "grouped");
  assert.equal(last.events[0].group.members.length, 5);
  assert.equal(F.status(f, "d4").state, "grouped");
  assert.equal(F.leave(f, "d4").left, "group");
});

test("unanswered ready checks drop the silent players and requeue the ones who accepted", () => {
  const f = F.createFinder();
  queueDungeon(f, [["t", ["tank"]], ["h", ["healer"]], ["d1", ["damage"]], ["d2", ["damage"]], ["d3", ["damage"]]]);
  F.respond(f, "t", true, T0 + 10);
  F.respond(f, "h", true, T0 + 10);
  const events = F.tick(f, T0 + F.READY_MS + 100);
  assert.equal(events[0].type, "ready-failed");
  assert.deepEqual(events[0].requeued.sort(), ["h", "t"]);
  assert.deepEqual(events[0].dropped.sort(), ["d1", "d2", "d3"]);
  assert.equal(F.status(f, "d1").state, "idle");
  assert.equal(F.status(f, "t").state, "queued");
});

test("stale queue entries expire and the overview counts roles per activity", () => {
  const f = F.createFinder();
  F.join(f, P("a"), { activity: "crypt", roles: ["tank", "healer"], level: 5 }, T0);
  F.join(f, P("b"), { activity: "spire", mode: "raid", roles: ["damage"], level: 5 }, T0);
  assert.deepEqual(F.overview(f).find(o => o.activity === "crypt"), { mode: "dungeon", activity: "crypt", queued: 1, tank: 1, healer: 1, damage: 0 });
  F.tick(f, T0 + F.QUEUE_TTL + 1);
  assert.deepEqual(F.overview(f), []);
  assert.equal(F.leave(f, "a").code, 404);
});

test("realm server: three players form a trial group over HTTP", async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "gbq-finder-")), port = String(20000 + Math.floor(Math.random() * 20000)), base = `http://127.0.0.1:${port}`;
  const call = async (p, { method = "GET", body, token } = {}) => {
    const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const server = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["backend/server.cjs"], { env: { ...process.env, HOST: "127.0.0.1", PORT: port, GBQ_DATA: data, GBQ_LOG_DIR: path.join(data, "logs"), GBQ_ROOT_ID: "", GBQ_ADMIN_ID: "" }, stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; const timer = setTimeout(() => { child.kill(); reject(new Error("no start: " + out)); }, 8000);
    const on = d => { out += d; if (out.includes("realm server on")) { clearTimeout(timer); resolve(child); } };
    child.stdout.on("data", on); child.stderr.on("data", on);
  });
  try {
    const tok = {};
    for (const n of ["tia", "hal", "dax"]) tok[n] = (await call("/api/register", { method: "POST", body: { username: n, password: "password1" } })).body.token;
    const join = (n, role) => call("/api/finder/join", { method: "POST", token: tok[n], body: { activity: "frost_trial", mode: "trial", roles: [role], level: 40 } });
    assert.equal((await join("tia", "tank")).body.status.state, "queued");
    assert.equal((await join("hal", "healer")).body.status.state, "queued");
    const last = await join("dax", "damage");
    assert.equal(last.body.status.state, "ready-check");
    for (const n of ["tia", "hal"]) assert.equal((await call("/api/finder/ready", { method: "POST", token: tok[n], body: { accept: true } })).body.status.state, "ready-check");
    const done = await call("/api/finder/ready", { method: "POST", token: tok.dax, body: { accept: true } });
    assert.equal(done.body.status.state, "grouped");
    assert.deepEqual(done.body.status.group.members.map(m => m.role), ["tank", "healer", "damage"]);
    assert.equal((await call("/api/finder", { token: tok.hal })).body.status.state, "grouped");
    assert.equal((await call("/api/finder/leave", { method: "POST", token: tok.hal })).body.left, "group");
    assert.equal((await call("/api/finder/ready", { method: "POST", token: tok.hal, body: { accept: true } })).status, 404);
  } finally { await new Promise(r => { server.on("exit", r); server.kill("SIGTERM"); }); }
});
