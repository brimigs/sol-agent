/**
 * Lineage Tracking
 *
 * Track parent-child relationships between automatons.
 * The parent records children in SQLite.
 * Children record their parent in config.
 * ERC-8004 registration includes parentAgent field.
 */
import type { AutomatonDatabase, ChildAutomaton, AutomatonConfig, ConwayClient } from "../types.js";
/**
 * Get the full lineage tree (parent -> children).
 */
export declare function getLineage(db: AutomatonDatabase): {
    children: ChildAutomaton[];
    alive: number;
    dead: number;
    total: number;
};
/**
 * Check if this automaton has a parent (is itself a child).
 */
export declare function hasParent(config: AutomatonConfig): boolean;
/**
 * Get a summary of the lineage for the system prompt.
 */
export declare function getLineageSummary(db: AutomatonDatabase, config: AutomatonConfig): string;
/**
 * Prune dead children from tracking (optional cleanup).
 */
export declare function pruneDeadChildren(db: AutomatonDatabase, keepLast?: number): number;
/**
 * Refresh status of all children.
 */
export declare function refreshChildrenStatus(conway: ConwayClient, db: AutomatonDatabase): Promise<void>;
//# sourceMappingURL=lineage.d.ts.map