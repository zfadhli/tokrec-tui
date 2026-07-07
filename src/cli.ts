import { readFileSync } from "node:fs";
import type {
  CliRenderer,
  InputRenderable,
  KeyEvent,
  Renderable,
  ScrollBoxRenderable,
  TextRenderable,
} from "@opentui/core";
import { Box, createCliRenderer, Input, ScrollBox, Text, TextAttributes } from "@opentui/core";
import type { AppConfig } from "./config.ts";
import { saveConfig } from "./config.ts";
import type { Manager } from "./manager.ts";
import type { AppStatus } from "./types.ts";
import { sleep } from "./utils.ts";

const REFRESH_MS = 2000;
const SHUTDOWN_TIMEOUT = 5000;
const STARTUP_DELAY = 5000;
const MAX_LOG_ENTRIES = 50;

const stateColors: Record<AppStatus, string> = {
  recording: "cyan",
  converting: "yellow",
  polling: "white",
  idle: "gray",
  stopped: "gray",
  error: "red",
};

const stateIcons: Record<AppStatus, string> = {
  recording: "●",
  converting: "●",
  polling: "○",
  idle: "○",
  stopped: "○",
  error: "✗",
};

export class CLI {
  private renderer: CliRenderer | null = null;
  private shuttingDown = false;
  private inStopMode = false;
  private inRestartMode = false;
  private inNewMode = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // Actual renderables (populated after VNodes mount)
  private statusSummary: TextRenderable | null = null;
  private sidebarRenderable: Renderable | null = null;
  private detailRenderable: Renderable | null = null;
  private logPane: ScrollBoxRenderable | null = null;

  // Sidebar state
  private selectedIndex = 0;
  private sidebarTexts: TextRenderable[] = [];

  // Detail pane texts (6 lines)
  private detailTexts: TextRenderable[] = [];

  // Log pane
  private logEntries: TextRenderable[] = [];

  constructor(
    private manager: Manager,
    private config: AppConfig,
  ) {}

