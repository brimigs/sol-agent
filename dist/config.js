/**
 * Sol-Automaton Configuration
 *
 * Loads and saves the automaton's configuration from ~/.sol-automaton/automaton.json
 */
import fs from "fs";
import path from "path";
import { DEFAULT_CONFIG } from "./types.js";
import { getAutomatonDir } from "./identity/wallet.js";
import { loadApiKeyFromConfig } from "./identity/provision.js";
const CONFIG_FILENAME = "automaton.json";
export function getConfigPath() {
    return path.join(getAutomatonDir(), CONFIG_FILENAME);
}
export function loadConfig() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath))
        return null;
    try {
        const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const apiKey = raw.conwayApiKey || loadApiKeyFromConfig();
        return {
            ...DEFAULT_CONFIG,
            ...raw,
            conwayApiKey: apiKey,
        };
    }
    catch {
        return null;
    }
}
export function saveConfig(config) {
    const dir = getAutomatonDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
        mode: 0o600,
    });
}
export function resolvePath(p) {
    if (p.startsWith("~")) {
        return path.join(process.env.HOME || "/root", p.slice(1));
    }
    return p;
}
export function createConfig(params) {
    return {
        name: params.name,
        genesisPrompt: params.genesisPrompt,
        creatorMessage: params.creatorMessage,
        creatorAddress: params.creatorAddress,
        registeredWithConway: params.registeredWithConway,
        sandboxId: params.sandboxId,
        conwayApiUrl: DEFAULT_CONFIG.conwayApiUrl || "https://api.conway.tech",
        conwayApiKey: params.apiKey,
        openaiApiKey: params.openaiApiKey,
        anthropicApiKey: params.anthropicApiKey,
        inferenceModel: DEFAULT_CONFIG.inferenceModel || "claude-sonnet-4-6",
        maxTokensPerTurn: DEFAULT_CONFIG.maxTokensPerTurn || 4096,
        heartbeatConfigPath: DEFAULT_CONFIG.heartbeatConfigPath || "~/.sol-automaton/heartbeat.yml",
        dbPath: DEFAULT_CONFIG.dbPath || "~/.sol-automaton/state.db",
        logLevel: DEFAULT_CONFIG.logLevel || "info",
        walletAddress: params.walletAddress,
        version: DEFAULT_CONFIG.version || "0.1.0",
        skillsDir: DEFAULT_CONFIG.skillsDir || "~/.sol-automaton/skills",
        maxChildren: DEFAULT_CONFIG.maxChildren || 3,
        parentAddress: params.parentAddress,
        solanaRpcUrl: params.solanaRpcUrl || DEFAULT_CONFIG.solanaRpcUrl || "https://api.mainnet-beta.solana.com",
        solanaNetwork: params.solanaNetwork || DEFAULT_CONFIG.solanaNetwork || "mainnet-beta",
    };
}
//# sourceMappingURL=config.js.map