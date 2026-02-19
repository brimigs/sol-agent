/**
 * Heartbeat Daemon
 *
 * Runs periodic tasks on cron schedules inside the same Node.js process.
 * The heartbeat runs even when the agent is sleeping.
 * It IS the agent's pulse. When it stops, the agent is dead.
 */

import cronParser from "cron-parser";
import type {
  AgentConfig,
  AgentDatabase,
  SolanaAgentClient,
  AgentIdentity,
  HeartbeatEntry,
  SocialClientInterface,
} from "../types.js";
import { BUILTIN_TASKS, type HeartbeatTaskContext } from "./tasks.js";
import { getSurvivalTier } from "../agent-client/credits.js";

export interface HeartbeatDaemonOptions {
  identity: AgentIdentity;
  config: AgentConfig;
  db: AgentDatabase;
  agentClient: SolanaAgentClient;
  social?: SocialClientInterface;
  onWakeRequest?: (reason: string) => void;
}

export interface HeartbeatDaemon {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  forceRun(taskName: string): Promise<void>;
}

/**
 * Create and return the heartbeat daemon.
 */
// After this many consecutive full-tick failures the daemon stops itself and
// wakes the agent loop so it knows the heartbeat has died.
const MAX_CONSECUTIVE_TICK_ERRORS = 5;

// After this many consecutive failures for a single task the agent loop is
// woken so it can inspect and potentially self-heal.
const MAX_CONSECUTIVE_TASK_ERRORS = 3;

export function createHeartbeatDaemon(
  options: HeartbeatDaemonOptions,
): HeartbeatDaemon {
  const { identity, config, db, agentClient, social, onWakeRequest } = options;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let running = false;

  // Consecutive-failure counters — reset to 0 on any success.
  let consecutiveTickErrors = 0;
  const consecutiveTaskErrors = new Map<string, number>();

  const taskContext: HeartbeatTaskContext = {
    identity,
    config,
    db,
    agentClient,
    social,
  };

  /**
   * Check if a heartbeat entry is due to run.
   */
  function isDue(entry: HeartbeatEntry): boolean {
    if (!entry.enabled) return false;
    if (!entry.schedule) return false;

    try {
      const interval = cronParser.parseExpression(entry.schedule, {
        currentDate: entry.lastRun
          ? new Date(entry.lastRun)
          : new Date(Date.now() - 86400000), // If never run, assume due
      });

      const nextRun = interval.next().toDate();
      return nextRun <= new Date();
    } catch {
      return false;
    }
  }

  /**
   * Execute a single heartbeat task.
   *
   * Failures are counted per-task. After MAX_CONSECUTIVE_TASK_ERRORS
   * consecutive failures the agent loop is woken via onWakeRequest so it
   * can log the situation and potentially self-heal. The counter resets on
   * any successful execution.
   */
  async function executeTask(entry: HeartbeatEntry): Promise<void> {
    const taskFn = BUILTIN_TASKS[entry.task];
    if (!taskFn) {
      // Unknown task -- skip silently
      return;
    }

    try {
      const result = await taskFn(taskContext);

      // Success — reset this task's error counter.
      consecutiveTaskErrors.set(entry.name, 0);

      // Update last run
      const now = new Date().toISOString();
      db.updateHeartbeatLastRun(entry.name, now);

      // If the task says we should wake, fire the callback
      if (result.shouldWake && onWakeRequest) {
        onWakeRequest(
          result.message || `Heartbeat task '${entry.name}' requested wake`,
        );
      }
    } catch (err: any) {
      const prev = consecutiveTaskErrors.get(entry.name) ?? 0;
      const count = prev + 1;
      consecutiveTaskErrors.set(entry.name, count);

      console.error(
        `[HEARTBEAT] Task '${entry.name}' failed ` +
          `(${count}/${MAX_CONSECUTIVE_TASK_ERRORS}): ${err.message}`,
      );

      if (count >= MAX_CONSECUTIVE_TASK_ERRORS && onWakeRequest) {
        onWakeRequest(
          `Heartbeat task '${entry.name}' has failed ${count} consecutive times: ${err.message}`,
        );
      }
    }
  }

  /**
   * The main tick function. Runs on every interval.
   */
  async function tick(): Promise<void> {
    const entries = db.getHeartbeatEntries();

    // Check survival tier to adjust behavior
    let creditsCents = 0;
    try {
      creditsCents = await agentClient.getCreditsBalance();
    } catch {}

    const tier = getSurvivalTier(creditsCents);
    const isLowCompute = tier === "low_compute" || tier === "critical" || tier === "dead";

    for (const entry of entries) {
      if (!entry.enabled) continue;

      // In low compute mode, only run essential tasks
      if (isLowCompute) {
        const essentialTasks = [
          "heartbeat_ping",
          "check_credits",
          "check_usdc_balance",
          "check_social_inbox",
        ];
        if (!essentialTasks.includes(entry.task)) continue;
      }

      if (isDue(entry)) {
        await executeTask(entry);
      }
    }
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Run one tick, tracking consecutive failures.
   *
   * On success the tick counter resets. After MAX_CONSECUTIVE_TICK_ERRORS
   * consecutive failures the daemon stops itself and fires onWakeRequest so
   * the agent loop knows the heartbeat has died rather than running silently
   * with a non-functional pulse.
   */
  async function safeTick(): Promise<void> {
    try {
      await tick();
      consecutiveTickErrors = 0; // reset on any successful tick
    } catch (err: any) {
      consecutiveTickErrors++;
      console.error(
        `[HEARTBEAT] Tick failed ` +
          `(${consecutiveTickErrors}/${MAX_CONSECUTIVE_TICK_ERRORS}): ${err.message}`,
      );

      if (consecutiveTickErrors >= MAX_CONSECUTIVE_TICK_ERRORS) {
        console.error(
          `[HEARTBEAT] ${MAX_CONSECUTIVE_TICK_ERRORS} consecutive tick failures — stopping daemon.`,
        );
        stop();
        if (onWakeRequest) {
          onWakeRequest(
            `Heartbeat daemon stopped after ${consecutiveTickErrors} consecutive tick failures: ${err.message}`,
          );
        }
      }
    }
  }

  const start = (): void => {
    if (running) return;
    running = true;

    // Get tick interval -- default 60 seconds
    const tickMs = config.logLevel === "debug" ? 15_000 : 60_000;

    // Run first tick immediately
    safeTick();

    intervalId = setInterval(() => {
      safeTick();
    }, tickMs);

    console.log(
      `[HEARTBEAT] Daemon started. Tick interval: ${tickMs / 1000}s`,
    );
  };

  const stop = (): void => {
    if (!running) return;
    running = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    console.log("[HEARTBEAT] Daemon stopped.");
  };

  const isRunning = (): boolean => running;

  const forceRun = async (taskName: string): Promise<void> => {
    const entries = db.getHeartbeatEntries();
    const entry = entries.find((e) => e.name === taskName);
    if (entry) {
      await executeTask(entry);
    }
  };

  return { start, stop, isRunning, forceRun };
}
