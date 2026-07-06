import type {
  CliRenderer,
  InputRenderable,
  KeyEvent,
  Renderable,
  TextRenderable,
} from "@opentui/core";
import { Box, createCliRenderer, Input, Text } from "@opentui/core";
import type { AppConfig } from "./config.ts";
import type { Manager } from "./manager.ts";
import type { AppStatus } from "./types.ts";
import { sleep } from "./utils.ts";

const REFRESH_MS = 2000;
const SHUTDOWN_TIMEOUT = 5000;
const STARTUP_DELAY = 5000;

const stateColors: Record<AppStatus, string> = {
  recording: "green",
  converting: "yellow",
  polling: "cyan",
  idle: "gray",
  stopped: "gray",
  error: "red",
};

export class CLI {
  private renderer: CliRenderer | null = null;
  private userRenderables = new Map<string, TextRenderable>();
  private statusContainer: Renderable | null = null;
  private shuttingDown = false;
  private inStopMode = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private manager: Manager,
    private config: AppConfig,
  ) {}

  async start(): Promise<void> {
    if (this.config.users.length === 0) {
      console.error("❌ No users in config — add users to ttlive.json");
      process.exit(1);
    }

    // Create renderer first — TUI appears immediately
    try {
      this.renderer = await createCliRenderer({
        exitOnCtrlC: false,
        targetFps: 10,
      });
    } catch (err) {
      console.error("Failed to initialize TUI:", err);
      console.error("Ensure you're running in a supported terminal with Bun >= 1.2");
      process.exit(1);
    }

    // Build component tree — all users show "Idle" until downloads start
    const container = Box({
      flexDirection: "column",
      borderStyle: "rounded",
      title: "User Status",
      padding: 1,
      width: 50,
    });

    for (const user of this.config.users) {
      container.add(Text({ content: `  ${user.padEnd(24)} Idle` }));
    }

    container.add(
      Text({
        content: "  [q] quit  [s] stop user",
        fg: "gray",
      }),
    );

    this.renderer.root.add(container);

    // Extract actual renderables from the mounted tree
    this.statusContainer = this.renderer.root.getChildren()[0] ?? null;
    const children = this.statusContainer?.getChildren() ?? [];
    for (let i = 0; i < this.config.users.length; i++) {
      const child = children[i];
      if (child) this.userRenderables.set(this.config.users[i]!, child as any);
    }

    // Keyboard handling
    this.renderer.keyInput.on("keypress", (event: KeyEvent) => {
      if (event.name === "q" || (event.ctrl && event.name === "c")) {
        if (!this.inStopMode) {
          this.shutdown().then(() => process.exit(0));
        }
      }
      if (event.name === "s" && !this.inStopMode) {
        this.handleStopMode();
      }
    });

    // Start render loop + refresh
    this.renderer.start();
    this.refreshStatus();
    this.refreshTimer = setInterval(() => this.refreshStatus(), REFRESH_MS);

    // Start downloads sequentially in background (non-blocking)
    this.startDownloads();

    // Keep process alive
    await new Promise(() => {});
  }

  private async startDownloads(): Promise<void> {
    for (let i = 0; i < this.config.users.length; i++) {
      const user = this.config.users[i]!;
      this.manager.startUser(user, {
        outputDir: this.config.outputDir,
        interval: this.config.interval,
        logConsole: false,
        ...(this.config.cookiesPath ? { cookiesPath: this.config.cookiesPath } : {}),
        ...(this.config.duration ? { duration: this.config.duration } : {}),
      });
      if (i < this.config.users.length - 1) {
        await sleep(STARTUP_DELAY);
      }
    }
  }

  private refreshStatus(): void {
    const statuses = this.manager.getStatuses();
    for (const [user, renderable] of this.userRenderables) {
      const state = statuses.get(user) ?? "idle";
      const color = stateColors[state] ?? "gray";
      renderable.content = `  ${user.padEnd(24)} ${state}`;
      renderable.fg = color;
    }
  }

  private handleStopMode(): void {
    if (!this.renderer || this.inStopMode) return;
    this.inStopMode = true;

    // Hide status container
    this.statusContainer!.visible = false;

    // Build stop mode UI with VNodes
    const stopBox = Box({
      flexDirection: "column",
      borderStyle: "rounded",
      title: "Stop Mode",
      padding: 1,
      width: 50,
    });

    const users = this.manager.getActiveUsers();
    if (users.length === 0) {
      stopBox.add(Text({ content: "  No active users." }));
      stopBox.add(Text({ content: "  Press Enter to return..." }));
      stopBox.add(Input({ placeholder: "" }));
      this.renderer.root.add(stopBox);

      const stopRenderable = this.renderer.root.getChildren().at(-1);
      if (!stopRenderable) return;
      const inputRenderable = stopRenderable.getChildren().at(-1) as InputRenderable;
      inputRenderable.value = "";
      inputRenderable.focus();
      inputRenderable.on("enter", () => {
        this.renderer?.root.remove(stopRenderable as any);
        this.statusContainer!.visible = true;
        this.inStopMode = false;
      });
      return;
    }

    users.forEach((u, i) => {
      stopBox.add(Text({ content: `  ${i + 1}. ${u}` }));
    });
    stopBox.add(Text({ content: "" }));
    stopBox.add(Text({ content: "  Enter number or username (blank to cancel):" }));
    stopBox.add(Input({ placeholder: "" }));
    this.renderer.root.add(stopBox);

    const stopRenderable = this.renderer.root.getChildren().at(-1);
    if (!stopRenderable) return;
    const inputRenderable = stopRenderable.getChildren().at(-1) as InputRenderable;
    inputRenderable.value = "";
    inputRenderable.focus();
    inputRenderable.on("enter", () => {
      const value = inputRenderable.value.trim();
      if (value) {
        const idx = Number.parseInt(value, 10);
        const target =
          !Number.isNaN(idx) && idx >= 1 && idx <= users.length ? users[idx - 1] : value;
        if (target && users.includes(target)) {
          this.manager.stopUser(target).catch(() => {});
        }
      }
      this.renderer?.root.remove(stopRenderable as any);
      this.statusContainer!.visible = true;
      this.inStopMode = false;
    });
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.renderer?.destroy();
    await Promise.race([
      this.manager.stopAll(),
      new Promise((r) => setTimeout(r, SHUTDOWN_TIMEOUT)),
    ]);
  }
}
