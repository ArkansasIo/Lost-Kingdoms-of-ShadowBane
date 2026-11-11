import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("atlas data covers Valendria and every expansion world", () => {
  const data = JSON.parse(read("atlas/atlas.json"));
  const worlds = data.worlds.map(w => w.n);
  assert.deepEqual(worlds, [0, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(data.zones.length, data.counts.zones, "every zone is on some map");
  for (const n of worlds) assert.ok(data.zones.some(z => z.world === n), `world ${n} has zones`);
  const Z = Object.fromEntries(data.zones.map(z => [z.id, z]));
  for (const e of data.edges) assert.equal(!!e.voyage, Z[e.a].world !== Z[e.b].world, `${e.a}-${e.b}: only links between maps are voyages`);
  for (const z of data.zones) assert.ok(z.x > 0 && z.x < 1592 && z.y > 0 && z.y < 988, `${z.id} is on its map`);
});

test("the atlas template has a world switcher and the build embeds each world's painted map", () => {
  const tpl = read("atlas/atlas_template.html");
  assert.match(tpl, /id="worldSel"/);
  assert.match(tpl, /const WORLD_MAPS = __WORLDMAPS__;/);
  assert.match(tpl, /function setWorld\(/);
  const built = read("dist/atlas.html");
  assert.doesNotMatch(built, /__WORLDMAPS__|__DATA__|__MAP__/);
  const maps = JSON.parse(built.match(/const WORLD_MAPS = (\{.*?\});/)[1]);
  assert.deepEqual(Object.keys(maps).map(Number).sort((a, b) => a - b), [6, 7, 8, 9, 10, 11, 12, 13]);
  for (const uri of Object.values(maps)) assert.match(uri, /^data:image\/png;base64,/);
});
