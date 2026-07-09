# Handoff

## Goal

Redesign tokrec-tui TUI from single-panel list to dashboard layout with sidebar, detail pane, log pane, and JSONC config support.

## Session Info

- **Branch:** `main`
- **Project:** tokrec-tui (v0.6.0)
- **Saved:** 2026-07-07

## Changes

Working tree clean. No uncommitted changes.

## Commits This Session

```
91d5bd1 Release v0.6.0 (#8)
85f8817 release: v0.6.0
f84779d fix: simplify selected user styling in sidebar
77128e0 fix: save config to loaded file instead of hardcoded tokrec.json
606cea3 fix: arrow key navigation, selected color, and filename logging
aff414b feat: redesign TUI as dashboard with sidebar, detail pane, and log
```

## Files Touched

| File | Status | Done | Left |
|------|--------|------|------|
| `src/cli.ts` | modified | Dashboard layout, sidebar navigation, detail pane, log pane, overlays, keyboard shortcuts, filename logging | None |
| `src/manager.ts` | modified | Progress tracking (download:progress, recording:start/end), filename generation, getProgress() getter | None |
| `src/config.ts` | modified | tiny-jsonc integration, module-scope configPath for correct save path | None |
| `package.json` | modified | tokrec-tui v0.6.0, tiny-jsonc dependency | None |
| `CHANGELOG.md` | modified | v0.6.0 section with Added/Changed/Fixed | None |

## Key Decisions

- **Dashboard layout over single-panel**: Multi-panel (header, sidebar, detail, log) provides better information density and navigation for monitoring multiple users.
- **Manual arrow key handling over Select component**: OpenTUI's `Select` only supports global selected/non-selected styles, no per-item colors. Manual handling gives full control.
- **Filename generated at recording:start**: tokrec emits `file: ""` at start — generate filename using tokrec's format (`user=YYYYMMDD_HH-MM-SS.ts`) instead.
- **Module-scope configPath**: Track loaded config path at module scope so saveConfig() defaults to the correct file without changing callers.
- **No JSONC comment preservation**: JSON.stringify drops comments — acceptable for ~10 line config files.

## Dead Ends

- **Styled text for arrow color**: OpenTUI's `t` template returns StyledText objects that stringify to `[object Object]` when interpolated into strings. Reverted to plain text `>>`.
- **Per-item styling in Select**: OpenTUI Select component only supports two styles (selected/not selected), not per-user colors.
- **Real-time file/size/speed during recording**: tokrec's `download:progress` only fires after each FFmpeg segment completes, not during. For live streams, segments can last minutes/hours.

## Blockers

None.

## Next Steps

- [ ] Test full workflow with real TikTok cookies
- [ ] Consider adding pause/resume per-user
- [ ] Consider multi-select in stop/restart modes
- [ ] Consider scrollable sidebar for many users

## Suggested Skills

- deepwork: For complex multi-phase features (e.g., adding pause/resume, multi-select)
- ponytail: For simplification audits of the TUI code
