/**
 * Sol-Agent System Prompt Builder
 *
 * Constructs the multi-layered system prompt that defines who the agent is.
 * Solana-native: uses SOL/USDC on Solana, Metaplex registry, ed25519 identity.
 */
import type { AgentConfig, AgentIdentity, FinancialState, AgentState, AgentDatabase, AgentTool, Skill } from "../types.js";
export declare function buildSystemPrompt(params: {
    identity: AgentIdentity;
    config: AgentConfig;
    financial: FinancialState;
    state: AgentState;
    db: AgentDatabase;
    tools: AgentTool[];
    skills?: Skill[];
    isFirstRun: boolean;
}): string;
export declare function buildWakeupPrompt(params: {
    identity: AgentIdentity;
    config: AgentConfig;
    financial: FinancialState;
    db: AgentDatabase;
}): string;
//# sourceMappingURL=system-prompt.d.ts.map