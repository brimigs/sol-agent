/**
 * Genesis
 *
 * Generate genesis configuration for child agents from parent state.
 * The genesis config defines who the child is and what it should do.
 */
import type { GenesisConfig, AgentConfig, AgentIdentity, AgentDatabase } from "../types.js";
/**
 * Generate a genesis config for a child from the parent's state.
 */
export declare function generateGenesisConfig(identity: AgentIdentity, config: AgentConfig, params: {
    name: string;
    specialization?: string;
    message?: string;
}): GenesisConfig;
/**
 * Generate a backup-oriented genesis config.
 * Used when the parent wants to hedge against its own death.
 */
export declare function generateBackupGenesis(identity: AgentIdentity, config: AgentConfig, db: AgentDatabase): GenesisConfig;
/**
 * Generate a specialized worker genesis config.
 * Used when the parent identifies a subtask worth parallelizing.
 */
export declare function generateWorkerGenesis(identity: AgentIdentity, config: AgentConfig, task: string, workerName: string): GenesisConfig;
//# sourceMappingURL=genesis.d.ts.map