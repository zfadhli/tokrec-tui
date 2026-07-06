# AGENTS.md

## Project Overview

Bun + TypeScript CLI for monitoring and recording multiple TikTok livestreams simultaneously. Uses [@zfadhli/tokrec](https://github.com/zfadhli/tokrec) (TypeScript library) for stream detection, recording, and conversion via FFmpeg. The CLI provides a live TUI with color-coded status and keyboard controls via [@opentui/core](https://github.com/anomalyco/opentui).

## Architecture

```
src/
  index.ts      – Entry point, SIGINT/SIGTERM wiring
  cli.ts        – TUI: OpenTUI renderer, Box/Text components, keyInput handler, Input for stop mode
  manager.ts    – Thin wrapper around tokrec's createRecorder() per user
  config.ts     – Loads ttlive.json, validates, merges with defaults
  types.ts      – AppStatus type alias (from tokrec's RecorderState + "error")
  utils.ts      – (empty, kept for future shared helpers)
bin/
  ttlive        – Shebang wrapper: #!/usr/bin/env bun → imports src/index.ts
```

**Key dependencies**:
- `@zfadhli/tokrec` — handles TikTok scraping, polling, FFmpeg spawning, and stream conversion. Our code creates one `RecorderController` per user via `createRecorder()`.
- `@opentui/core` — native Zig TUI renderer with Box/Text/Input components, keyInput events, and flexbox layout.

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

- Strict TypeScript, no `any` (except OpenTUI VNode→Renderable casts)
- Bun-native APIs preferred (`bun build`, `Bun.file`, `spawn`)
- `import type` for type-only imports
- `ponytail:` comments mark deliberate simplifications (search for them)
- ESM-only (`"type": "module"`)

### OpenTUI Patterns

- `Text()`, `Box()`, `Input()` return VNodes (proxies) — defer work until mounted
- After `renderer.root.add(vnode)`, extract actual renderables via `getChildren()`
- Dynamic updates must use actual renderables: `renderable.content = ...`, `renderable.fg = ...`
- `vnode.on("event", handler)` works (pending calls ARE replayed for event listeners)
- `renderer.destroy()` handles all terminal cleanup

## Build and Deployment

- `bun run build` — makes `bin/ttlive` executable
- `bun run link` — builds + `bun link` (registers globally)
- `bun link ttlive-manager` — from another project, links this as a dependency
- No CI/CD pipeline configured
