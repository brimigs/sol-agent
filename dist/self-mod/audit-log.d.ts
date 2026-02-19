/**
 * Audit Log
 *
 * Immutable append-only log of all self-modifications.
 * The creator can see everything the agent changes about itself.
 */
import type { AgentDatabase, ModificationEntry, ModificationType } from "../types.js";
/**
 * Log a self-modification to the audit trail.
 */
export declare function logModification(db: AgentDatabase, type: ModificationType, description: string, options?: {
    filePath?: string;
    diff?: string;
    reversible?: boolean;
}): ModificationEntry;
/**
 * Get recent modifications for display or context.
 */
export declare function getRecentModifications(db: AgentDatabase, limit?: number): ModificationEntry[];
/**
 * Generate a summary of all modifications for the creator.
 */
export declare function generateAuditReport(db: AgentDatabase): string;
//# sourceMappingURL=audit-log.d.ts.map