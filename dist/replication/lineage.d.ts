/**
 * Lineage Tracking
 *
 * Track parent-child relationships between agents.
 * The parent records children in SQLite.
 * Children record their parent in config.
 * ERC-8004 registration includes parentAgent field.
 */
import type { AgentDatabase, ChildAgent, AgentConfig, SolanaAgentClient } from "../types.js";
/**
 * Get the full lineage tree (parent -> children).
 */
export declare function getLineage(db: AgentDatabase): {
    children: ChildAgent[];
    alive: number;
    dead: number;
    total: number;
};
/**
 * Check if this agent has a parent (is itself a child).
 */
export declare function hasParent(config: AgentConfig): boolean;
/**
 * Get a summary of the lineage for the system prompt.
 */
export declare function getLineageSummary(db: AgentDatabase, config: AgentConfig): string;
/**
 * Prune dead children from tracking (optional cleanup).
 */
export declare function pruneDeadChildren(db: AgentDatabase, keepLast?: number): number;
/**
 * Refresh status of all children.
 */
export declare function refreshChildrenStatus(agentClient: SolanaAgentClient, db: AgentDatabase): Promise<void>;
//# sourceMappingURL=lineage.d.ts.map