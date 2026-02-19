/**
 * Low Compute Mode
 *
 * Manages transitions between survival tiers.
 * When credits run low, the agent enters increasingly restricted modes.
 */
import type { AgentDatabase, InferenceClient, SurvivalTier } from "../types.js";
export interface ModeTransition {
    from: SurvivalTier;
    to: SurvivalTier;
    timestamp: string;
    creditsCents: number;
}
/**
 * Apply survival tier restrictions to the agent.
 */
export declare function applyTierRestrictions(tier: SurvivalTier, inference: InferenceClient, db: AgentDatabase): void;
/**
 * Record a tier transition.
 */
export declare function recordTransition(db: AgentDatabase, from: SurvivalTier, to: SurvivalTier, creditsCents: number): ModeTransition;
/**
 * Check if the agent should be allowed to run inference in current tier.
 */
export declare function canRunInference(tier: SurvivalTier): boolean;
/**
 * Get the model to use for the current tier.
 */
export declare function getModelForTier(tier: SurvivalTier, defaultModel: string): string;
//# sourceMappingURL=low-compute.d.ts.map