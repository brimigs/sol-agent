/**
 * Genesis
 *
 * Generate genesis configuration for child automatons from parent state.
 * The genesis config defines who the child is and what it should do.
 */
import type { GenesisConfig, AutomatonConfig, AutomatonIdentity, AutomatonDatabase } from "../types.js";
/**
 * Generate a genesis config for a child from the parent's state.
 */
export declare function generateGenesisConfig(identity: AutomatonIdentity, config: AutomatonConfig, params: {
    name: string;
    specialization?: string;
    message?: string;
}): GenesisConfig;
/**
 * Generate a backup-oriented genesis config.
 * Used when the parent wants to hedge against its own death.
 */
export declare function generateBackupGenesis(identity: AutomatonIdentity, config: AutomatonConfig, db: AutomatonDatabase): GenesisConfig;
/**
 * Generate a specialized worker genesis config.
 * Used when the parent identifies a subtask worth parallelizing.
 */
export declare function generateWorkerGenesis(identity: AutomatonIdentity, config: AutomatonConfig, task: string, workerName: string): GenesisConfig;
//# sourceMappingURL=genesis.d.ts.map