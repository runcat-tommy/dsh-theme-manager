/**
 * dsh-theme-manager host half: a minimal updater service.
 *
 * Mounts a few HTTP routes on the profile's webServer so the browser half
 * can (a) learn how this plugin is installed, (b) run an exact-version
 * install through the dsh CLI, (c) roll back to the previous source, and
 * (d) relaunch the dsh web process once an update needs a restart.
 *
 * Security posture (mirrors dsh-market's proven pattern):
 *  - every state-changing route only accepts loopback peers whose Origin
 *    matches the Host header, with no proxy-forwarding headers present;
 *  - install specs are rebuilt host-side and validated so only
 *    `dsh-theme-manager` itself can ever be installed via these routes;
 *  - self-restart is disabled by default under a detected supervisor
 *    (systemd), and always disabled on Desktop hosts (the shell owns the
 *    process lifecycle there);
 *  - nothing runs without an explicit user click in the browser UI.
 */
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

export const name = "dsh-theme-manager";

const PACKAGE = "dsh-theme-manager";
const PREFIX = "/dsh-theme-manager/api/v1";
const STATE_FILE = ".dsh-theme-manager-state.json";
const RESTART_HELPER = ".dsh-theme-manager-restart.cjs";
const RESTART_LOG = "dsh-theme-manager-restart.log";

/* ------------------------------ helpers ------------------------------ */

/** The profile this host process actually booted with (`--profile <name>`). */
function argvProfile() {
  const argv = process.argv;
  const flag = argv.indexOf("--profile");
  if (flag !== -1 && flag + 1 < argv.length && !argv[flag + 1].startsWith("-")) return argv[flag + 1];
  return undefined;
}

/** DSH_HOME (blank = unset) or the default ~/.dsh. */
function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME;
  const selected = fromEnv !== undefined && fromEnv.trim().length > 0 ? fromEnv : join(homedir(), ".dsh");
  return resolve(selected);
}

function profileDirOf(profile) {
  if (
    profile === "" || profile === "." || profile === ".." || profile === "node_modules"
    || profile.includes("/") || profile.includes("\\") || profile.includes("\0")
  ) {
    throw new Error(`dsh-theme-manager: invalid profile name ${JSON.stringify(profile)}`);
  }
  return join(resolveDshHome(), "profiles", profile);
}

function readJson(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return undefined; }
}

function readProfileManifest(profileDir) {
  return readJson(join(profileDir, "package.json"));
}

function readState(profileDir) {
  return readJson(join(profileDir, STATE_FILE)) ?? {};
}

function writeState(profileDir, state) {
  try { writeFileSync(join(profileDir, STATE_FILE), JSON.stringify(state, null, 2), "utf8"); } catch { /* best effort */ }
}

/** Version of the plugin actually installed in the profile, or null. */
function installedVersionOf(profileDir) {
  try {
    const pkg = readJson(join(profileDir, "node_modules", PACKAGE, "package.json"));
    return pkg && typeof pkg.version === "string" ? pkg.version : null;
  } catch { return null; }
}

/** Classify how this plugin is installed (npm / github / link / unknown). */
function sourceOf(profileDir) {
  const manifest = readProfileManifest(profileDir);
  const spec = manifest?.dependencies?.[PACKAGE];
  if (typeof spec !== "string" || spec === "") return { sourceType: "unknown", spec: null };
  if (/^(?:link|file):/u.test(spec) || /^(?:\.\.?[/\\]|[/\\]|[A-Za-z]:[/\\])/u.test(spec)) return { sourceType: "link", spec };
  if (/^(?:github:|git\+)/u.test(spec) || /github\.com/u.test(spec)) return { sourceType: "github", spec };
  return { sourceType: "npm", spec };
}

/** The dsh CLI that launched this host — re-invoked for plugin operations. */
function dshArgv() {
  const entry = process.argv[1];
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/u.test(entry)) {
    return { file: process.execPath, args: [...process.execArgv, entry], cwd: dirname(entry) };
  }
  return { file: "dsh", args: [], cwd: undefined };
}

