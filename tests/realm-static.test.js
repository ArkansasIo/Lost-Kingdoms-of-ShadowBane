import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";

// The game page is one very large file; the server must gzip it once, keep it in memory and answer reloads with 304.
test("realm server serves game pages gzipped, with ETags and 304 reloads", async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), "gbq-static-")), port = String(20000 + Math.floor(Math.random() * 20000)), base = `http://127.0.0.1:${port}`;
  let out = "";
  const server = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["backend/server.cjs"], { env: { ...process.env, HOST: "127.0.0.1", PORT: port, GBQ_DATA: data, GBQ_LOG_DIR: path.join(data, "logs"), GBQ_ROOT_ID: "", GBQ_ADMIN_ID: "", GBQ_WARM_STATIC: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { child.kill(); reject(new Error("no start: " + out)); }, 8000);
    const on = d => { out += d; if (out.includes("realm server on")) { clearTimeout(timer); resolve(child); } };
    child.stdout.on("data", on); child.stderr.on("data", on);
  });
  try {
    const file = fs.readFileSync(new URL("../dist/atlas.html", import.meta.url));
    // fetch() decompresses on its own; read the raw body to check the encoding
    const raw = await new Promise((resolve, reject) => {
      import("node:http").then(({ default: http }) => http.get(base + "/atlas", { headers: { "Accept-Encoding": "gzip" } }, res => {
        const chunks = []; res.on("data", c => chunks.push(c)); res.on("end", () => resolve({ res, body: Buffer.concat(chunks) }));
      }).on("error", reject));
    });
    assert.equal(raw.res.statusCode, 200);
    assert.equal(raw.res.headers["content-encoding"], "gzip");
    assert.equal(raw.res.headers.vary, "Accept-Encoding");
    assert.ok(zlib.gunzipSync(raw.body).equals(file), "gzip body is the file");
    const etag = raw.res.headers.etag;
    assert.match(etag, /^"[0-9a-z]+-[0-9a-z]+"$/);

    const again = await fetch(base + "/atlas", { headers: { "If-None-Match": etag } });
    assert.equal(again.status, 304, "a reload with the same ETag is not sent again");

    const plain = await new Promise((resolve, reject) => {
      import("node:http").then(({ default: http }) => http.get(base + "/atlas", res => {
        const chunks = []; res.on("data", c => chunks.push(c)); res.on("end", () => resolve({ res, body: Buffer.concat(chunks) }));
      }).on("error", reject));
    });
    assert.equal(plain.res.headers["content-encoding"], undefined, "clients without gzip get the plain file");
    assert.ok(plain.body.equals(file));

    const head = await fetch(base + "/atlas", { method: "HEAD" });
    assert.equal(head.status, 200);
  } finally { await new Promise(r => { server.on("exit", r); server.kill("SIGTERM"); }); }
  assert.doesNotMatch(out, /slow request/, "page loads are not reported as slow");
});
