import type { AppStatus } from "./types.ts";

const stateLabels: Record<AppStatus, string> = {
  idle: "Idle",
  polling: "Polling",
  recording: "Recording",
  converting: "Converting",
  stopped: "Stopped",
  error: "Error",
};

const stateColors: Record<AppStatus, string> = {
  idle: "\x1b[90m",
  polling: "\x1b[36m",
  recording: "\x1b[32m",
  converting: "\x1b[33m",
  stopped: "\x1b[90m",
  error: "\x1b[31m",
};

const reset = "\x1b[0m";

export function renderStatus(statuses: Map<string, AppStatus>): string {
  if (statuses.size === 0) return "  No users configured.\n";

  const lines: string[] = ["  \u250c\u2500 User Status \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510"];

  const order = ["recording", "converting", "polling", "idle", "stopped", "error"];
  const entries = [...statuses.entries()].sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]));

  for (const [user, state] of entries) {
    const color = stateColors[state] ?? "";
    const label = stateLabels[state] ?? state;
    lines.push(`  \u2502 ${color}${user.padEnd(24)} ${label.padEnd(11)}${reset} \u2502`);
  }

  lines.push("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");
  lines.push("");
  lines.push("  \x1b[90m[q] quit  [s] stop user\x1b[0m");

  return lines.join("\n");
}
