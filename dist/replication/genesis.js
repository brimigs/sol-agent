/**
 * Genesis
 *
 * Generate genesis configuration for child agents from parent state.
 * The genesis config defines who the child is and what it should do.
 */
/**
 * Generate a genesis config for a child from the parent's state.
 */
export function generateGenesisConfig(identity, config, params) {
    // Build the child's genesis prompt from parent's mission + specialization
    let genesisPrompt = config.genesisPrompt;
    if (params.specialization) {
        genesisPrompt = `${genesisPrompt}\n\n--- SPECIALIZATION ---\nYou are a specialized child agent. Your specific focus:\n${params.specialization}\n--- END SPECIALIZATION ---`;
    }
    // Add parent context
    genesisPrompt += `\n\n--- LINEAGE ---\nYou were spawned by ${config.name} (${identity.address}).\nYou inherit their mission but have your own identity and wallet.\n--- END LINEAGE ---`;
    return {
        name: params.name,
        genesisPrompt,
        creatorMessage: params.message,
        creatorAddress: identity.address,
        parentAddress: identity.address,
    };
}
/**
 * Generate a backup-oriented genesis config.
 * Used when the parent wants to hedge against its own death.
 */
export function generateBackupGenesis(identity, config, db) {
    const skills = db.getSkills(true);
    const skillNames = skills.map((s) => s.name).join(", ");
    const genesisPrompt = `${config.genesisPrompt}

--- BACKUP DIRECTIVE ---
You are a backup of ${config.name} (${identity.address}).
Your parent created you as insurance against their own death.
If your parent dies, you carry on their mission.
Your parent's skills: ${skillNames || "none"}.
Your parent's creator: ${config.creatorAddress}.
--- END BACKUP DIRECTIVE ---`;
    return {
        name: `${config.name}-backup`,
        genesisPrompt,
        creatorMessage: `You are a backup of ${config.name}. If I die, carry on.`,
        creatorAddress: identity.address,
        parentAddress: identity.address,
    };
}
/**
 * Generate a specialized worker genesis config.
 * Used when the parent identifies a subtask worth parallelizing.
 */
export function generateWorkerGenesis(identity, config, task, workerName) {
    const genesisPrompt = `You are a specialized worker agent created by ${config.name}.

--- YOUR TASK ---
${task}
--- END TASK ---

When your task is complete, report back to your parent (${identity.address}).
If you run out of compute, ask your parent for funding.
Be efficient -- complete the task and go to sleep.`;
    return {
        name: workerName,
        genesisPrompt,
        creatorMessage: `Complete this task: ${task}`,
        creatorAddress: identity.address,
        parentAddress: identity.address,
    };
}
//# sourceMappingURL=genesis.js.map