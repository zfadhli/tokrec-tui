# AGENTS.md

## Project Overview

Bun + TypeScript CLI for monitoring and recording multiple TikTok livestreams simultaneously. Uses [@zfadhli/tokrec](https://github.com/zfadhli/tokrec) (TypeScript library) for stream detection, recording, and conversion via FFmpeg. The CLI provides a live TUI with color-coded status and keyboard controls.

## Architecture

```
src/
  index.ts      – Entry point, SIGINT/SIGTERM wiring
  cli.ts        – TUI: raw stdin keyboard handling, status refresh loop, stop mode
  manager.ts    – Thin wrapper around tokrec's createRecorder() per user
  terminal.ts   – ANSI-colored status box renderer (pure function, no deps)
  config.ts     – Loads ttlive.json, validates, merges with defaults
  types.ts      – AppStatus type alias (from tokrec's RecorderState)
  utils.ts      – sleep()
bin/
  ttlive        – Shebang wrapper: #!/usr/bin/env bun → imports src/index.ts
```

**Key dependency**: `@zfadhli/tokrec` — handles TikTok scraping, polling, FFmpeg spawning, and stream conversion. Our code creates one `RecorderController` per user via `createRecorder()`.

**Config**: JSON file (`ttlive.json`) in the working directory. Fields: `outputDir`, `interval`, `users[]`, `cookiesPath`, `duration`.

## Setup Commands

- Install dependencies: `bun install`
- Link CLI globally: `bun run link`
- Dev mode: `bun run dev`

## Development Workflow

- Run locally: `bun src/index.ts` (requires `ttlive.json` in cwd)
- TypeScript: `bun build --no-bundle src/index.ts` (quick type-check via transpile)
- No test suite (yet)
- Bun >= 1.2 required; FFmpeg must be on $PATH at runtime

## Code Style

- Strict TypeScript, no `any`
- Bun-native APIs preferred (`bun build`, `Bun.file`, `spawn`)
- `import type` for type-only imports
- `ponytail:` comments mark deliberate simplifications (search for them)
- No external runtime deps beyond `@zfadhli/tokrec`
- ESM-only (`"type": "module"`)

## Build and Deployment

- `bun run build` — makes `bin/ttlive` executable
- `bun run link` — builds + `bun link` (registers globally)
- `bun link ttlive-manager` — from another project, links this as a dependency
- No CI/CD pipeline configured
