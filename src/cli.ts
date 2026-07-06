import type {
  CliRenderer,
  InputRenderable,
  KeyEvent,
  Renderable,
  TextRenderable,
} from "@opentui/core";
import { Box, createCliRenderer, Input, Text } from "@opentui/core";
import type { AppConfig } from "./config.ts";
import { saveConfig } from "./config.ts";
import type { Manager } from "./manager.ts";
import type { AppStatus } from "./types.ts";
import { sleep } from "./utils.ts";

const REFRESH_MS = 2000;
const SHUTDOWN_TIMEOUT = 5000;
const STARTUP_DELAY = 5000;

const stateColors: Record<AppStatus, string> = {
  recording: "cyan",
  converting: "yellow",
  polling: "white",
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
  private inRestartMode = false;
  private inNewMode = false;
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
        content: "  [q] quit  [s] stop  [r] restart  [n] new",
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
      const inAnyMode = this.inStopMode || this.inRestartMode || this.inNewMode;
      if (event.name === "q" || (event.ctrl && event.name === "c")) {
        if (!inAnyMode) {
          this.shutdown().then(() => process.exit(0));
        }
      }
      if (event.name === "s" && !inAnyMode) {
        this.handleStopMode();
      }
      if (event.name === "r" && !inAnyMode) {
        this.handleRestartMode();
      }
      if (event.name === "n" && !inAnyMode) {
        this.handleNewMode();
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
      // Delay focus by one tick so the triggering keystroke ("s") is consumed first
      queueMicrotask(() => inputRenderable.focus());
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
    // Delay focus by one tick so the triggering keystroke ("s") is consumed first
    queueMicrotask(() => inputRenderable.focus());
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

  private handleRestartMode(): void {
    if (!this.renderer || this.inRestartMode) return;
    this.inRestartMode = true;

    // Hide status container
    this.statusContainer!.visible = false;

    // Build restart mode UI
    const restartBox = Box({
      flexDirection: "column",
      borderStyle: "rounded",
      title: "Restart Mode",
      padding: 1,
      width: 50,
    });

    const users = this.config.users;
    if (users.length === 0) {
      restartBox.add(Text({ content: "  No configured users." }));
      restartBox.add(Text({ content: "  Press Enter to return..." }));
      restartBox.add(Input({ placeholder: "" }));
      this.renderer.root.add(restartBox);

      const restartRenderable = this.renderer.root.getChildren().at(-1);
      if (!restartRenderable) return;
      const inputRenderable = restartRenderable.getChildren().at(-1) as InputRenderable;
      inputRenderable.value = "";
      queueMicrotask(() => inputRenderable.focus());
      inputRenderable.on("enter", () => {
        this.renderer?.root.remove(restartRenderable as any);
        this.statusContainer!.visible = true;
        this.inRestartMode = false;
      });
      return;
    }

    users.forEach((u, i) => {
      restartBox.add(Text({ content: `  ${i + 1}. ${u}` }));
    });
    restartBox.add(Text({ content: "" }));
    restartBox.add(Text({ content: "  Enter number or username (blank to cancel):" }));
    restartBox.add(Input({ placeholder: "" }));
    this.renderer.root.add(restartBox);

    const restartRenderable = this.renderer.root.getChildren().at(-1);
    if (!restartRenderable) return;
    const inputRenderable = restartRenderable.getChildren().at(-1) as InputRenderable;
    inputRenderable.value = "";
    queueMicrotask(() => inputRenderable.focus());
    inputRenderable.on("enter", () => {
      const value = inputRenderable.value.trim();
      if (value) {
        const idx = Number.parseInt(value, 10);
        const target =
          !Number.isNaN(idx) && idx >= 1 && idx <= users.length ? users[idx - 1] : value;
        if (target && users.includes(target)) {
          this.manager.restartUser(target, {
            outputDir: this.config.outputDir,
            interval: this.config.interval,
            logConsole: false,
            ...(this.config.cookiesPath ? { cookiesPath: this.config.cookiesPath } : {}),
            ...(this.config.duration ? { duration: this.config.duration } : {}),
          });
        }
      }
      this.renderer?.root.remove(restartRenderable as any);
      this.statusContainer!.visible = true;
      this.inRestartMode = false;
    });
  }

  private handleNewMode(): void {
    if (!this.renderer || this.inNewMode) return;
    this.inNewMode = true;

    // Hide status container
    this.statusContainer!.visible = false;

    // Build new mode UI
    const newBox = Box({
      flexDirection: "column",
      borderStyle: "rounded",
      title: "New Download",
      padding: 1,
      width: 50,
    });

    newBox.add(Text({ content: "  Enter TikTok username to monitor:" }));
    newBox.add(Input({ placeholder: "" }));
    this.renderer.root.add(newBox);

    const newRenderable = this.renderer.root.getChildren().at(-1);
    if (!newRenderable) return;
    const inputRenderable = newRenderable.getChildren().at(-1) as InputRenderable;
    inputRenderable.value = "";
    queueMicrotask(() => inputRenderable.focus());
    inputRenderable.on("enter", () => {
      const value = inputRenderable.value.trim();
      if (value) {
        this.addNewUser(value);
      }
      this.renderer?.root.remove(newRenderable as any);
      this.statusContainer!.visible = true;
      this.inNewMode = false;
    });
  }

  private addNewUser(user: string): void {
    if (!this.statusContainer) return;

    // Add text renderable for new user (insert before footer)
    const children = this.statusContainer.getChildren();
    const footerIndex = children.length - 1; // footer is last child
    const newText = Text({ content: `  ${user.padEnd(24)} Idle` });
    this.statusContainer.add(newText, footerIndex);

    // Extract the actual renderable and add to map
    const updatedChildren = this.statusContainer.getChildren();
    const renderable = updatedChildren[footerIndex] as TextRenderable;
    if (renderable) {
      this.userRenderables.set(user, renderable);
    }

    // Start the recorder
    this.manager.startUser(user, {
      outputDir: this.config.outputDir,
      interval: this.config.interval,
      logConsole: false,
      ...(this.config.cookiesPath ? { cookiesPath: this.config.cookiesPath } : {}),
      ...(this.config.duration ? { duration: this.config.duration } : {}),
    });

    // Save updated config
    this.config.users.push(user);
    saveConfig(this.config);
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
