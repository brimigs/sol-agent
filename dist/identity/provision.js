/**
 * Sol-Agent Identity Helpers
 *
 * Lightweight helpers for reading/writing identity config.
 * Authentication is handled directly via Solana ed25519 keypair —
 * no external API provisioning required.
 */
import fs from "fs";
import path from "path";
import { getAgentDir } from "./wallet.js";
/**
 * Load API key from ~/.sol-agent/config.json if it exists.
 * Kept for backward compatibility with configs that stored an apiKey field.
 */
export function loadApiKeyFromConfig() {
    const configPath = path.join(getAgentDir(), "config.json");
    if (!fs.existsSync(configPath))
        return null;
    try {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        return config.apiKey || null;
    }
    catch {
        return null;
    }
}
/**
 * Stub provision function — no external API required.
 * The agent authenticates via its Solana keypair directly.
 */
export async function provision() {
    const { getWallet } = await import("./wallet.js");
    const { keypair } = await getWallet();
    const address = keypair.publicKey.toBase58();
    return {
        apiKey: "",
        walletAddress: address,
        keyPrefix: "",
    };
}
/**
 * Register parent — no-op without external registry.
 */
export async function registerParent(_creatorAddress) {
    // No external registry required; lineage is tracked in local SQLite DB.
}
//# sourceMappingURL=provision.js.map