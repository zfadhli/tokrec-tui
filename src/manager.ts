import type { RecorderConfig, RecorderController } from "@zfadhli/tokrec";
import { createRecorder } from "@zfadhli/tokrec";
import type { AppStatus } from "./types.ts";

export class Manager {
  private controllers = new Map<string, RecorderController>();
  private lastErrors = new Map<string, string>();
  private recordingStarts = new Map<string, number>();
  private progress = new Map<
    string,
    { speed: number; bytes: number; file?: string; size?: number }
  >();

  // ponytail: same config for all users; per-user overrides per proxy/cookies if needed
  startUser(user: string, config: Omit<RecorderConfig, "user">): RecorderController {
    if (this.controllers.has(user)) {
      console.warn(`[${user}] already tracked — ignoring`);
      return this.controllers.get(user)!;
    }
    this.lastErrors.delete(user);
    const ctrl = createRecorder({ ...config, user });
    this.controllers.set(user, ctrl);

    // Track error events from tokrec (non-fatal — controller keeps running)
    ctrl.on("error", (err) => {
      this.lastErrors.set(user, err.message);
    });

    // Clear error when recording starts (transient error recovered)
    ctrl.on("recording:start", (info) => {
      this.lastErrors.delete(user);
      this.recordingStarts.set(user, Date.now());
      // Generate filename since tokrec emits file:"" at start
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const file = `${user}=${date}_${time}.ts`;
      this.progress.set(user, { speed: 0, bytes: 0, file });
    });

    // Clear timer when recording ends
    ctrl.on("recording:end", (info) => {
      this.recordingStarts.delete(user);
      const prev = this.progress.get(user);
      if (prev) {
        this.progress.set(user, { ...prev, file: info.file, size: info.size });
      }
    });

    // Download progress tracking
    ctrl.on("download:progress", (info) => {
      this.progress.set(user, { ...this.progress.get(user), speed: info.speed, bytes: info.bytes });
    });

    // ponytail: async start() race — stopAll() called before start() body
    // executes is silently ignored by tokrec. Not a live race in the TUI
    // (2s refresh before user can interact), but guard defensively.
    ctrl.start().catch((err) => {
      this.lastErrors.set(user, String(err.message ?? err));
      this.controllers.delete(user);
    });
    return ctrl;
  }

  async stopUser(user: string): Promise<void> {
    await this.controllers.get(user)?.stop();
    this.controllers.delete(user);
    this.lastErrors.delete(user);
    this.recordingStarts.delete(user);
    this.progress.delete(user);
  }

  restartUser(user: string, config: Omit<RecorderConfig, "user">): void {
    this.stopUser(user).then(() => {
      this.startUser(user, config);
    });
  }

  async stopAll(): Promise<void> {
    await Promise.allSettled([...this.controllers.keys()].map((u) => this.stopUser(u)));
  }

  /** Returns a snapshot of active users mapped to their statuses. */
  getStatuses(): Map<string, AppStatus> {
    const result = new Map<string, AppStatus>();
    for (const [user, ctrl] of this.controllers) {
      result.set(user, ctrl.getStatus().state);
    }
    return result;
  }

  getActiveUsers(): string[] {
    return [...this.controllers.keys()];
  }

  getLastError(user: string): string | undefined {
    return this.lastErrors.get(user);
  }

  getRecordingStart(user: string): number | undefined {
    return this.recordingStarts.get(user);
  }

  getProgress(
    user: string,
  ): { speed: number; bytes: number; file?: string; size?: number } | undefined {
    return this.progress.get(user);
  }
}
