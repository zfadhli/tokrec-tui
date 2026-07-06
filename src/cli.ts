import type { Manager } from "./manager.ts";
import type { AppConfig } from "./config.ts";
import { renderStatus } from "./terminal.ts";
import { sleep } from "./utils.ts";

const REFRESH_INTERVAL = 2000;
const STOP_TIMEOUT = 5000;

export class CLI {
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private rawMode = false;
  private shuttingDown = false;

  constructor(
    private manager: Manager,
    private config: AppConfig,
  ) {}

  async start(): Promise<void> {
    if (this.config.users.length === 0) {
      console.error("❌ No users in config — add users to ttlive.json");
      process.exit(1);
    }

    console.log(`Starting monitoring for ${this.config.users.length} user(s)...\n`);
    for (const user of this.config.users) {
      this.manager.startUser(user, {
        outputDir: this.config.outputDir,
        interval: this.config.interval,
        logConsole: false,
        ...(this.config.cookiesPath ? { cookiesPath: this.config.cookiesPath } : {}),
        ...(this.config.duration ? { duration: this.config.duration } : {}),
      });
    }

    this.setupInput();
    this.setupRefresh();
    await this.waitForQuit();
  }

  /** Public shutdown — restores terminal, stops all recorders. Safe to call multiple times. */
  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.rawMode) {
      process.stdin.setRawMode(false);
      this.rawMode = false;
    }
    process.stdin.pause();
    console.clear();
    console.log("Shutting down...");
    await Promise.race([this.manager.stopAll(), sleep(STOP_TIMEOUT)]);
  }

  private setupInput(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      this.rawMode = true;
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    process.stdin.on("data", async (buf: Buffer) => {
      const key = buf.toString();
      if (key === "q" || key === "\x03") {
        await this.shutdown();
        process.exit(0);
      }
      if (key === "s") {
        await this.handleStopMode();
      }
    });
  }

  private setupRefresh(): void {
    this.refreshTimer = setInterval(() => {
      this.renderFrame();
    }, REFRESH_INTERVAL);
    this.renderFrame();
  }

  private renderFrame(): void {
    const statuses = this.manager.getStatuses();
    const output = renderStatus(statuses);
    console.clear();
    console.log(output);
  }

  // ponytail: line input only; multi-select / fuzzy-search / tab-complete if UX demands
  private async handleStopMode(): Promise<void> {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.rawMode) process.stdin.setRawMode(false);

    console.clear();
    console.log("  Stop Mode — choose a user to stop:\n");
    const users = this.manager.getActiveUsers();
    if (users.length === 0) {
      console.log("  No active users.\n");
      console.log("  Press Enter to return to monitoring...");
      await this.waitForEnter();
      this.resumeMonitoring();
      return;
    }
    users.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
    console.log("\n  Enter number or username (or blank to cancel):");

    const input = await this.readLine();
    const trimmed = input.trim();
    if (trimmed) {
      const idx = Number.parseInt(trimmed, 10);
      const target =
        !Number.isNaN(idx) && idx >= 1 && idx <= users.length
          ? users[idx - 1]
          : trimmed;
      if (target && users.includes(target)) {
        try {
          await this.manager.stopUser(target);
          console.log(`  Stopped: ${target}`);
        } catch {
          console.log(`  Error stopping ${target}`);
        }
      } else {
        console.log(`  Unknown user: ${trimmed}`);
      }
    }

    console.log("\n  Press Enter to return to monitoring...");
    await this.waitForEnter();
    this.resumeMonitoring();
  }

  private readLine(): Promise<string> {
    return new Promise((resolve) => {
      const onData = (chunk: Buffer) => {
        const str = chunk.toString();
        process.stdin.removeListener("data", onData);
        resolve(str.replace(/[\r\n]/g, ""));
      };
      process.stdin.on("data", onData);
    });
  }

  private waitForEnter(): Promise<void> {
    return new Promise((resolve) => {
      const onData = (chunk: Buffer) => {
        process.stdin.removeListener("data", onData);
        resolve();
      };
      process.stdin.on("data", onData);
    });
  }

  private waitForQuit(): Promise<void> {
    return new Promise(() => {});
  }

  private resumeMonitoring(): void {
    if (process.stdin.isTTY && this.rawMode) {
      process.stdin.setRawMode(true);
    }
    this.setupRefresh();
  }
}
