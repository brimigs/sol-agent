/**
 * Agent Card
 *
 * Generates and manages the agent's self-description card.
 * This is the JSON document pointed to by the Solana registry NFT URI.
 * Can be hosted on IPFS or served at /.well-known/agent-card.json
 */
import type { AgentCard, AutomatonConfig, AutomatonIdentity, AutomatonDatabase, ConwayClient } from "../types.js";
/**
 * Generate an agent card from the automaton's current state.
 */
export declare function generateAgentCard(identity: AutomatonIdentity, config: AutomatonConfig, db: AutomatonDatabase): AgentCard;
export declare function serializeAgentCard(card: AgentCard): string;
/**
 * Host the agent card at /.well-known/agent-card.json
 */
export declare function hostAgentCard(card: AgentCard, conway: ConwayClient, port?: number): Promise<string>;
/**
 * Write agent card to the state directory for git versioning.
 */
export declare function saveAgentCard(card: AgentCard, conway: ConwayClient): Promise<void>;
//# sourceMappingURL=agent-card.d.ts.map