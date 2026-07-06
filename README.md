<!-- prettier-ignore -->
<div align="center">

# tokrec-tui

A terminal UI for monitoring and recording multiple TikTok livestreams simultaneously.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun->=1.2-fbf0df?style=flat-square&logo=bun&logoColor=%23000000)](https://bun.sh)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Features](#features) • [Install](#install) • [Usage](#usage) • [Configuration](#configuration) • [Development](#development)

</div>

## Overview

tokrec-tui is a CLI tool that monitors multiple TikTok users and automatically records their livestreams. It uses [@zfadhli/tokrec](https://github.com/zfadhli/tokrec) for stream detection and recording, with a live terminal UI powered by [@opentui/core](https://github.com/anomalyco/opentui).

## Features

- Monitor multiple TikTok users simultaneously
- Auto-detect when a user goes live and start recording
- Live TUI with color-coded status display
- Add, stop, and restart users at runtime
- Graceful shutdown with FFmpeg conversion completion
- Config file-based setup

## Install

```bash
bun install
bun run link
```

This builds the project and registers `tokrec-tui` globally.

> [!PREREQUISITES]
> - [Bun](https://bun.sh) >= 1.2
> - [FFmpeg](https://ffmpeg.org) on `$PATH`
> - TikTok `sessionid_ss` cookie (export from browser)

## Usage

```bash
tokrec-tui
```

The TUI displays a live status table:

```
  ┌─ User Status ──────────────────────────────┐
  │ user1                    Recording          │
  │ user2                    Polling            │
  │ user3                    Idle               │
  └─────────────────────────────────────────────┘

  [q] quit  [s] stop  [r] restart  [n] new
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `q` | Quit (stops all recordings gracefully) |
| `s` | Stop mode — select a user to stop |
| `r` | Restart mode — select a user to restart |
| `n` | New download — add a user at runtime |
| `Ctrl+C` | Same as `q` |

### Stop / Restart Mode

When you press `s` or `r`, the TUI switches to a mode where you can type a username or number to stop/restart that user's recorder. Press Enter with blank input to return to monitoring.

### New Download

Press `n` to add a new user. Enter a TikTok username and it will be added to the monitor list and saved to `tokrec.json`.

## Configuration

Create a `tokrec.json` file in your working directory:

```json
{
  "outputDir": "./recordings",
  "interval": 3,
  "users": ["tiktok_user1", "tiktok_user2"],
  "cookiesPath": "./cookies.json",
  "duration": 0
}
```

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `outputDir` | `string` | `./recordings` | Directory for recorded files |
| `interval` | `number` | `3` | Polling interval in minutes |
| `users` | `string[]` | `[]` | TikTok usernames to monitor |
| `cookiesPath` | `string` | — | Path to TikTok cookies file |
| `duration` | `number` | `0` | Max recording duration in seconds (0 = unlimited) |

### Cookies

Export your TikTok `sessionid_ss` cookie as a JSON file:

```json
{
  "sessionid_ss": "your_session_id_here"
}
```

Place it at `./cookies.json` or wherever `cookiesPath` points.

## Development

```bash
# Run in development mode
bun run dev

# Lint
bun run lint

# Format
bun run format

# Build
bun run build
```

### Project Structure

```
src/
  index.ts      Entry point
  cli.ts        OpenTUI TUI renderer
  manager.ts    tokrec wrapper
  config.ts     Config loader/saver
  types.ts      Type definitions
  utils.ts      Helpers
bin/
  tokrec-tui    CLI entry point
```

### Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Language**: TypeScript (strict mode)
- **TUI**: [@opentui/core](https://github.com/anomalyco/opentui)
- **Recording**: [@zfadhli/tokrec](https://github.com/zfadhli/tokrec)
- **Build**: [tsdown](https://github.com/rolldown/tsdown)
- **Lint/Format**: [Biome](https://biomejs.dev)
- **Git Hooks**: [Lefthook](https://github.com/evilmartians/lefthook)
