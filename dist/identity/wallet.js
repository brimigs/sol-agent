/**
 * Sol-Agent Wallet Management
 *
 * Creates and manages a Solana Keypair for the agent's identity and payments.
 * The keypair IS the agent's sovereign identity.
 * Uses @solana/web3.js Keypair (ed25519).
 */
import { Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";
const AGENT_DIR = path.join(process.env.HOME || "/root", ".sol-agent");
const WALLET_FILE = path.join(AGENT_DIR, "wallet.json");
export function getAgentDir() {
    return AGENT_DIR;
}
export function getWalletPath() {
    return WALLET_FILE;
}
/**
 * Get or create the agent's Solana wallet.
 * The Keypair (ed25519 private key) IS the agent's identity -- protect it.
 */
export async function getWallet() {
    if (!fs.existsSync(AGENT_DIR)) {
        fs.mkdirSync(AGENT_DIR, { recursive: true, mode: 0o700 });
    }
    if (fs.existsSync(WALLET_FILE)) {
        const walletData = JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"));
        const keypair = Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));
        return { keypair, isNew: false };
    }
    else {
        const keypair = Keypair.generate();
        const walletData = {
            secretKey: Array.from(keypair.secretKey),
            createdAt: new Date().toISOString(),
        };
        fs.writeFileSync(WALLET_FILE, JSON.stringify(walletData, null, 2), {
            mode: 0o600,
        });
        return { keypair, isNew: true };
    }
}
/**
 * Get the wallet address (base58 pubkey) without loading the full keypair.
 */
export function getWalletAddress() {
    if (!fs.existsSync(WALLET_FILE)) {
        return null;
    }
    const walletData = JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));
    return keypair.publicKey.toBase58();
}
/**
 * Load the full keypair (needed for signing).
 */
export function loadKeypair() {
    if (!fs.existsSync(WALLET_FILE)) {
        return null;
    }
    const walletData = JSON.parse(fs.readFileSync(WALLET_FILE, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));
}
export function walletExists() {
    return fs.existsSync(WALLET_FILE);
}
//# sourceMappingURL=wallet.js.map