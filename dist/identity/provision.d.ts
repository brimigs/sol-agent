/**
 * Sol-Agent Identity Helpers
 *
 * Lightweight helpers for reading/writing identity config.
 * Authentication is handled directly via Solana ed25519 keypair —
 * no external API provisioning required.
 */
import type { ProvisionResult } from "../types.js";
/**
 * Load API key from ~/.sol-agent/config.json if it exists.
 * Kept for backward compatibility with configs that stored an apiKey field.
 */
export declare function loadApiKeyFromConfig(): string | null;
/**
 * Stub provision function — no external API required.
 * The agent authenticates via its Solana keypair directly.
 */
export declare function provision(): Promise<ProvisionResult>;
/**
 * Register parent — no-op without external registry.
 */
export declare function registerParent(_creatorAddress: string): Promise<void>;
//# sourceMappingURL=provision.d.ts.map