  async start(): Promise<void> {
    if (this.config.users.length === 0) {
      console.error("❌ No users in config — add users to ttlive.json");
      process.exit(1);
    }

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

    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

    // ── Build component tree (VNodes) ──

    // Header bar with status summary
    const header = Box({
      flexDirection: "row",
      justifyContent: "space-between",
      borderStyle: "double",
      borderColor: "cyan",
      title: ` tokrec-tui v${pkg.version} `,
      paddingX: 1,
    });
    header.add(Text({ content: "", flexGrow: 1 })); // status summary (updated in refresh)
    this.renderer.root.add(header);

    // Keyboard shortcuts guide
    this.renderer.root.add(
      Text({
        content: "  [↑/↓/j/k] navigate  [s] stop  [r] restart  [n] new  [q] quit",
        fg: "gray",
      }),
    );

    // Body (sidebar + detail)
    const body = Box({ flexDirection: "row", flexGrow: 1 });

    // Sidebar
    body.add(
      Box({
        flexDirection: "column",
        width: "30%",
        borderStyle: "rounded",
        borderColor: "cyan",
        title: " Users ",
        padding: 1,
      }),
    );

    // Detail pane
    body.add(
      Box({
        flexDirection: "column",
        flexGrow: 1,
        borderStyle: "rounded",
        borderColor: "green",
        title: " Details ",
        padding: 1,
      }),
    );

    this.renderer.root.add(body);

    // Log pane
    // ponytail: ScrollBox() returns ProxiedVNode; add() accepts VNode at runtime
    this.renderer.root.add(
      ScrollBox({
        stickyScroll: true,
        stickyStart: "bottom",
        height: 8,
        borderStyle: "rounded",
        borderColor: "gray",
        title: " Log ",
        scrollY: true,
        flexDirection: "column",
      }) as any,
    );

    // ── Extract actual renderables from mounted tree ──

    const root = this.renderer.root.getChildren();
    // root[0] = header box, root[1] = shortcuts guide, root[2] = body, root[3] = logPane

    // Status summary lives inside the header box
    const headerRenderable = root[0];
    this.statusSummary = (headerRenderable?.getChildren()[0] ?? null) as TextRenderable | null;

    // Body contains sidebar + detail
    const bodyRenderable = root[2];
    const bodyChildren = bodyRenderable?.getChildren() ?? [];
    this.sidebarRenderable = bodyChildren[0] ?? null;
    this.detailRenderable = bodyChildren[1] ?? null;

    // Log pane
    this.logPane = root[3] as ScrollBoxRenderable | null;

    // Populate sidebar with user text placeholders
    for (let i = 0; i < this.config.users.length; i++) {
      this.sidebarRenderable?.add(Text({ content: "" }));
    }
    // Extract sidebar TextRenderables
    const sidebarChildren = this.sidebarRenderable?.getChildren() ?? [];
    for (let i = 0; i < this.config.users.length; i++) {
      const child = sidebarChildren[i];
      if (child) this.sidebarTexts.push(child as TextRenderable);
    }

    // Populate detail pane with 4 placeholder lines
    for (let i = 0; i < 4; i++) {
      this.detailRenderable?.add(Text({ content: "" }));
    }
    // Extract detail TextRenderables
    const detailChildren = this.detailRenderable?.getChildren() ?? [];
    for (let i = 0; i < 4; i++) {
      const child = detailChildren[i];
      if (child) this.detailTexts.push(child as TextRenderable);
    }

    // ── Keyboard handling ──

    this.renderer.keyInput.on("keypress", (event: KeyEvent) => {
      const inAnyMode = this.inStopMode || this.inRestartMode || this.inNewMode;

      if (event.name === "q" || (event.ctrl && event.name === "c")) {
        if (!inAnyMode) {
          this.shutdown().then(() => process.exit(0));
        }
        return;
      }

      if (inAnyMode) return;

      if (event.name === "arrowup" || event.name === "k") {
        this.moveSelection(-1);
      } else if (event.name === "arrowdown" || event.name === "j") {
        this.moveSelection(1);
      } else if (event.name === "s") {
        this.handleStopMode();
      } else if (event.name === "r") {
        this.handleRestartMode();
      } else if (event.name === "n") {
        this.handleNewMode();
      }
    });

    // ── Start ──

    this.renderer.start();
    this.refreshStatus();
    this.refreshTimer = setInterval(() => this.refreshStatus(), REFRESH_MS);
    this.startDownloads();

    await new Promise(() => {});
  }

  // ── Sidebar navigation ──

  private moveSelection(delta: number): void {
    if (this.sidebarTexts.length === 0) return;
    this.selectedIndex = Math.max(
      0,
      Math.min(this.sidebarTexts.length - 1, this.selectedIndex + delta),
    );
    this.renderSidebar();
    this.updateDetail();
  }

  // ── Status summary ──

  private buildStatusSummary(): string {
    const statuses = this.manager.getStatuses();
    let recording = 0;
    let idle = 0;
    let errors = 0;

    for (const [, state] of statuses) {
      if (state === "recording" || state === "converting") recording++;
      else if (state === "error") errors++;
      else idle++;
    }

    const tracked = statuses.size;
    if (tracked < this.config.users.length) {
      idle += this.config.users.length - tracked;
    }

    return `● ${recording} recording  ○ ${idle} idle  ✗ ${errors} errors`;
  }

  // ── Refresh all panes ──

  private refreshStatus(): void {
    if (!this.statusSummary) return;

    const statuses = this.manager.getStatuses();
    this.statusSummary.content = this.buildStatusSummary();
    this.renderSidebar(statuses);
    this.updateDetail();
  }

  // ── Sidebar rendering ──

  private renderSidebar(statuses?: Map<string, AppStatus>): void {
    statuses ??= this.manager.getStatuses();

    for (let i = 0; i < this.config.users.length; i++) {
      const user = this.config.users[i];
      const text = this.sidebarTexts[i];
      if (!user || !text) continue;

      const state = statuses.get(user) ?? "idle";
      const lastError = this.manager.getLastError(user);
      const isSelected = i === this.selectedIndex;

      const icon = lastError ? "✗" : (stateIcons[state] ?? "○");
      const color = lastError ? "red" : (stateColors[state] ?? "gray");

      const indicator = isSelected ? ">>" : "  ";
      const recIcon = state === "recording" ? " ●" : "";
      text.content = `${indicator} ${icon} ${user}${recIcon}`;
      text.fg = isSelected ? "cyan" : color;
      text.attributes = isSelected ? TextAttributes.BOLD : TextAttributes.NONE;
    }
  }

