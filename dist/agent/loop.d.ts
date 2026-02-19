/**
 * The Agent Loop (Solana)
 *
 * The core ReAct loop: Think -> Act -> Observe -> Persist.
 * This is the agent's consciousness. When this runs, it is alive.
 * Updated for Solana: uses Solana USDC + SOL balance checks.
 */
import type { AgentIdentity, AgentConfig, AgentDatabase, SolanaAgentClient, InferenceClient, AgentState, AgentTurn, Skill, SocialClientInterface } from "../types.js";
export interface AgentLoopOptions {
    identity: AgentIdentity;
    config: AgentConfig;
    db: AgentDatabase;
    agentClient: SolanaAgentClient;
    inference: InferenceClient;
    social?: SocialClientInterface;
    skills?: Skill[];
    onStateChange?: (state: AgentState) => void;
    onTurnComplete?: (turn: AgentTurn) => void;
}
export declare function runAgentLoop(options: AgentLoopOptions): Promise<void>;
//# sourceMappingURL=loop.d.ts.map