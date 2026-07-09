import { readFileSync } from "node:fs";
import type {
  CliRenderer,
  InputRenderable,
  KeyEvent,
  Renderable,
  ScrollBoxRenderable,
  TextRenderable,
} from "@opentui/core";
import {
  Box,
  createCliRenderer,
  cyan,
  Input,
  ScrollBox,
  Text,
  TextAttributes,
  t,
} from "@opentui/core";
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
  private logEntries: Renderable[] = [];

  // Track previous states for transition logging
  private prevStates = new Map<string, AppStatus>();

  constructor(
    private manager: Manager,
    private config: AppConfig,
  ) {}

  async start(): Promise<void> {
    if (this.config.users.length === 0) {
      console.error("❌ No users in config — add users to tokrec.json");
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
        content: "  [↑/↓/j/k] navigate  [s] stop  [r] restart  [d] delete  [n] new  [q] quit",
        fg: "gray",
      }),
    );

    // Body (sidebar + detail)
    const body = Box({ flexDirection: "row", flexGrow: 1 });

    // Sidebar — ScrollBox for many users
    // ponytail: ScrollBox() returns ProxiedVNode; add() accepts VNode at runtime
    body.add(
      ScrollBox({
        scrollY: true,
        flexDirection: "column",
        height: "100%",
        width: "30%",
        borderStyle: "rounded",
        borderColor: "cyan",
        title: " Users ",
        padding: 1,
      }) as any,
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
    // ponytail: add() puts items as direct children of ScrollBox, not in wrapper>viewport>content
    for (let i = 0; i < this.config.users.length; i++) {
      this.sidebarRenderable?.add(Text({ content: "" }));
    }
    // Extract sidebar TextRenderables — items are direct children after wrapper+scrollbars
    const sidebarChildren = this.sidebarRenderable?.getChildren() ?? [];
    const sidebarOffset = sidebarChildren.length - this.config.users.length;
    for (let i = 0; i < this.config.users.length; i++) {
      const child = sidebarChildren[sidebarOffset + i];
      if (child) this.sidebarTexts.push(child as TextRenderable);
    }

    // Populate detail pane with 6 placeholder lines (4 info + spacer + actions)
    for (let i = 0; i < 6; i++) {
      this.detailRenderable?.add(Text({ content: "" }));
    }
    // Extract detail TextRenderables
    const detailChildren = this.detailRenderable?.getChildren() ?? [];
    for (let i = 0; i < 6; i++) {
      const child = detailChildren[i];
      if (child) this.detailTexts.push(child as TextRenderable);
    }

    // ── Keyboard handling ──

    this.renderer.keyInput.on("keypress", (event: KeyEvent) => {
      if (event.name === "q" || (event.ctrl && event.name === "c")) {
        if (!this.inNewMode) {
          this.shutdown().then(() => process.exit(0));
        }
        return;
      }

      if (this.inNewMode) return;

      if (event.name === "up" || event.name === "k") {
        this.moveSelection(-1);
      } else if (event.name === "down" || event.name === "j") {
        this.moveSelection(1);
      } else if (event.name === "s") {
        this.stopSelectedUser();
      } else if (event.name === "r") {
        this.restartSelectedUser();
      } else if (event.name === "d") {
        this.deleteSelectedUser();
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
    this.scrollSidebarToSelected();
  }

  private scrollSidebarToSelected(): void {
    if (!this.sidebarRenderable) return;
    const scrollBox = this.sidebarRenderable as ScrollBoxRenderable;
    const selectedText = this.sidebarTexts[this.selectedIndex];
    if (selectedText) {
      scrollBox.scrollChildIntoView(selectedText.id);
    }
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

    // Log filename when recording ends (state transition away from "recording")
    for (const [user, state] of statuses) {
      const prev = this.prevStates.get(user);
      if (prev === "recording" && state !== "recording") {
        const file = this.manager.getProgress(user)?.file;
        if (file) this.addLogEntry(user, `Saved: ${file}`);
      }
    }
    // Update previous states
    for (const [user, state] of statuses) {
      this.prevStates.set(user, state);
    }

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

      const recIcon = state === "recording" ? " ●" : "";
      text.content = isSelected ? `>> ${icon} ${user}${recIcon}` : `  ${icon} ${user}${recIcon}`;
      text.fg = color;
      text.attributes = TextAttributes.NONE;
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
    if (!user || this.detailTexts.length < 6) return;

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

    // Line 4: spacer
    this.setDetailLine(4, "", "gray");

    // Line 5: Action hints
    const isActive = state !== "idle";
    const stopHint = isActive ? "[s] Stop" : "[s] Stop";
    const stopColor = isActive ? "yellow" : "gray";
    this.setDetailLine(5, `${stopHint}   [r] Restart   [d] Delete`, stopColor);
  }

  // ── Log pane ──

  private addLogEntry(user: string, message: string): void {
    if (!this.logPane) return;

    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const entry = Text({ content: `[${timestamp}] ${user}: ${message}`, fg: "white" });
    this.logPane.add(entry as any);
    // ponytail: add() instantiates VNode into real Renderable; store that, not the proxy
    const renderable = this.logPane.getChildren().at(-1);
    if (renderable) this.logEntries.push(renderable);

    if (this.logEntries.length > MAX_LOG_ENTRIES) {
      const old = this.logEntries.shift();
      if (old) this.logPane.remove(old);
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

  private overlayRenderable: Renderable | null = null;

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
    this.overlayRenderable = this.renderer.root.getChildren().at(-1) ?? null;
    if (!this.overlayRenderable) return;

    const innerBox = Box({
      flexDirection: "column",
      borderStyle: "rounded",
      borderColor: "yellow",
      title: ` ${title} `,
      padding: 1,
      width: 50,
      backgroundColor: "black",
    });
    this.overlayRenderable.add(innerBox);

    // Extract inner renderable and pass to builder
    const innerRenderable = this.overlayRenderable.getChildren().at(-1);
    if (innerRenderable) {
      buildContent(innerRenderable);
    }
  }

  private removeOverlay(): void {
    if (!this.renderer || !this.overlayRenderable) return;
    this.renderer.root.remove(this.overlayRenderable);
    this.overlayRenderable = null;
  }

  private stopSelectedUser(): void {
    const user = this.config.users[this.selectedIndex];
    if (!user) return;
    const file = this.manager.getProgress(user)?.file;
    this.addLogEntry(user, "Stopping...");
    if (file) this.addLogEntry(user, `Saved: ${file}`);
    this.manager.stopUser(user).catch(() => {});
  }

  private restartSelectedUser(): void {
    const user = this.config.users[this.selectedIndex];
    if (!user) return;
    this.addLogEntry(user, "Restarting...");
    this.manager.restartUser(user, {
      outputDir: this.config.outputDir,
      interval: this.config.interval,
      logConsole: false,
      ...(this.config.cookiesPath ? { cookiesPath: this.config.cookiesPath } : {}),
      ...(this.config.duration ? { duration: this.config.duration } : {}),
    });
  }

  private deleteSelectedUser(): void {
    const user = this.config.users[this.selectedIndex];
    if (!user) return;
    this.addLogEntry(user, "Deleting...");
    this.manager.stopUser(user).catch(() => {});
    this.config.users.splice(this.selectedIndex, 1);
    saveConfig(this.config);
    // Remove renderable from ScrollBox and from tracking array
    const removed = this.sidebarTexts.splice(this.selectedIndex, 1)[0];
    if (removed && this.sidebarRenderable) {
      this.sidebarRenderable.remove(removed);
    }
    if (this.selectedIndex >= this.config.users.length) {
      this.selectedIndex = Math.max(0, this.config.users.length - 1);
    }
    this.renderSidebar();
    this.updateDetail();
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

    // Add text to sidebar ScrollBox
    this.sidebarRenderable.add(Text({ content: "" }));
    // ponytail: items are direct children of ScrollBox
    const renderable = this.sidebarRenderable.getChildren().at(-1) as TextRenderable;
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
