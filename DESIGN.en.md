# dsh-theme-manager — Update Reminder Design

> Design decisions behind the v0.3.0 "update reminder" feature, matching the implementation.

## 1. Goals

- Users never have to check for updates manually: the plugin queries the npm registry on boot and every 6 hours.
- Updates are **guaranteed to succeed**: pinned exact-version install, visible progress, auto-restart, and a rollback path.
- Never intrusive: ignore a version → never reminded again; snooze → 24 h; no newer version → zero UI.
- Graceful degradation without the host half: reminders still work, one-click update does not.

## 2. Interaction flow

### 2.1 Discovering a new version (three-tier reminder)

1. **One-time toast** (bottom-right, auto-dismisses after 8 s, pauses on hover): "New version vX.Y.Z · View".
2. **Persistent pill** (bottom-right): stays until handled or ignored; the × acts as "remind me later (24 h)".
3. **Settings footer version row** (persistent entry point): current version / check / update / ignore / ignored-version management / failed-update warnings.

A toast for a given version fires only once (`toastSeen`); the pill reappears on each check unless ignored or inside the 24 h quiet period.

### 2.2 Update dialog (state machine)

```
notify ──(click Update)──▶ preflight ──▶ installing ──▶ done ──▶ restarting ──▶ (boot verification after restart)
                            │             │  ▲            │
                            └─ fallback   │  └─(failure)──┘
                            (link:/no host)▼    error ◀──┘
                            manual/guidance (retry / rollback / close)
```

- **notify**: version diff (old → new) + changelog (lazy-fetched from raw.githubusercontent) + major-version warning strip (when the major number changes) + ignore / later / update.
- **preflight**: validates host info (can auto-update? pending restart?). Only then POSTs.
- **installing**: the host streams NDJSON over a long POST — steps (install → verify) and the install log; progress is indeterminate with step checkmarks.
- **done**: shows the target version, offers "Restart now / Restart later"; manual steps when auto-restart is unavailable.
- **error**: error message + collapsible install log + retry / rollback (when an anchor exists) / close.
- **restarting**: after POSTing the restart route the page reconnects automatically.
- **Boot verification after restart**: localStorage `pending` marker vs the current `PLUGIN_VERSION`:
  - `pending ≤ current` → the update took effect (or was rolled back to/past it) → "Updated to vX.Y.Z" toast, clear the marker, prune ignored versions;
  - `pending > current` → it did not take effect → settings-page warning with retry / rollback.

### 2.3 Semantics

| Action | Behavior |
|---|---|
| Update | npm source → pin `dsh-theme-manager@<new version>`; GitHub source → the host resolves the latest main commit and installs `github:runcat-tommy/dsh-theme-manager#<sha>` |
| Ignore this version | recorded forever in `ignoredVersions[]`; entries ≤ the current version are pruned after a successful update / rollback |
| Remind me later | `dismissedUntil{version: ts}` = now + 24 h |
| Rollback | `previousSpec` is recorded before updating; rollback re-installs that spec (and clears the anchor) |

## 3. Host half (minimal)

Route prefix `/dsh-theme-manager/api/v1/` (mirrors dsh-market's `/dsh-market/api/v1/` pattern):

| Route | Method | Purpose |
|---|---|---|
| `/info` | GET | `{version, source(npm/github/link/unknown), sourceSpec, canAutoUpdate, allowRestart, pendingRestart, pendingTarget, boot}` |
| `/update` | POST | body `{version}`; the host rebuilds and validates the spec itself; streams NDJSON; writes state on success |
| `/rollback` | POST | re-installs `state.previousSpec`; streams NDJSON |
| `/restart` | POST | spawns a detached helper (waits for the port to free, then respawns identically); the process exits after responding |

**Security** (all patterns proven by dsh-market):

- State-changing routes accept only loopback peers (127.0.0.1 / ::1 / ::ffff:127.0.0.1) with Origin matching Host and no `forwarded` / `x-forwarded-for` / `x-real-ip` headers;
- Install specs are rebuilt and whitelisted host-side — only `dsh-theme-manager` itself can ever be installed (npm semver / github repo+sha / local path); the body `version` is only a target hint;
- Auto-restart is disabled when a supervisor is detected (systemd: INVOCATION_ID/JOURNAL_STREAM + ppid=1) or on Desktop hosts (`ctx.get("desktopProfiles")`);
- Everything is triggered by an explicit user click in the browser — nothing is silent.

**Process & state**:

- Profile dir: `DSH_HOME/profiles/<name>` (default `~/.dsh`; `--profile` wins, default `web`);
- CLI re-invocation: `node <process.argv[1]> plugin --profile <p> add <spec>` (same re-entry logic as dsh), cwd = profile dir;
- State file `profile/.dsh-theme-manager-state.json`: `{previousSpec, targetVersion, pendingRestart, installedAt}`;
- Restart helper `.dsh-theme-manager-restart.cjs` (CJS, Node builtins only): waits for the port to go quiet (≤ ~10 s) → respawns identically (Windows wraps in `powershell -WindowStyle Hidden` to avoid console windows) → logs to `dsh-theme-manager-restart.log`.

## 4. Client storage (localStorage)

| key | contents |
|---|---|
| `dsh.themeManager.update.ignored` | array of ignored exact versions |
| `dsh.themeManager.update.dismissed` | `{version: timestamp}` quiet periods |
| `dsh.themeManager.update.lastCheck` | `{at, version}` check cache (6 h reuse, offline-friendly) |
| `dsh.themeManager.update.pending` | target version awaiting boot verification |
| `dsh.themeManager.update.toastSeen` | `{version: true}` — one toast per version |

## 5. Degradation

- **Host routes missing** (old plugin / host load failure): `/info` fails → the Update button becomes a manual-install guidance dialog (shows `dsh plugin --profile web add dsh-theme-manager@<version>`); reminders keep working.
- **link:/file: installs**: `canAutoUpdate=false` → guidance to update the source directory.
- **Registry unreachable**: silent failure, keep the last check cache, retry next time; never interrupts the UI.
- **Restart disabled** (systemd / Desktop): install works, manual restart steps are shown.

## 6. Tests

- `test/host.test.mjs`: route registration, `/info` payload, 403 for non-loopback / mismatched Origin, 400 for invalid versions (never spawns), 400 for rollback without state, 403 for disabled restart, 405 method checks.
- `test/client.stub.test.mjs`: apply() must not throw in a DOM-less env, all 40 themes still register, boot verification (pending=current → cleared + toast; pending>current → kept + warning), registry check + lastCheck cache write.
