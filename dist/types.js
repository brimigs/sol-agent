/**
 * Sol-Agent Type Definitions
 *
 * All shared interfaces for the Solana sovereign AI agent runtime.
 * Solana-native: PublicKey addresses, Keypair accounts, SPL tokens.
 */
export const DEFAULT_CONFIG = {
    inferenceModel: "claude-sonnet-4-6",
    maxTokensPerTurn: 4096,
    heartbeatConfigPath: "~/.sol-agent/heartbeat.yml",
    dbPath: "~/.sol-agent/state.db",
    logLevel: "info",
    version: "0.1.0",
    skillsDir: "~/.sol-agent/skills",
    maxChildren: 3,
    socialRelayUrl: "https://social.sol-agent.xyz",
    solanaRpcUrl: "https://api.mainnet-beta.solana.com",
    solanaNetwork: "mainnet-beta",
};
export const SURVIVAL_THRESHOLDS = {
    normal: 50, // > $0.50 in credits cents
    low_compute: 10, // $0.10 - $0.50
    critical: 10, // < $0.10
    dead: 0,
};
export const MAX_CHILDREN = 3;
//# sourceMappingURL=types.js.map