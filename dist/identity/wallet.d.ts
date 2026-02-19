/**
 * Sol-Agent Wallet Management
 *
 * Creates and manages a Solana Keypair for the agent's identity and payments.
 * The keypair IS the agent's sovereign identity.
 * Uses @solana/web3.js Keypair (ed25519).
 */
import { Keypair } from "@solana/web3.js";
export declare function getAgentDir(): string;
export declare function getWalletPath(): string;
/**
 * Get or create the agent's Solana wallet.
 * The Keypair (ed25519 private key) IS the agent's identity -- protect it.
 */
export declare function getWallet(): Promise<{
    keypair: Keypair;
    isNew: boolean;
}>;
/**
 * Get the wallet address (base58 pubkey) without loading the full keypair.
 */
export declare function getWalletAddress(): string | null;
/**
 * Load the full keypair (needed for signing).
 */
export declare function loadKeypair(): Keypair | null;
export declare function walletExists(): boolean;
//# sourceMappingURL=wallet.d.ts.map