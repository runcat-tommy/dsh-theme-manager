# Changelog

## 0.3.0 (2026-09-01)

### Added

- **Update reminders**: checks npm for a newer version on boot and every 6 hours; a one-time toast and a persistent pill appear bottom-right
- **One-click update**: the dialog shows the version diff and changelog; npm installs pin `dsh-theme-manager@<version>`, GitHub installs resolve the latest commit and pin its SHA; progress and the install log stream live
- **Ignore / remind later**: ignore this version (no more reminders, restorable from settings) or snooze for 24 hours
- **Restart & verification**: one-click restart where auto-restart is allowed (port-ready helper + detached relaunch); on boot the pending target version is verified — success is announced, failure surfaces retry / rollback
- **Rollback**: the previous install source is recorded automatically; go back to the previous version in one click
- **Host half** (`lib/index.js`): updater routes `info / update / rollback / restart` (loopback + Origin checked; spec whitelist allows only dsh-theme-manager itself)
- Settings page footer: plugin version row with check / update / ignore / ignored-version management / failed-update warnings

### Changed

- Version 0.2.0 → 0.3.0 (feature, minor)
- Added `test/` (host route-guard tests + client smoke test)

## 0.2.0 (2026-08-28)

### Added

- **Flag series: 20 national flags** — new layer-1 category "Flags" covering USA, China, Germany, Japan, India, UK, France, Italy, Canada, Brazil, Russia, South Korea, Mexico, Australia, Spain, Indonesia, Turkey, Netherlands, Saudi Arabia and Switzerland
- Two-color flags (Japan, Indonesia, Saudi Arabia, Switzerland, …) are handled by the `flagSpec()` generator: every surface layer / label / border / state color is derived from the flag's signature colors by tinting and shading
- Bilingual copy and both README style tables updated

### Changed

- Built-in styles: 20 → 40 (20 culture / scene + 20 flags)

## 0.1.0 (2026-08-28)

### Added

- Two-level theme manager: pick a culture / scene first, then a concrete style
- Initial 20 culture / scene styles (China 5 · Japan 5 · Festivals 3 · General 7, incl. 7 dark-base)
- Real themes registered through the `theme` service (`--dsw-alias-*` tokens); live switching, localStorage persistence, zh / en locale
- `palette()` compact-spec builder: ~30 core colors expand into the full token map

### Release

- Source: https://github.com/runcat-tommy/dsh-theme-manager
- npm: https://www.npmjs.com/package/dsh-theme-manager