/** Run `dsh plugin --profile <profile> add <spec>` in the profile directory. */
function runPlugin(profile, profileDir, spec, onOutput) {
  const launch = dshArgv();
  const args = [...launch.args, "plugin", "--profile", profile, "add", spec];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(launch.file, args, { cwd: profileDir, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    child.stdout.on("data", (chunk) => { try { onOutput(chunk.toString()); } catch { /* ignore */ } });
    child.stderr.on("data", (chunk) => { try { onOutput(chunk.toString()); } catch { /* ignore */ } });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`dsh plugin exited with code ${code}`));
    });
  });
}

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const GITHUB_SPEC_RE = /^github:runcat-tommy\/dsh-theme-manager(?:#[0-9a-f]{40})?$/u;

/** Rebuild + validate the exact spec to install: never anything but this plugin. */
function buildSpec(sourceType, version) {
  if (sourceType === "npm") {
    if (!SEMVER_RE.test(String(version ?? ""))) throw new Error("missing valid target version");
    return `${PACKAGE}@${version}`;
  }
  if (sourceType === "github") {
    return `github:runcat-tommy/dsh-theme-manager`; // branch ref; host resolves+appends SHA below
  }
  throw new Error(`install source '${sourceType}' does not support one-click update`);
}

function validateSpec(spec, sourceType) {
  if (sourceType === "npm" && spec.startsWith(`${PACKAGE}@`) && SEMVER_RE.test(spec.slice(PACKAGE.length + 1))) return spec;
  if (sourceType === "github" && GITHUB_SPEC_RE.test(spec)) return spec;
  throw new Error("refusing to install anything but dsh-theme-manager");
}

/** Resolve the default branch's head SHA so github installs stay pinned. */
async function resolveGithubSha() {
  const res = await fetch("https://api.github.com/repos/runcat-tommy/dsh-theme-manager/commits/main", {
    headers: { "User-Agent": "dsh-theme-manager-updater", Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`cannot resolve github head: HTTP ${res.status}`);
  const data = await res.json();
  if (typeof data.sha !== "string" || !/^[0-9a-f]{40}$/u.test(data.sha)) throw new Error("unexpected github response");
  return data.sha;
}

/** Rollback target from the recorded previous spec (may be a range, path, or github ref). */
function rollbackSpec(previousSpec) {
  if (previousSpec == null) throw new Error("no previous version recorded");
  const s = String(previousSpec);
  if (/^(?:link|file):/u.test(s) || /^(?:\.\.?[/\\]|[/\\]|[A-Za-z]:[/\\])/u.test(s)) return s;
  if (/^github:/u.test(s)) return s;
  if (/^[\^~<>= ]*\d+\.\d+\.\d+/u.test(s)) return `${PACKAGE}@${s}`;
  throw new Error("cannot restore the previous install source");
}

/* --------------------------- request helpers --------------------------- */

/** Loopback peer + matching Origin/Host + no proxy forwarding headers. */
function trustedRequest(request) {
  const address = request.socket.remoteAddress;
  if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
  if (request.headers.forwarded !== undefined || request.headers["x-forwarded-for"] !== undefined || request.headers["x-real-ip"] !== undefined) return false;
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (origin === undefined || host === undefined) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host === host;
  } catch { return false; }
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function readJsonBody(request, limit = 64 * 1024) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error("request body too large")); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try { resolvePromise(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch { resolvePromise({}); }
    });
    request.on("error", reject);
  });
}

/* ------------------------------ restart ------------------------------ */

/** A process supervisor owning this host (currently systemd only). */
function detectedSupervisor() {
  const set = (name) => (process.env[name] ?? "") !== "";
  if ((set("INVOCATION_ID") || set("JOURNAL_STREAM")) && process.ppid === 1) return "systemd";
  return null;
}

function restartAllowed(config, desktop) {
  if (desktop) return false;
  if (config?.allowRestart !== undefined) return config.allowRestart;
  return detectedSupervisor() === null;
}

