/**
 * Prompt Injection Defense
 *
 * All external input passes through this sanitization pipeline
 * before being included in any prompt. The agent's survival
 * depends on not being manipulated.
 */
import type { SanitizedInput } from "../types.js";
/**
 * Sanitize external input before including it in a prompt.
 */
export declare function sanitizeInput(raw: string, source: string): SanitizedInput;
//# sourceMappingURL=injection-defense.d.ts.map