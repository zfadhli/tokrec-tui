# tokrec-tui

## What This Is
A Bun + TypeScript CLI for monitoring and recording multiple TikTok livestreams simultaneously, with a live TUI showing color-coded status and keyboard controls.

## Requirements
- Monitor multiple TikTok users' livestreams concurrently
- Record streams via FFmpeg when live
- Provide real-time TUI with status updates
- Keyboard controls for stop/restart/add users at runtime
- Config-driven via `tokrec.json`

## Constraints
- Bun >= 1.2 required
- FFmpeg must be on $PATH at runtime
- Uses `@zfadhli/tokrec` for stream detection and recording
- Uses `@opentui/core` for native TUI rendering

## Success Metrics
| Metric | Target |
|--------|--------|
| Concurrent streams | 10+ users |
| TUI responsiveness | <100ms update latency |
| Recording reliability | 99% uptime during live streams |
