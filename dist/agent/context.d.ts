/**
 * Context Window Management
 *
 * Manages the conversation history for the agent loop.
 * Handles summarization to keep within token limits.
 */
import type { ChatMessage, AgentTurn, InferenceClient } from "../types.js";
/**
 * Build the message array for the next inference call.
 * Includes system prompt + recent conversation history.
 */
export declare function buildContextMessages(systemPrompt: string, recentTurns: AgentTurn[], pendingInput?: {
    content: string;
    source: string;
}): ChatMessage[];
/**
 * Trim context to fit within limits.
 * Keeps the system prompt and most recent turns.
 */
export declare function trimContext(turns: AgentTurn[], maxTurns?: number): AgentTurn[];
/**
 * Summarize old turns into a compact context entry.
 * Used when context grows too large.
 */
export declare function summarizeTurns(turns: AgentTurn[], inference: InferenceClient): Promise<string>;
//# sourceMappingURL=context.d.ts.map