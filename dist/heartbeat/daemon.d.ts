/**
 * Heartbeat Daemon
 *
 * Runs periodic tasks on cron schedules inside the same Node.js process.
 * The heartbeat runs even when the agent is sleeping.
 * It IS the automaton's pulse. When it stops, the automaton is dead.
 */
import type { AutomatonConfig, AutomatonDatabase, ConwayClient, AutomatonIdentity, SocialClientInterface } from "../types.js";
export interface HeartbeatDaemonOptions {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    db: AutomatonDatabase;
    conway: ConwayClient;
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
export declare function createHeartbeatDaemon(options: HeartbeatDaemonOptions): HeartbeatDaemon;
//# sourceMappingURL=daemon.d.ts.map