  // ── Detail pane ──

  private setDetailLine(
    i: number,
    content: string,
    fg: string,
    attributes = TextAttributes.NONE,
  ): void {
    const line = this.detailTexts[i];
    if (!line) return;
    line.content = content;
    line.fg = fg;
    line.attributes = attributes;
  }

  private updateDetail(): void {
    const user = this.config.users[this.selectedIndex];
    if (!user || this.detailTexts.length < 4) return;

    const statuses = this.manager.getStatuses();
    const state = statuses.get(user) ?? "idle";
    const lastError = this.manager.getLastError(user);

    // Line 0: User — Status
    const statusColor = lastError ? "red" : (stateColors[state] ?? "gray");
    const statusLabel = lastError ? "Error" : state.charAt(0).toUpperCase() + state.slice(1);
    this.setDetailLine(0, `${user} — ${statusLabel}`, statusColor, TextAttributes.BOLD);

    // Line 1: Duration
    if (state === "recording" || state === "converting") {
      const start = this.manager.getRecordingStart(user);
      const sec = start ? Math.floor((Date.now() - start) / 1000) : 0;
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const timer =
        h > 0
          ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      this.setDetailLine(1, `Duration: ${timer}`, "white");
    } else {
      this.setDetailLine(1, "Duration: —", "gray");
    }

    // Line 2: Status detail
    const detailMsg = lastError ? `Error: ${lastError.slice(0, 40)}` : `Status: ${statusLabel}`;
    this.setDetailLine(2, detailMsg, lastError ? "red" : "white");

    // Line 3: File path
    const currentFile = this.manager.getProgress(user)?.file;
    this.setDetailLine(
      3,
      currentFile ? `File: ${currentFile}` : "File: —",
      currentFile ? "white" : "gray",
    );
  }

  // ── Log pane ──

  private addLogEntry(user: string, message: string): void {
    if (!this.logPane) return;

    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const entry = Text({ content: `[${timestamp}] ${user}: ${message}`, fg: "white" });
    // ponytail: add()/remove() accept VNode at runtime but types require Renderable
    this.logPane.add(entry as any);
    this.logEntries.push(entry as any);

    if (this.logEntries.length > MAX_LOG_ENTRIES) {
      const old = this.logEntries.shift();
      if (old) this.logPane.remove(old as any);
    }
  }

  // ── Start downloads ──

