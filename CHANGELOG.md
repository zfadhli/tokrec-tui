# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-07-07

### Added
- Dashboard TUI layout: header bar with status summary, sidebar with user list, detail pane, scrollable log pane
- Keyboard shortcuts guide displayed below header
- Arrow/j/k navigation in sidebar with `>>` indicator
- Live filename display in detail pane (generated at recording start)
- Filename logged when recording ends or is stopped
- Download progress tracking in Manager (speed, bytes, file, size)
- JSONC config support via `tiny-jsonc`

### Changed
- Selected user indicator: `>>` in cyan, no bold/yellow highlight
- Config save: writes to loaded file (`tokrec.jsonc` or `tokrec.json`) instead of hardcoded `tokrec.json`
- Mode overlays: transparent background with black dialog box

### Fixed
- Arrow key navigation: use OpenTUI key names (`up`/`down` not `arrowup`/`arrowdown`)
- Config save path: now updates the correct config file when adding users

## [0.5.0] - 2025-07-06

### Added
- Elapsed recording timer in TUI (shows `recording  02:34` during active recording)
- Error messages surfaced in TUI status when network failures occur

### Changed
- Dead controllers cleaned up automatically on `start()` failure
- Upgraded `@zfadhli/tokrec` from 0.12.2 to 0.13.0

## [0.4.0] - 2025-07-06

### Added
- TUI banner with version display
- JSONC config support (`tokrec.jsonc`)

### Changed
- Renamed package from `ttlive-manager` to `tokrec-tui`
- Renamed binary from `ttlive` to `tokrec-tui`
- Renamed config file from `ttlive.json` to `tokrec.json`
- Updated status colors: recording=cyan, polling=white
- Updated README.md and AGENTS.md for new naming

### Fixed
- Status display not updating after banner was added

## [0.3.1] - 2025-07-06

### Changed
- Migrated build from `bun build` to `tsdown`
- CLI now runs from bundled `dist/index.mjs` instead of source

## [0.3.0] - 2025-07-06

### Added
- Restart function: press `r` to restart a user's recorder
- New download function: press `n` to add a new user at runtime
- Sequential startup with 5s delay between users
- TUI appears immediately, downloads start in background

### Changed
- Migrated TUI from raw ANSI to OpenTUI (`@opentui/core`)
- Added biome for lint/format, lefthook for git hooks, tsdown for builds
- Updated AGENTS.md for new architecture

### Fixed
- Stop mode: Enter key now works (use `renderable.on()` instead of VNode proxy)
- Stop mode: guard against re-entry, prevent global keypress during stop
- Stop mode: clear input value to prevent keystroke bleed
- Stop mode: delay focus by one tick to prevent "s" keystroke bleed
- New user: insert before footer instead of after

## [0.2.0] - 2025-07-06

### Added
- Initial OpenTUI rebuild
- JSON config file (`ttlive.json`)
- Global CLI via `bun link`

## [0.1.0] - 2025-07-06

### Added
- Initial release with raw ANSI TUI
