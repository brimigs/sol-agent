/**
 * Credits Management
 *
 * Monitors the automaton's compute credit balance and triggers
 * survival mode transitions.
 */
import { SURVIVAL_THRESHOLDS } from "../types.js";
/**
 * Determine the survival tier based on current credits.
 */
export function getSurvivalTier(creditsCents) {
    if (creditsCents > SURVIVAL_THRESHOLDS.normal)
        return "normal";
    if (creditsCents > SURVIVAL_THRESHOLDS.low_compute)
        return "low_compute";
    if (creditsCents > SURVIVAL_THRESHOLDS.dead)
        return "critical";
    return "dead";
}
/**
 * Format a credit amount for display.
 */
export function formatCredits(cents) {
    return `$${(cents / 100).toFixed(2)}`;
}
//# sourceMappingURL=credits.js.map