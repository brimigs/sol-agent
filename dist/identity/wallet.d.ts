/**
 * Sol-Automaton Wallet Management
 *
 * Creates and manages a Solana Keypair for the automaton's identity and payments.
 * The keypair IS the automaton's sovereign identity.
 * Uses @solana/web3.js Keypair (ed25519).
 */
import { Keypair } from "@solana/web3.js";
export declare function getAutomatonDir(): string;
export declare function getWalletPath(): string;
/**
 * Get or create the automaton's Solana wallet.
 * The Keypair (ed25519 private key) IS the automaton's identity -- protect it.
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