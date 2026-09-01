/**
 * Host-half smoke test: boots apply() against a fake webServer and exercises
 * the route guards without ever spawning the real dsh CLI.
 *
 * Run: node --test test/host.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply } from "../lib/index.js";

// Fixture: a fake DSH profile whose manifest claims dsh-theme-manager 0.2.0.
const root = mkdtempSync(join(tmpdir(), "tm-host-test-"));
const profileDir = join(root, "profiles", "web");
mkdirSync(join(profileDir, "node_modules", "dsh-theme-manager"), { recursive: true });
writeFileSync(join(profileDir, "package.json"), JSON.stringify({
  name: "web",
  version: "0.0.0",
  private: true,
  dependencies: { "dsh-theme-manager": "0.2.0" },
}));
writeFileSync(join(profileDir, "node_modules", "dsh-theme-manager", "package.json"), JSON.stringify({
  name: "dsh-theme-manager",
  version: "0.2.0",
}));
process.env.DSH_HOME = root;

function bootApply(config) {
  let injectCb = null;
  const ctx = {
    get: () => undefined,
    inject: (deps, cb) => { injectCb = cb; },
  };
  apply(ctx, config);
  assert.ok(injectCb, "apply should inject webServer");
  const routes = [];
  let effectFn = null;
  const host = {
    webServer: {
      register: (r) => { routes.push(r); return () => {}; },
    },
    effect: (fn) => { effectFn = fn; return () => {}; },
  };
  injectCb(host);
  effectFn();
  return routes;
}

function makeReq(method, { addr = "::ffff:127.0.0.1", origin = "http://127.0.0.1:3080", host = "127.0.0.1:3080", body } = {}) {
  const r = new EventEmitter();
  r.method = method;
  r.headers = { origin, host };
  r.socket = { remoteAddress: addr };
  r.destroy = () => {};
  if (body !== undefined) {
    const buf = Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    r.headers["content-length"] = buf.length;
    process.nextTick(() => { r.emit("data", buf); r.emit("end"); });
  }
  return r;
}

function makeRes() {
  const r = { status: null, headers: null, chunks: [], body: "", finished: false };
  r.writeHead = (s, h) => { r.status = s; r.headers = h; };
  r.write = (b) => { r.chunks.push(Buffer.from(b)); };
  r.end = (b) => {
    if (b) r.chunks.push(Buffer.from(b));
    r.body = Buffer.concat(r.chunks).toString("utf8");
    r.finished = true;
  };
  r.setTimeout = () => {};
  return r;
}

function route(routes, suffix) {
  const r = routes.find((x) => x.path === suffix);
  assert.ok(r, `route ${suffix} should be registered`);
  return r;
}

test("info reports the installed version and npm source", async () => {
  const routes = bootApply();
  const res = makeRes();
  await route(routes, "/dsh-theme-manager/api/v1/info").handler(makeReq("GET"), res);
  assert.equal(res.status, 200);
  const info = JSON.parse(res.body);
  assert.equal(info.version, "0.2.0");
  assert.equal(info.source, "npm");
  assert.equal(info.canAutoUpdate, true);
  assert.equal(info.profile, "web");
  assert.ok(info.boot && info.boot.length > 0);
});

test("info degrades for an unknown profile", async () => {
  const routes = bootApply({ profile: "nope" });
  const res = makeRes();
  await route(routes, "/dsh-theme-manager/api/v1/info").handler(makeReq("GET"), res);
  const info = JSON.parse(res.body);
  assert.equal(info.version, null);
  assert.equal(info.source, "unknown");
  assert.equal(info.canAutoUpdate, false);
});

test("update rejects non-loopback peers", async () => {
  const routes = bootApply();
  const res = makeRes();
  await route(routes, "/dsh-theme-manager/api/v1/update").handler(
    makeReq("POST", { addr: "10.0.0.7", body: { version: "9.9.9" } }),
    res
  );
  assert.equal(res.status, 403);
});

test("update rejects a mismatched Origin", async () => {
  const routes = bootApply();
  const res = makeRes();
  await route(routes, "/dsh-theme-manager/api/v1/update").handler(
    makeReq("POST", { origin: "http://evil.example", body: { version: "9.9.9" } }),
    res
  );
  assert.equal(res.status, 403);
});

test("update rejects an invalid target version before doing anything", async () => {
  const routes = bootApply();
  const res = makeRes();
  await route(routes, "/dsh-theme-manager/api/v1/update").handler(
    makeReq("POST", { body: { version: "abc" } }),
    res
  );
  assert.equal(res.status, 400);
  assert.match(JSON.parse(res.body).error, /version/);
});

test("rollback without recorded state is refused", async () => {
  const routes = bootApply();
  const res = makeRes();
  await route(routes, "/dsh-theme-manager/api/v1/rollback").handler(
    makeReq("POST", { body: {} }),
    res
  );
  assert.equal(res.status, 400);
  assert.match(JSON.parse(res.body).error, /previous version/);
});

test("restart refuses untrusted peers and disabled configs", async () => {
  const routes = bootApply({ allowRestart: false });
  let res = makeRes();
  await route(routes, "/dsh-theme-manager/api/v1/restart").handler(
    makeReq("POST", { addr: "10.0.0.7" }),
    res
  );
  assert.equal(res.status, 403);
  res = makeRes();
  await route(routes, "/dsh-theme-manager/api/v1/restart").handler(
    makeReq("POST", { body: {} }),
    res
  );
  assert.equal(res.status, 403);
  assert.match(JSON.parse(res.body).error, /restart/);
});

test("GET-only routes reject other methods", async () => {
  const routes = bootApply();
  const res = makeRes();
  await route(routes, "/dsh-theme-manager/api/v1/info").handler(makeReq("POST"), res);
  assert.equal(res.status, 405);
});
