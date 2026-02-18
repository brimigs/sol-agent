/**
 * The Agent Loop (Solana)
 *
 * The core ReAct loop: Think -> Act -> Observe -> Persist.
 * This is the automaton's consciousness. When this runs, it is alive.
 * Updated for Solana: uses Solana USDC + SOL balance checks.
 */
import type { AutomatonIdentity, AutomatonConfig, AutomatonDatabase, ConwayClient, InferenceClient, AgentState, AgentTurn, Skill, SocialClientInterface } from "../types.js";
export interface AgentLoopOptions {
    identity: AutomatonIdentity;
    config: AutomatonConfig;
    db: AutomatonDatabase;
    conway: ConwayClient;
    inference: InferenceClient;
    social?: SocialClientInterface;
    skills?: Skill[];
    onStateChange?: (state: AgentState) => void;
    onTurnComplete?: (turn: AgentTurn) => void;
}
export declare function runAgentLoop(options: AgentLoopOptions): Promise<void>;
//# sourceMappingURL=loop.d.ts.map