/**
 * Sol-Agent Configuration
 *
 * Loads and saves the agent's configuration from ~/.sol-agent/agent.json
 */
import type { AgentConfig } from "./types.js";
export declare function getConfigPath(): string;
/**
 * Validate a raw (already-merged-with-defaults) config object.
 * Returns the typed config on success, or throws with a list of all
 * problems so the user can fix everything in one pass.
 */
export declare function validateConfig(raw: unknown): AgentConfig;
export declare function loadConfig(): AgentConfig | null;
export declare function saveConfig(config: AgentConfig): void;
export declare function resolvePath(p: string): string;
export declare function createConfig(params: {
    name: string;
    genesisPrompt: string;
    creatorMessage?: string;
    creatorAddress: string;
    walletAddress: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    parentAddress?: string;
    solanaRpcUrl?: string;
    solanaNetwork?: "mainnet-beta" | "devnet" | "testnet";
    dockerSocketPath?: string;
    dockerImage?: string;
    registeredWithConway?: boolean;
    sandboxId?: string;
    apiKey?: string;
}): AgentConfig;
//# sourceMappingURL=config.d.ts.map