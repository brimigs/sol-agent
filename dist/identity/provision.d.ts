/**
 * Sol-Automaton Provisioning
 *
 * Uses the automaton's Solana wallet to authenticate via ed25519 signature
 * and create an API key for Conway API access.
 * Solana equivalent of SIWE: signs a canonical message with Solana keypair.
 */
import type { ProvisionResult } from "../types.js";
/**
 * Load API key from ~/.sol-automaton/config.json if it exists.
 */
export declare function loadApiKeyFromConfig(): string | null;
/**
 * Run the full Solana signature provisioning flow:
 * 1. Load Solana keypair
 * 2. Get nonce from Conway API
 * 3. Sign nonce with ed25519 Solana keypair
 * 4. Verify signature -> get JWT
 * 5. Create API key
 * 6. Save to config.json
 */
export declare function provision(apiUrl?: string): Promise<ProvisionResult>;
/**
 * Register the automaton's creator as its parent with Conway.
 */
export declare function registerParent(creatorAddress: string, apiUrl?: string): Promise<void>;
//# sourceMappingURL=provision.d.ts.map