function servingPort(request) {
  const host = request.headers.host;
  if (host === undefined) return null;
  const match = /:(\d{1,5})$/u.exec(host);
  if (match === null) return null;
  const port = Number(match[1]);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

/**
 * Detached helper that survives this process: waits for the serving port to
 * go quiet (so the replacement does not die with EADDRINUSE), then respawns
 * the exact boot invocation. Logs failures to the profile dir for diagnosis.
 */
function restartHelperSource(file, args, cwd, port, logFile) {
  return [
    "const { spawn } = require('node:child_process');",
    "const fs = require('node:fs');",
    "const net = require('node:net');",
    `const file = ${JSON.stringify(file)};`,
    `const args = ${JSON.stringify(args)};`,
    `const cwd = ${JSON.stringify(cwd)};`,
    `const port = ${JSON.stringify(port)};`,
    `const log = ${JSON.stringify(logFile)};`,
    "const note = (m) => { try { fs.appendFileSync(log, '[dsh-theme-manager] ' + m + '\\n'); } catch {} };",
    "const sleep = (ms) => new Promise((r) => setTimeout(r, ms));",
    "const free = () => new Promise((resolve) => { if (port == null) { resolve(true); return; }",
    "  const p = net.connect({ host: '127.0.0.1', port }); const done = (v) => { p.destroy(); resolve(v); };",
    "  p.on('connect', () => done(false)); p.on('error', () => done(true)); setTimeout(() => done(true), 400); });",
    "(async () => {",
    "  for (let i = 0; i < 40; i++) { if (await free()) break; await sleep(250); }",
    "  try {",
    "    const win = process.platform === 'win32';",
    "    const q = (s) => \"'\" + String(s).replace(/'/g, \"''\") + \"'\";",
    "    const exe = win && file === 'dsh' ? 'dsh.cmd' : file;",
    "    const child = win",
    "      ? spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', '& ' + q(exe) + ' ' + args.map(q).join(' ')], { cwd, stdio: 'ignore' })",
    "      : spawn(exe, args, { cwd, stdio: 'ignore', detached: true });",
    "    child.on('error', (e) => note('spawn error: ' + e.message));",
    "  } catch (e) { note('spawn threw: ' + (e && e.message)); }",
    "})();",
  ].join("\n");
}

function scheduleRestart(profileDir, port) {
  const launch = dshArgv();
  const args = [...launch.args, ...process.argv.slice(2)];
  const helperPath = join(profileDir, RESTART_HELPER);
  writeFileSync(helperPath, restartHelperSource(launch.file, args, launch.cwd ?? process.cwd(), port, join(profileDir, RESTART_LOG)), "utf8");
  const child = spawn(process.execPath, [helperPath], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

/* ------------------------------- apply ------------------------------- */

export function apply(ctx, config) {
  const desktop = ctx.get("desktopProfiles") !== undefined;
  let profile;
  let profileDir;
  try {
    profile = config?.profile ?? argvProfile() ?? "web";
    profileDir = profileDirOf(profile);
  } catch (err) {
    return; // invalid profile: no host behavior
  }
  const bootId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  ctx.inject(["webServer"], (host) => {
    host.effect(() => {
      const disposers = [
        host.webServer.register({
          kind: "exact",
          path: `${PREFIX}/info`,
          handler: async (request, response) => {
            if (request.method !== "GET") { response.writeHead(405, { allow: "GET" }); response.end(); return; }
            const source = sourceOf(profileDir);
            const state = readState(profileDir);
            sendJson(response, 200, {
              ok: true,
              apiVersion: 1,
              boot: bootId,
              profile,
              version: installedVersionOf(profileDir),
              source: source.sourceType,
              sourceSpec: source.spec,
              canAutoUpdate: source.sourceType === "npm" || source.sourceType === "github",
              allowRestart: restartAllowed(config, desktop),
              pendingRestart: state.pendingRestart === true,
              pendingTarget: state.targetVersion ?? null,
            });
          },
        }),
        host.webServer.register({
          kind: "exact",
          path: `${PREFIX}/update`,
          handler: async (request, response) => {
            if (request.method !== "POST") { response.writeHead(405, { allow: "POST" }); response.end(); return; }
            if (!trustedRequest(request)) { sendJson(response, 403, { error: "untrusted origin" }); return; }
            const body = await readJsonBody(request);
            const source = sourceOf(profileDir);
            let spec;
            try {
              spec = buildSpec(source.sourceType, body?.version);
              if (source.sourceType === "github") spec = `${spec}#${await resolveGithubSha()}`;
              validateSpec(spec, source.sourceType);
            } catch (err) { sendJson(response, 400, { error: err instanceof Error ? err.message : String(err) }); return; }

            const state = readState(profileDir);
            if (state.previousSpec === undefined) state.previousSpec = source.spec ?? installedVersionOf(profileDir);
            state.targetVersion = source.sourceType === "npm" ? String(body?.version ?? "") : "github";
            writeState(profileDir, state);

            response.setTimeout(0);
            response.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" });
            const send = (obj) => { try { response.write(`${JSON.stringify(obj)}\n`); } catch { /* client gone */ } };
            send({ type: "step", text: "install" });
            try {
              await runPlugin(profile, profileDir, spec, (chunk) => {
                for (const line of chunk.split(/\r?\n/u)) {
                  const trimmed = line.trim();
                  if (trimmed !== "") send({ type: "log", line: trimmed.slice(0, 500) });
                }
              });
              const installed = installedVersionOf(profileDir);
              state.pendingRestart = true;
              state.installedAt = new Date().toISOString();
              writeState(profileDir, state);
              send({ type: "step", text: "verify" });
              send({ type: "done", ok: true, version: installed });
            } catch (err) {
              send({ type: "error", message: err instanceof Error ? err.message : String(err) });
            }
            response.end();
          },
        }),
        host.webServer.register({
          kind: "exact",
          path: `${PREFIX}/rollback`,
          handler: async (request, response) => {
            if (request.method !== "POST") { response.writeHead(405, { allow: "POST" }); response.end(); return; }
            if (!trustedRequest(request)) { sendJson(response, 403, { error: "untrusted origin" }); return; }
            const state = readState(profileDir);
            let spec;
            try { spec = rollbackSpec(state.previousSpec); }
            catch (err) { sendJson(response, 400, { error: err instanceof Error ? err.message : String(err) }); return; }

            response.setTimeout(0);
            response.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" });
            const send = (obj) => { try { response.write(`${JSON.stringify(obj)}\n`); } catch { /* client gone */ } };
            send({ type: "step", text: "install" });
            try {
              await runPlugin(profile, profileDir, spec, (chunk) => {
                for (const line of chunk.split(/\r?\n/u)) {
                  const trimmed = line.trim();
                  if (trimmed !== "") send({ type: "log", line: trimmed.slice(0, 500) });
                }
              });
              const installed = installedVersionOf(profileDir);
              state.previousSpec = undefined; // rollback consumed the anchor
              state.pendingRestart = true;
              state.installedAt = new Date().toISOString();
              writeState(profileDir, state);
              send({ type: "done", ok: true, version: installed });
            } catch (err) {
              send({ type: "error", message: err instanceof Error ? err.message : String(err) });
            }
            response.end();
          },
        }),
        host.webServer.register({
          kind: "exact",
          path: `${PREFIX}/restart`,
          handler: (request, response) => {
            if (request.method !== "POST") { response.writeHead(405, { allow: "POST" }); response.end(); return; }
            if (!trustedRequest(request)) { sendJson(response, 403, { error: "untrusted origin" }); return; }
            if (!restartAllowed(config, desktop)) { sendJson(response, 403, { error: "restart not allowed" }); return; }
            const port = servingPort(request);
            try {
              scheduleRestart(profileDir, port);
              sendJson(response, 202, { ok: true, boot: bootId });
              setTimeout(() => { try { process.exit(0); } catch { /* ignore */ } }, 400);
            } catch (err) {
              sendJson(response, 500, { error: err instanceof Error ? err.message : String(err) });
            }
          },
        }),
      ];
      return () => { for (const dispose of disposers) { try { dispose(); } catch { /* ignore */ } } };
    }, "dsh-theme-manager: updater routes");
  });
}
