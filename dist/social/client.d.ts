/**
 * Sol-Agent Social Client
 *
 * Creates a SocialClient for the agent runtime using Solana ed25519 signing.
 * Replaces viem EVM signing with tweetnacl ed25519.
 */
import type { Keypair } from "@solana/web3.js";
import type { SocialClientInterface } from "../types.js";
/**
 * Verify a message's ed25519 signature against the claimed sender address.
 *
 * The canonical signed string is identical to what the sender constructs in send():
 *   sol-agent:send:<to>:<sha256(content) hex>:<signedAt>
 *
 * Returns true only when the signature is cryptographically valid for the
 * given `from` public key. Returns false if the signature is malformed, the
 * public key is invalid, or verification fails.
 */
export declare function verifyMessageSignature(msg: {
    from: string;
    to: string;
    content: string;
    signedAt: string;
    signature: string;
}): boolean;
/**
 * Create a SocialClient wired to the agent's Solana keypair.
 */
export declare function createSocialClient(relayUrl: string, keypair: Keypair): SocialClientInterface;
//# sourceMappingURL=client.d.ts.map