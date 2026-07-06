import { createRecorder } from "@zfadhli/tokrec";
import type { RecorderController, RecorderConfig } from "@zfadhli/tokrec";
import type { AppStatus } from "./types.ts";

export class Manager {
  private controllers = new Map<string, RecorderController>();

  // ponytail: same config for all users; per-user overrides per proxy/cookies if needed
  startUser(user: string, config: Omit<RecorderConfig, "user">): RecorderController {
    if (this.controllers.has(user)) {
      console.warn(`[${user}] already tracked — ignoring`);
      return this.controllers.get(user)!;
    }
    const ctrl = createRecorder({ ...config, user });
    this.controllers.set(user, ctrl);
    // ponytail: async start() race — stopAll() called before start() body
    // executes is silently ignored by tokrec. Not a live race in the TUI
    // (2s refresh before user can interact), but guard defensively.
    ctrl.start().catch((err) => console.error(`[${user}] error:`, err));
    return ctrl;
  }

  async stopUser(user: string): Promise<void> {
    await this.controllers.get(user)?.stop();
    this.controllers.delete(user);
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
}
