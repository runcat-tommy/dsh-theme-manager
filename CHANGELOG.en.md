# Changelog

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
