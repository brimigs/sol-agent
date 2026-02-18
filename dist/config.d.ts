/**
 * Sol-Automaton Configuration
 *
 * Loads and saves the automaton's configuration from ~/.sol-automaton/automaton.json
 */
import type { AutomatonConfig } from "./types.js";
export declare function getConfigPath(): string;
export declare function loadConfig(): AutomatonConfig | null;
export declare function saveConfig(config: AutomatonConfig): void;
export declare function resolvePath(p: string): string;
export declare function createConfig(params: {
    name: string;
    genesisPrompt: string;
    creatorMessage?: string;
    creatorAddress: string;
    registeredWithConway: boolean;
    sandboxId: string;
    walletAddress: string;
    apiKey: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    parentAddress?: string;
    solanaRpcUrl?: string;
    solanaNetwork?: "mainnet-beta" | "devnet" | "testnet";
}): AutomatonConfig;
//# sourceMappingURL=config.d.ts.map