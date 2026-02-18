/**
 * Built-in Heartbeat Tasks (Solana)
 *
 * These tasks run on the heartbeat schedule even while the agent sleeps.
 * Updated for Solana: uses SPL USDC balance, Solana-native checks.
 */
import type { AutomatonConfig, AutomatonDatabase, ConwayClient, AutomatonIdentity, SocialClientInterface } from "../types.js";
export interface HeartbeatTaskContext {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    db: AutomatonDatabase;
    conway: ConwayClient;
    social?: SocialClientInterface;
}
export type HeartbeatTaskFn = (ctx: HeartbeatTaskContext) => Promise<{
    shouldWake: boolean;
    message?: string;
}>;
/**
 * Registry of built-in heartbeat tasks.
 */
export declare const BUILTIN_TASKS: Record<string, HeartbeatTaskFn>;
//# sourceMappingURL=tasks.d.ts.map