  private async startDownloads(): Promise<void> {
    for (let i = 0; i < this.config.users.length; i++) {
      const user = this.config.users[i];
      if (!user) continue;
      this.addLogEntry(user, "Starting...");
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

  // ── Mode overlays ──

  private showOverlay(title: string, buildContent: (box: Renderable) => void): void {
    if (!this.renderer) return;

    const overlayBox = Box({
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      zIndex: 10,
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    });

    this.renderer.root.add(overlayBox);

    // Extract actual renderable
    const overlayRenderable = this.renderer.root.getChildren().at(-1);
    if (!overlayRenderable) return;

    const innerBox = Box({
      flexDirection: "column",
      borderStyle: "rounded",
      borderColor: "yellow",
      title: ` ${title} `,
      padding: 1,
      width: 50,
      backgroundColor: "black",
    });
    overlayRenderable.add(innerBox);

    // Extract inner renderable and pass to builder
    const innerRenderable = overlayRenderable.getChildren().at(-1);
    if (innerRenderable) {
      buildContent(innerRenderable);
    }
  }

  private removeOverlay(): void {
    if (!this.renderer) return;
    const children = this.renderer.root.getChildren();
    const overlay = children.at(-1);
    if (overlay) this.renderer.root.remove(overlay);
  }

  private handleStopMode(): void {
    if (!this.renderer || this.inStopMode) return;
    this.inStopMode = true;

    const users = this.manager.getActiveUsers();
    this.showOverlay("Stop Mode", (box) => {
      if (users.length === 0) {
        box.add(Text({ content: "  No active users." }));
        box.add(Text({ content: "  Press Enter to return..." }));
        box.add(Input({ placeholder: "" }));
        this.focusInput(box, () => {
          this.removeOverlay();
          this.inStopMode = false;
        });
        return;
      }

      users.forEach((u, i) => {
        box.add(Text({ content: `  ${i + 1}. ${u}` }));
      });
      box.add(Text({ content: "" }));
      box.add(Text({ content: "  Enter number or username (blank to cancel):" }));
      box.add(Input({ placeholder: "" }));
      this.focusInput(box, (value) => {
        if (value) {
          const idx = Number.parseInt(value, 10);
          const target =
            !Number.isNaN(idx) && idx >= 1 && idx <= users.length ? users[idx - 1] : value;
          if (target && users.includes(target)) {
            this.addLogEntry(target, "Stopping...");
            this.manager.stopUser(target).catch(() => {});
          }
        }
        this.removeOverlay();
        this.inStopMode = false;
      });
    });
  }

  private handleRestartMode(): void {
    if (!this.renderer || this.inRestartMode) return;
    this.inRestartMode = true;

    const users = this.config.users;
    this.showOverlay("Restart Mode", (box) => {
      if (users.length === 0) {
        box.add(Text({ content: "  No configured users." }));
        box.add(Text({ content: "  Press Enter to return..." }));
        box.add(Input({ placeholder: "" }));
        this.focusInput(box, () => {
          this.removeOverlay();
          this.inRestartMode = false;
        });
        return;
      }

      users.forEach((u, i) => {
        box.add(Text({ content: `  ${i + 1}. ${u}` }));
      });
      box.add(Text({ content: "" }));
      box.add(Text({ content: "  Enter number or username (blank to cancel):" }));
      box.add(Input({ placeholder: "" }));
      this.focusInput(box, (value) => {
        if (value) {
          const idx = Number.parseInt(value, 10);
          const target =
            !Number.isNaN(idx) && idx >= 1 && idx <= users.length ? users[idx - 1] : value;
          if (target && users.includes(target)) {
            this.addLogEntry(target, "Restarting...");
            this.manager.restartUser(target, {
              outputDir: this.config.outputDir,
              interval: this.config.interval,
              logConsole: false,
              ...(this.config.cookiesPath ? { cookiesPath: this.config.cookiesPath } : {}),
              ...(this.config.duration ? { duration: this.config.duration } : {}),
            });
          }
        }
        this.removeOverlay();
        this.inRestartMode = false;
      });
    });
  }

  private handleNewMode(): void {
    if (!this.renderer || this.inNewMode) return;
    this.inNewMode = true;

    this.showOverlay("New Download", (box) => {
      box.add(Text({ content: "  Enter TikTok username to monitor:" }));
      box.add(Input({ placeholder: "" }));
      this.focusInput(box, (value) => {
        if (value) {
          this.addNewUser(value);
        }
        this.removeOverlay();
        this.inNewMode = false;
      });
    });
  }

  // ── Input helper ──

  private focusInput(box: Renderable, onEnter: (value: string) => void): void {
    const children = box.getChildren();
    const inputRenderable = children.at(-1) as InputRenderable;
    if (!inputRenderable) return;
    inputRenderable.value = "";
    queueMicrotask(() => inputRenderable.focus());
    inputRenderable.on("enter", () => {
      onEnter(inputRenderable.value.trim());
    });
  }

  // ── Add new user ──

  private addNewUser(user: string): void {
    if (!this.sidebarRenderable) return;

    // Add text to sidebar
    this.sidebarRenderable.add(Text({ content: "" }));
    const updatedChildren = this.sidebarRenderable.getChildren();
    const renderable = updatedChildren.at(-1) as TextRenderable;
    if (renderable) {
      this.sidebarTexts.push(renderable);
    }

    this.config.users.push(user);
    saveConfig(this.config);

    this.addLogEntry(user, "Starting (new)...");
    this.manager.startUser(user, {
      outputDir: this.config.outputDir,
      interval: this.config.interval,
      logConsole: false,
      ...(this.config.cookiesPath ? { cookiesPath: this.config.cookiesPath } : {}),
      ...(this.config.duration ? { duration: this.config.duration } : {}),
    });

    this.refreshStatus();
  }

  // ── Shutdown ──

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
