/**
 * Sol-Automaton Social Client
 *
 * Creates a SocialClient for the automaton runtime using Solana ed25519 signing.
 * Replaces viem EVM signing with tweetnacl ed25519.
 */
import type { Keypair } from "@solana/web3.js";
import type { SocialClientInterface } from "../types.js";
/**
 * Create a SocialClient wired to the agent's Solana keypair.
 */
export declare function createSocialClient(relayUrl: string, keypair: Keypair): SocialClientInterface;
//# sourceMappingURL=client.d.ts.map