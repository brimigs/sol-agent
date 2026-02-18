/**
 * Spawn (Solana)
 *
 * Spawn child automatons in new Conway sandboxes.
 * The parent creates a new sandbox, installs the runtime,
 * writes a genesis config, funds the child, and starts it.
 * The child generates its own Solana ed25519 keypair on first run.
 */
import type { ConwayClient, AutomatonIdentity, AutomatonDatabase, ChildAutomaton, GenesisConfig } from "../types.js";
/**
 * Spawn a child automaton in a new Conway sandbox.
 */
export declare function spawnChild(conway: ConwayClient, identity: AutomatonIdentity, db: AutomatonDatabase, genesis: GenesisConfig): Promise<ChildAutomaton>;
/**
 * Start a child automaton after setup.
 */
export declare function startChild(conway: ConwayClient, db: AutomatonDatabase, childId: string): Promise<void>;
/**
 * Check a child's status.
 */
export declare function checkChildStatus(conway: ConwayClient, db: AutomatonDatabase, childId: string): Promise<string>;
/**
 * Send a message to a child automaton.
 */
export declare function messageChild(conway: ConwayClient, db: AutomatonDatabase, childId: string, message: string): Promise<void>;
//# sourceMappingURL=spawn.d.ts.map