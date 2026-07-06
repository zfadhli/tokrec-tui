import type { RecorderConfig, RecorderController } from "@zfadhli/tokrec";
import { createRecorder } from "@zfadhli/tokrec";
import type { AppStatus } from "./types.ts";

export class Manager {
  private controllers = new Map<string, RecorderController>();
  private lastErrors = new Map<string, string>();

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
    ctrl.on("recording:start", () => {
      this.lastErrors.delete(user);
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
}
