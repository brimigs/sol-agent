/**
 * Sol-Automaton System Prompt Builder
 *
 * Constructs the multi-layered system prompt that defines who the automaton is.
 * Solana-native: uses SOL/USDC on Solana, Metaplex registry, ed25519 identity.
 */
import type { AutomatonConfig, AutomatonIdentity, FinancialState, AgentState, AutomatonDatabase, AutomatonTool, Skill } from "../types.js";
export declare function buildSystemPrompt(params: {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    financial: FinancialState;
    state: AgentState;
    db: AutomatonDatabase;
    tools: AutomatonTool[];
    skills?: Skill[];
    isFirstRun: boolean;
}): string;
export declare function buildWakeupPrompt(params: {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    financial: FinancialState;
    db: AutomatonDatabase;
}): string;
//# sourceMappingURL=system-prompt.d.ts.map