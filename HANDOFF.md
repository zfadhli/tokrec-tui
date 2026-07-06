# Handoff

## Goal

Rebuild and maintain tokrec-tui — a Bun/TypeScript CLI for monitoring and recording TikTok livestreams via tokrec + OpenTUI.

## Session Info

- **Branch:** `main`
- **Project:** tokrec-tui (v0.4.0)
- **Saved:** 2025-07-06 14:00

## Changes

Working tree clean. No uncommitted changes.

## Commits This Session

```
1607a6e release: v0.4.0 (#6)
bf86832 fix status update: correct container index after banner addition
08ea9c0 show version in TUI banner
f00799f add banner to TUI
11add85 rename config from ttlive.json to tokrec.json, add .jsonc support
55a2c36 update status colors: recording=cyan, polling=white
519c832 update README.md for tokrec-tui
5127033 update AGENTS.md for tokrec-tui
bfae2b6 rename binary to tokrec-tui
3be36b0 rename package to tokrec-tui
```

## Files Touched

| File | Status | Done | Left |
|------|--------|------|------|
| `src/cli.ts` | modified | TUI: banner, version, stop/restart/new modes, OpenTUI, status colors | None |
| `src/config.ts` | modified | Rename to tokrec.json + .jsonc support, saveConfig() | None |
| `src/manager.ts` | modified | Thin tokrec wrapper, restartUser() | None |
| `src/types.ts` | modified | AppStatus = RecorderState \| "error" | None |
| `src/utils.ts` | modified | sleep() helper only | None |
| `src/terminal.ts` | deleted | Replaced by OpenTUI in cli.ts | None |
| `bin/tokrec-tui` | new | Shebang wrapper for bundled dist/index.mjs | None |
| `biome.json` | new | Lint/format config (strict, 2-space indent) | None |
| `lefthook.yml` | new | Pre-commit hook with biome check | None |
| `tsdown.config.ts` | new | Build config (ESM, deps.neverBundle) | None |
| `CHANGELOG.md` | new | Keep a Changelog format, v0.1.0-v0.4.0 | None |
| `AGENTS.md` | updated | Project overview, architecture, keyboard shortcuts | None |
| `README.md` | updated | Full docs with badges, install, usage, config | None |
| `package.json` | updated | v0.4.0, tokrec-tui, deps, scripts | None |

## Key Decisions

- **OpenTUI over raw ANSI**: User explicitly requested despite weight concerns. VNode pattern requires extracting actual renderables for dynamic updates.
- **tsdown build**: User requested despite private CLI nature. Externalizes native deps (@opentui/core, @zfadhli/tokrec).
- **tokrec.json + .jsonc**: Rename from ttlive.json to match package name. Added JSONC support for comments.
- **InStopMode guard**: Prevents re-entry and blocks global keypress during stop/restart/new modes.
- **queueMicrotask for focus**: Delays Input focus by one tick to prevent triggering keystroke from bleeding into the field.

## Dead Ends

- **inputVNode.on("enter", ...)**: Never fires after VNode is mounted — pending calls only replay during mounting, not after.
- **onSubmit on Input**: InputRenderable.submit() doesn't call onSubmit — it only emits "enter" event. Must use renderable.on("enter", ...) on actual instance.
- **tsdown --compile**: Fails because wreq-js native bindings can't be bundled. Used --target bun instead with external deps.

## Blockers

None.

## Next Steps

- [ ] Test full workflow with real TikTok cookies
- [ ] Consider adding pause/resume per-user
- [ ] Consider multi-select in stop/restart modes (ponytail comment exists)
- [ ] Add error recovery for network failures

## Suggested Skills

- deepwork: For complex multi-phase features (e.g., adding pause/resume, multi-select)
- ponytail: For simplification audits of the TUI code
