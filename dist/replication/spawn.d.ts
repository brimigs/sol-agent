/**
 * Spawn (Solana)
 *
 * Spawn child agents in new Docker containers.
 * The parent creates a new container, installs the runtime,
 * writes a genesis config, funds the child, and starts it.
 * The child generates its own Solana ed25519 keypair on first run.
 */
import type { SolanaAgentClient, AgentIdentity, AgentDatabase, ChildAgent, GenesisConfig } from "../types.js";
/**
 * Spawn a child agent in a new Docker container.
 */
export declare function spawnChild(agentClient: SolanaAgentClient, identity: AgentIdentity, db: AgentDatabase, genesis: GenesisConfig): Promise<ChildAgent>;
/**
 * Start a child agent after setup.
 */
export declare function startChild(agentClient: SolanaAgentClient, db: AgentDatabase, childId: string): Promise<void>;
/**
 * Check a child's status.
 */
export declare function checkChildStatus(agentClient: SolanaAgentClient, db: AgentDatabase, childId: string): Promise<string>;
/**
 * Send a message to a child agent.
 */
export declare function messageChild(agentClient: SolanaAgentClient, db: AgentDatabase, childId: string, message: string): Promise<void>;
//# sourceMappingURL=spawn.d.ts.map