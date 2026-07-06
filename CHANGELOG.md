# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
