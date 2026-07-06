# TikTok Livestream Manager

A Bun-based CLI tool to monitor and record multiple TikTok livestreams using [@zfadhli/tokrec](https://github.com/zfadhli/tokrec).

## Features

- ✅ Monitor multiple TikTok users simultaneously
- ✅ Auto-detect when a user goes live and start recording
- ✅ Live TUI with color-coded status display
- ✅ Keyboard shortcuts: `q` to quit, `s` to stop a user
- ✅ Graceful shutdown with FFmpeg conversion completion
- ✅ Config file-based setup (no interactive prompts)

## Requirements

- [Bun](https://bun.sh) >= 1.2
- [FFmpeg](https://ffmpeg.org) on \$PATH (for stream download)
- TikTok `sessionid_ss` cookie (export from browser)

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd ttlive-manager
bun install
```

### 2. Create config

Copy the example and edit:

```bash
cp ttlive.json.example ttlive.json
```

Required fields:
- `users` — array of TikTok usernames to monitor
- `cookiesPath` — path to your TikTok cookies (see below)

Optional fields:
- `outputDir` — where recordings are saved (default: `./recordings`)
- `interval` — how often to poll for live status in minutes (default: 3)
- `duration` — max recording duration in seconds (default: 0 = unlimited)

### 3. Get TikTok cookies

Export your TikTok `sessionid_ss` cookie as a JSON file:

```json
{
  "sessionid_ss": "your_session_id_here"
}
```

Place it at `./cookies.json` (or wherever `cookiesPath` points).

## Usage

```bash
bun run dev
```

This starts monitoring all configured users. The TUI shows:

```
  ┌─ User Status ──────────────────────────┐
  │ tiktok_user1           Recording       │
  │ tiktok_user2           Polling         │
  └─────────────────────────────────────────┘

  [q] quit  [s] stop user
```

### Commands

| Key | Action |
|-----|--------|
| `q` | Quit (stops all recordings gracefully) |
| `s` | Enter stop mode — select a user to stop |
| `Ctrl+C` | Same as `q` |

When you press `s`, the TUI switches to stop mode where you can type a username or number to stop that user's recorder. Press Enter with blank input to return to monitoring.

## How It Works

1. Reads configuration from `ttlive.json`
2. Creates a `RecorderController` (from `@zfadhli/tokrec`) for each user
3. Each recorder polls TikTok every N minutes to check live status
4. When a user goes live, recording starts automatically via FFmpeg
5. Tokrec handles: polling → recording → converting → polling (auto-recycle)
6. The TUI refreshes every 2 seconds with color-coded status

## License

MIT
