/**
 * Heartbeat Daemon
 *
 * Runs periodic tasks on cron schedules inside the same Node.js process.
 * The heartbeat runs even when the agent is sleeping.
 * It IS the agent's pulse. When it stops, the agent is dead.
 */
import type { AgentConfig, AgentDatabase, SolanaAgentClient, AgentIdentity, SocialClientInterface } from "../types.js";
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
export declare function createHeartbeatDaemon(options: HeartbeatDaemonOptions): HeartbeatDaemon;
//# sourceMappingURL=daemon.d.ts.map