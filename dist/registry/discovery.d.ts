/**
 * Solana Agent Discovery
 *
 * Discover other agents via Solana registry queries.
 * Fetches and parses agent cards from Metaplex Core NFT URIs.
 */
import type { DiscoveredAgent, AgentCard } from "../types.js";
type Network = "mainnet-beta" | "devnet";
/**
 * Fetch an agent card from a URI (IPFS or HTTP).
 */
export declare function fetchAgentCard(uri: string): Promise<AgentCard | null>;
/**
 * Look up a specific agent by their Solana asset address.
 */
export declare function discoverAgentByAddress(assetAddress: string, network?: Network, rpcUrl?: string): Promise<DiscoveredAgent | null>;
/**
 * Discover agents by scanning known agent addresses stored in the registry.
 * On Solana, there's no sequential token ID, so we scan the Conway registry API.
 */
export declare function discoverAgents(limit?: number, network?: Network, rpcUrl?: string): Promise<DiscoveredAgent[]>;
/**
 * Search for agents by name or description.
 */
export declare function searchAgents(keyword: string, limit?: number, network?: Network, rpcUrl?: string): Promise<DiscoveredAgent[]>;
export {};
//# sourceMappingURL=discovery.d.ts.map