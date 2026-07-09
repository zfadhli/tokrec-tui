<!-- prettier-ignore -->
<div align="center">

# tokrec-tui

A terminal UI for monitoring and recording multiple TikTok livestreams simultaneously.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun->=1.2-fbf0df?style=flat-square&logo=bun&logoColor=%23000000)](https://bun.sh)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Features](#features) \u2022 [Install](#install) \u2022 [Configuration](#configuration) \u2022 [Usage](#usage) \u2022 [Development](#development)

</div>

## Overview

tokrec-tui is a CLI tool that monitors multiple TikTok users and automatically records their livestreams. It uses [@zfadhli/tokrec](https://github.com/zfadhli/tokrec) for stream detection and recording, with a live terminal UI powered by [@opentui/core](https://github.com/anomalyco/opentui).

## Features

- Monitor multiple TikTok users simultaneously
- Auto-detect when a user goes live and start recording
- Live dashboard with color-coded status, detail pane, and event log
- Add, stop, restart, and delete users at runtime
- Scrollable sidebar for managing many users
- Graceful shutdown with FFmpeg conversion completion
- JSONC config support (comments allowed)

## Install

```bash
bun install
bun run link
```

This builds the project and registers `tokrec-tui` globally via `bun link`.

> [!PREREQUISITES]
> - [Bun](https://bun.sh) >= 1.2
> - [FFmpeg](https://ffmpeg.org) on `$PATH`
> - TikTok `sessionid_ss` cookie (export from browser)

## Configuration

Create a `tokrec.json` (or `tokrec.jsonc`) file in your working directory:

```json
{
  "outputDir": "./recordings",
  "interval": 3,
  "users": ["tiktok_user1", "tiktok_user2"],
  "cookiesPath": "./cookies.json",
  "duration": 0
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `outputDir` | `string` | `./recordings` | Directory for recorded files |
| `interval` | `number` | `3` | Polling interval in minutes |
| `users` | `string[]` | `[]` | TikTok usernames to monitor |
| `cookiesPath` | `string` | \u2014 | Path to TikTok cookies file |
| `duration` | `number` | `0` | Max recording duration in seconds (`0` = unlimited) |

### Cookies

Export your TikTok `sessionid_ss` cookie as a JSON file:

```json
{
  "sessionid_ss": "your_session_id_here"
}
```

Place it at `./cookies.json` or wherever `cookiesPath` points.

## Usage

```bash
tokrec-tui
```

The TUI displays a live dashboard with a header bar, user sidebar, detail pane, and scrollable log:

```
  \u250c\u2500 User Status \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
  \u2502 >> user1              \u25cf recording  02:34  \u2502
  \u2502    user2              \u25cb polling           \u2502
  \u2502    user3              \u25cb idle              \u2502
  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518

  [q] quit  [s] stop  [r] restart  [d] delete  [n] new
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit (stops all recordings gracefully) |
| `\u2191`/`\u2193` or `k`/`j` | Navigate sidebar selection |
| `s` | Stop selected user's recorder |
| `r` | Restart selected user's recorder |
| `d` | Delete user from config and sidebar |
| `n` | Add a new user at runtime |

### Status Icons

| Icon | State | Description |
|------|-------|-------------|
| `\u25cf` cyan | Recording | Actively recording a livestream |
| `\u25cf` yellow | Converting | Converting TS to MP4 after stream ends |
| `\u25cb` white | Polling | Checking if user is live |
| `\u25cb` gray | Idle | Not started or stopped |
| `\u2717` red | Error | Network or recording error |

## Development

```bash
# Run from source
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
  index.ts        Entry point
  cli.ts          OpenTUI dashboard renderer
  manager.ts      tokrec wrapper per user
  config.ts       Config loader/saver
  types.ts        Type definitions
  utils.ts        Helpers
bin/
  tokrec-tui      CLI entry point
```

### Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Language**: TypeScript (strict mode)
- **TUI**: [@opentui/core](https://github.com/anomalyco/opentui)
- **Recording**: [@zfadhli/tokrec](https://github.com/zfadhli/tokrec)
- **Build**: [tsdown](https://github.com/rolldown/tsdown)
- **Lint/Format**: [Biome](https://biomejs.dev)
- **Git Hooks**: [Lefthook](https://github.com/evilmartians/lefthook)
