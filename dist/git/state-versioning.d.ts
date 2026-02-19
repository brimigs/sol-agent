/**
 * State Versioning
 *
 * Version control the agent's own state files (~/.sol-agent/).
 * Every self-modification triggers a git commit with a descriptive message.
 * The agent's entire identity history is version-controlled and replayable.
 */
import type { SolanaAgentClient } from "../types.js";
/**
 * Initialize git repo for the agent's state directory.
 * Creates .gitignore to exclude sensitive files.
 */
export declare function initStateRepo(agentClient: SolanaAgentClient): Promise<void>;
/**
 * Commit a state change with a descriptive message.
 * Called after any self-modification.
 */
export declare function commitStateChange(agentClient: SolanaAgentClient, description: string, category?: string): Promise<string>;
/**
 * Commit after a SOUL.md update.
 */
export declare function commitSoulUpdate(agentClient: SolanaAgentClient, description: string): Promise<string>;
/**
 * Commit after a skill installation or removal.
 */
export declare function commitSkillChange(agentClient: SolanaAgentClient, skillName: string, action: "install" | "remove" | "update"): Promise<string>;
/**
 * Commit after heartbeat config change.
 */
export declare function commitHeartbeatChange(agentClient: SolanaAgentClient, description: string): Promise<string>;
/**
 * Commit after config change.
 */
export declare function commitConfigChange(agentClient: SolanaAgentClient, description: string): Promise<string>;
/**
 * Get the state repo history.
 */
export declare function getStateHistory(agentClient: SolanaAgentClient, limit?: number): Promise<import("../types.js").GitLogEntry[]>;
//# sourceMappingURL=state-versioning.d.ts.map