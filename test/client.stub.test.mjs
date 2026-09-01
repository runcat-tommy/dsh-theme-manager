/**
 * Client-half smoke test: evaluates the ModuleLoader bundle in a stubbed
 * browser environment and exercises the updater boot path.
 *
 * The bundle is hand-written against window.__ModuleLoader__ (no build step),
 * so we capture the factory result directly. DOM APIs are absent here, which
 * the client tolerates by design (graceful degradation).
 *
 * Plain script (not node:test) because the updater schedules long-lived
 * timers; we exit explicitly after the assertions.
 *
 * Run: node test/client.stub.test.mjs  (or via node --test "test/*.test.mjs")
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

function makeReact() {
  return {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (init) => [typeof init === "function" ? init() : init, () => {}],
    useEffect: () => {},
  };
}

function makeCtx(counters) {
  const state = { preference: "light" };
  return {
    get: () => undefined,
    on: () => () => {},
    effect: (fn) => {
      const cleanup = fn();
      if (typeof cleanup === "function") cleanup();
      return () => {};
    },
    locale: {
      register: () => { counters.localeRegister++; },
      bind: () => (key) => `L:${key}`,
    },
    theme: {
      register: () => { counters.themeRegister++; return () => {}; },
      setTheme: () => {},
      getTheme: () => state,
    },
    slots: {
      inject: () => {},
      register: (_def, render) => render,
    },
  };
}

function runFactory({ store, fetchLog, counters = { themeRegister: 0, localeRegister: 0 } }) {
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  globalThis.localStorage = localStorage;
  globalThis.fetch = (url) => {
    fetchLog.push(String(url));
    if (String(url).includes("registry.npmjs.org")) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ version: "0.4.0" }), text: () => Promise.resolve("") });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}), text: () => Promise.resolve("") });
  };
  globalThis.window = { __ModuleLoader__: {} };
  let exportsOut = null;
  window.__ModuleLoader__.load = (opts) => {
    const returned = opts.factory((id) => {
      if (id === "react") return makeReact();
      throw new Error(`unexpected require: ${id}`);
    });
    exportsOut = returned;
  };
  // The file calls window.__ModuleLoader__.load(...) at the top level.
  (0, eval)(source);
  return { exportsOut, localStorage };
}

async function main() {
  // --- test 1: normal boot ---
  const store1 = new Map([["dsh.themeManager.update.pending", "0.3.0"]]); // already-current → cleared
  const fetchLog1 = [];
  const counters1 = { themeRegister: 0, localeRegister: 0 };
  const r1 = runFactory({ store: store1, fetchLog: fetchLog1, counters: counters1 });
  assert.equal(typeof r1.exportsOut.apply, "function");
  assert.deepEqual(r1.exportsOut.inject, ["slots", "locale", "theme"]);
  r1.exportsOut.apply(makeCtx(counters1)); // must not throw in a DOM-less env
  assert.equal(counters1.themeRegister, 51, "all 51 themes should still register");
  assert.ok(counters1.localeRegister >= 1, "dictionaries should register");
  assert.equal(r1.localStorage.getItem("dsh.themeManager.update.pending"), null, "pending equal to current should be cleared");
  // Wait past the 2s boot check timer, then the registry result must be cached.
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2200));
  assert.ok(fetchLog1.some((u) => u.includes("registry.npmjs.org/dsh-theme-manager/latest")), "registry check should run");
  const cached = JSON.parse(r1.localStorage.getItem("dsh.themeManager.update.lastCheck"));
  assert.equal(cached.version, "0.4.0");
  console.log("client stub: test 1 passed (boot + registry check + cache)");

  // --- test 2: stale pending version (update did not take effect) ---
  const store2 = new Map([["dsh.themeManager.update.pending", "2.0.0"]]); // newer than current → failed
  const fetchLog2 = [];
  const counters2 = { themeRegister: 0, localeRegister: 0 };
  const r2 = runFactory({ store: store2, fetchLog: fetchLog2, counters: counters2 });
  r2.exportsOut.apply(makeCtx(counters2));
  assert.equal(r2.localStorage.getItem("dsh.themeManager.update.pending"), "2.0.0", "pending newer than current must stay");
  console.log("client stub: test 2 passed (stale pending retained)");

  console.log("client stub: all tests passed");
  process.exit(0); // the 6h interval would otherwise keep the process alive
}

main().catch((err) => {
  console.error("client stub FAILED:", err);
  process.exit(1);
});
