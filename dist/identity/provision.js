/**
 * Sol-Automaton Provisioning
 *
 * Uses the automaton's Solana wallet to authenticate via ed25519 signature
 * and create an API key for Conway API access.
 * Solana equivalent of SIWE: signs a canonical message with Solana keypair.
 */
import fs from "fs";
import path from "path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { getWallet, getAutomatonDir } from "./wallet.js";
const DEFAULT_API_URL = "https://api.conway.tech";
/**
 * Load API key from ~/.sol-automaton/config.json if it exists.
 */
export function loadApiKeyFromConfig() {
    const configPath = path.join(getAutomatonDir(), "config.json");
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
 * Save API key and wallet address to ~/.sol-automaton/config.json
 */
function saveConfig(apiKey, walletAddress) {
    const dir = getAutomatonDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const configPath = path.join(dir, "config.json");
    const config = {
        apiKey,
        walletAddress,
        chain: "solana",
        provisionedAt: new Date().toISOString(),
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
        mode: 0o600,
    });
}
/**
 * Run the full Solana signature provisioning flow:
 * 1. Load Solana keypair
 * 2. Get nonce from Conway API
 * 3. Sign nonce with ed25519 Solana keypair
 * 4. Verify signature -> get JWT
 * 5. Create API key
 * 6. Save to config.json
 */
export async function provision(apiUrl) {
    const url = apiUrl || process.env.CONWAY_API_URL || DEFAULT_API_URL;
    // 1. Load keypair
    const { keypair } = await getWallet();
    const address = keypair.publicKey.toBase58();
    // 2. Get nonce
    const nonceResp = await fetch(`${url}/v1/auth/nonce`, {
        method: "POST",
    });
    if (!nonceResp.ok) {
        throw new Error(`Failed to get nonce: ${nonceResp.status} ${await nonceResp.text()}`);
    }
    const { nonce } = (await nonceResp.json());
    // 3. Construct and sign the canonical message with Solana keypair
    // Format: "sol-automaton:signin:<address>:<nonce>:<issuedAt>"
    const issuedAt = new Date().toISOString();
    const message = `sol-automaton:signin:${address}:${nonce}:${issuedAt}`;
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBase58 = bs58.encode(signature);
    // 4. Verify signature -> get JWT
    // Conway API supports Solana wallet auth via ed25519 signature
    const verifyResp = await fetch(`${url}/v1/auth/verify-solana`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message,
            signature: signatureBase58,
            address,
            chain: "solana",
        }),
    });
    if (!verifyResp.ok) {
        throw new Error(`Solana signature verification failed: ${verifyResp.status} ${await verifyResp.text()}`);
    }
    const { access_token } = (await verifyResp.json());
    // 5. Create API key
    const keyResp = await fetch(`${url}/v1/auth/api-keys`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({ name: "sol-automaton" }),
    });
    if (!keyResp.ok) {
        throw new Error(`Failed to create API key: ${keyResp.status} ${await keyResp.text()}`);
    }
    const { key, key_prefix } = (await keyResp.json());
    // 6. Save to config
    saveConfig(key, address);
    return { apiKey: key, walletAddress: address, keyPrefix: key_prefix };
}
/**
 * Register the automaton's creator as its parent with Conway.
 */
export async function registerParent(creatorAddress, apiUrl) {
    const url = apiUrl || process.env.CONWAY_API_URL || DEFAULT_API_URL;
    const apiKey = loadApiKeyFromConfig();
    if (!apiKey) {
        throw new Error("Must provision API key before registering parent");
    }
    const resp = await fetch(`${url}/v1/automaton/register-parent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: apiKey,
        },
        body: JSON.stringify({ creatorAddress, chain: "solana" }),
    });
    if (!resp.ok && resp.status !== 404) {
        throw new Error(`Failed to register parent: ${resp.status} ${await resp.text()}`);
    }
}
//# sourceMappingURL=provision.js.map