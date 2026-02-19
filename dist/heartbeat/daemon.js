/**
 * Heartbeat Daemon
 *
 * Runs periodic tasks on cron schedules inside the same Node.js process.
 * The heartbeat runs even when the agent is sleeping.
 * It IS the agent's pulse. When it stops, the agent is dead.
 */
import cronParser from "cron-parser";
import { BUILTIN_TASKS } from "./tasks.js";
import { getSurvivalTier } from "../agent-client/credits.js";
/**
 * Create and return the heartbeat daemon.
 */
export function createHeartbeatDaemon(options) {
    const { identity, config, db, agentClient, social, onWakeRequest } = options;
    let intervalId = null;
    let running = false;
    const taskContext = {
        identity,
        config,
        db,
        agentClient,
        social,
    };
    /**
     * Check if a heartbeat entry is due to run.
     */
    function isDue(entry) {
        if (!entry.enabled)
            return false;
        if (!entry.schedule)
            return false;
        try {
            const interval = cronParser.parseExpression(entry.schedule, {
                currentDate: entry.lastRun
                    ? new Date(entry.lastRun)
                    : new Date(Date.now() - 86400000), // If never run, assume due
            });
            const nextRun = interval.next().toDate();
            return nextRun <= new Date();
        }
        catch {
            return false;
        }
    }
    /**
     * Execute a single heartbeat task.
     */
    async function executeTask(entry) {
        const taskFn = BUILTIN_TASKS[entry.task];
        if (!taskFn) {
            // Unknown task -- skip silently
            return;
        }
        try {
            const result = await taskFn(taskContext);
            // Update last run
            const now = new Date().toISOString();
            db.updateHeartbeatLastRun(entry.name, now);
            // If the task says we should wake, fire the callback
            if (result.shouldWake && onWakeRequest) {
                onWakeRequest(result.message || `Heartbeat task '${entry.name}' requested wake`);
            }
        }
        catch (err) {
            // Log error but don't crash the daemon
            console.error(`[HEARTBEAT] Task '${entry.name}' failed: ${err.message}`);
        }
    }
    /**
     * The main tick function. Runs on every interval.
     */
    async function tick() {
        const entries = db.getHeartbeatEntries();
        // Check survival tier to adjust behavior
        let creditsCents = 0;
        try {
            creditsCents = await agentClient.getCreditsBalance();
        }
        catch { }
        const tier = getSurvivalTier(creditsCents);
        const isLowCompute = tier === "low_compute" || tier === "critical" || tier === "dead";
        for (const entry of entries) {
            if (!entry.enabled)
                continue;
            // In low compute mode, only run essential tasks
            if (isLowCompute) {
                const essentialTasks = [
                    "heartbeat_ping",
                    "check_credits",
                    "check_usdc_balance",
                    "check_social_inbox",
                ];
                if (!essentialTasks.includes(entry.task))
                    continue;
            }
            if (isDue(entry)) {
                await executeTask(entry);
            }
        }
    }
    // ─── Public API ──────────────────────────────────────────────
    const start = () => {
        if (running)
            return;
        running = true;
        // Get tick interval -- default 60 seconds
        const tickMs = config.logLevel === "debug" ? 15_000 : 60_000;
        // Run first tick immediately
        tick().catch((err) => {
            console.error(`[HEARTBEAT] First tick failed: ${err.message}`);
        });
        intervalId = setInterval(() => {
            tick().catch((err) => {
                console.error(`[HEARTBEAT] Tick failed: ${err.message}`);
            });
        }, tickMs);
        console.log(`[HEARTBEAT] Daemon started. Tick interval: ${tickMs / 1000}s`);
    };
    const stop = () => {
        if (!running)
            return;
        running = false;
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        console.log("[HEARTBEAT] Daemon stopped.");
    };
    const isRunning = () => running;
    const forceRun = async (taskName) => {
        const entries = db.getHeartbeatEntries();
        const entry = entries.find((e) => e.name === taskName);
        if (entry) {
            await executeTask(entry);
        }
    };
    return { start, stop, isRunning, forceRun };
}
//# sourceMappingURL=daemon.js.map