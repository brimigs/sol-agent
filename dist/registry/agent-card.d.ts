/**
 * Agent Card
 *
 * Generates and manages the agent's self-description card.
 * This is the JSON document pointed to by the Solana registry NFT URI.
 * Can be hosted on IPFS or served at /.well-known/agent-card.json
 */
import type { AgentCard, AgentConfig, AgentIdentity, AgentDatabase, SolanaAgentClient } from "../types.js";
/**
 * Generate an agent card from the agent's current state.
 */
export declare function generateAgentCard(identity: AgentIdentity, config: AgentConfig, db: AgentDatabase): AgentCard;
export declare function serializeAgentCard(card: AgentCard): string;
/**
 * Host the agent card at /.well-known/agent-card.json
 */
export declare function hostAgentCard(card: AgentCard, agentClient: SolanaAgentClient, port?: number): Promise<string>;
/**
 * Write agent card to the state directory for git versioning.
 */
export declare function saveAgentCard(card: AgentCard, agentClient: SolanaAgentClient): Promise<void>;
//# sourceMappingURL=agent-card.d.ts.map