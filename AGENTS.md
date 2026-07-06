# tokrec-tui

## Project Overview

Bun + TypeScript CLI for monitoring and recording multiple TikTok livestreams simultaneously. Uses [@zfadhli/tokrec](https://github.com/zfadhli/tokrec) (TypeScript library) for stream detection, recording, and conversion via FFmpeg. The CLI provides a live TUI with color-coded status and keyboard controls via [@opentui/core](https://github.com/anomalyco/opentui).

## Architecture

```
src/
  index.ts      – Entry point, SIGINT/SIGTERM wiring
  cli.ts        – TUI: OpenTUI renderer, Box/Text components, keyInput handler
  manager.ts    – Thin wrapper around tokrec's createRecorder() per user
  config.ts     – Loads/saves tokrec.json, validates, merges with defaults
  types.ts      – AppStatus type alias (from tokrec's RecorderState + "error")
  utils.ts      – sleep() helper
bin/
  tokrec-tui    – Shebang wrapper: #!/usr/bin/env bun → imports dist/index.mjs
```

**Key dependencies**:
- `@zfadhli/tokrec` — handles TikTok scraping, polling, FFmpeg spawning, and stream conversion. Our code creates one `RecorderController` per user via `createRecorder()`.
- `@opentui/core` — native Zig TUI renderer with Box/Text/Input components, keyInput events, and flexbox layout.

**Config**: JSON file (`tokrec.json`) in the working directory. Fields: `outputDir`, `interval`, `users[]`, `cookiesPath`, `duration`.

## Setup Commands

- Install dependencies: `bun install`
- Link CLI globally: `bun run link`
- Dev mode: `bun run dev`

## Development Workflow

- Run locally: `bun src/index.ts` (requires `tokrec.json` in cwd)
- TypeScript check: `bun build --no-bundle src/index.ts`
- Lint: `bun run lint`
- Format: `bun run format`
- No test suite (yet)
- Bun >= 1.2 required; FFmpeg must be on $PATH at runtime

## Code Style

- Strict TypeScript, no `any` (except OpenTUI VNode→Renderable casts)
- Bun-native APIs preferred
- `import type` for type-only imports
- `ponytail:` comments mark deliberate simplifications (search for them)
- ESM-only (`"type": "module"`)
- Biome for lint/format (strict recommended, 2-space indent, 100 line width)

### OpenTUI Patterns

- `Text()`, `Box()`, `Input()` return VNodes (proxies) — defer work until mounted
- After `renderer.root.add(vnode)`, extract actual renderables via `getChildren()`
- Dynamic updates must use actual renderables: `renderable.content = ...`, `renderable.fg = ...`
- `vnode.on("event", handler)` works for VNodes (pending calls ARE replayed for event listeners)
- `renderable.on("event", handler)` works on actual renderables (preferred for reliability)
- `renderer.destroy()` handles all terminal cleanup
- `queueMicrotask(() => input.focus())` to delay focus and prevent keystroke bleed

## Build and Deployment

- `bun run build` — tsdown builds `dist/index.mjs`, makes `bin/tokrec-tui` executable
- `bun run link` — builds + `bun link` (registers globally)
- `bun link tokrec-tui` — from another project, links this as a dependency
- No CI/CD pipeline configured

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `q` | Quit (graceful shutdown) |
| `Ctrl+C` | Same as `q` |
| `s` | Stop mode — select a user to stop |
| `r` | Restart mode — select a user to restart |
| `n` | New download — add a new user at runtime |

## Git Hooks

Lefthook runs `biome check --write` on pre-commit. Run `bun run lint` before committing.
