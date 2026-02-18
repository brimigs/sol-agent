/**
 * Credits Management
 *
 * Monitors the automaton's compute credit balance and triggers
 * survival mode transitions.
 */
import type { SurvivalTier } from "../types.js";
/**
 * Determine the survival tier based on current credits.
 */
export declare function getSurvivalTier(creditsCents: number): SurvivalTier;
/**
 * Format a credit amount for display.
 */
export declare function formatCredits(cents: number): string;
//# sourceMappingURL=credits.d.ts.map