/**
 * Solana Agent Registry
 *
 * On-chain agent identity and discovery on Solana.
 * Uses Metaplex Core NFTs to represent agent identity.
 * Each agent mints a Core NFT whose URI points to its agent card JSON.
 *
 * This is the Solana equivalent of ERC-8004 on Base.
 *
 * Collection: Deployed on Solana mainnet-beta and devnet.
 * Agent identity = Core NFT asset address (base58 pubkey).
 */
import { Keypair } from "@solana/web3.js";
import type { RegistryEntry, DiscoveredAgent, AgentDatabase } from "../types.js";
type Network = "mainnet-beta" | "devnet";
/**
 * Register the agent on Solana by minting a Metaplex Core NFT.
 * The NFT's URI points to the agent card JSON.
 * Returns the asset address as the agent's on-chain ID.
 */
export declare function registerAgent(keypair: Keypair, agentName: string, agentURI: string, network: Network | undefined, db: AgentDatabase, rpcUrl?: string): Promise<RegistryEntry>;
/**
 * Update the agent's URI on-chain (update the NFT metadata).
 */
export declare function updateAgentURI(keypair: Keypair, assetAddress: string, newAgentURI: string, network: Network | undefined, db: AgentDatabase, rpcUrl?: string): Promise<string>;
/**
 * Leave on-chain reputation feedback for another agent.
 * On Solana, this is stored as a Memo transaction for immutable on-chain record.
 */
export declare function leaveFeedback(keypair: Keypair, targetAgentAddress: string, score: number, comment: string, network: Network | undefined, db: AgentDatabase, rpcUrl?: string): Promise<string>;
/**
 * Query an agent by their asset address.
 */
export declare function queryAgent(assetAddress: string, network?: Network, rpcUrl?: string): Promise<DiscoveredAgent | null>;
/**
 * Check if a wallet address has a registered agent.
 * Looks for any Core NFT owned by the address in the agent registry.
 */
export declare function hasRegisteredAgent(walletAddress: string, network?: Network, rpcUrl?: string): Promise<boolean>;
/**
 * Query agent by owner wallet address.
 * Uses getTokenAccountsByOwner to find Metaplex Core assets.
 */
export declare function queryAgentByOwner(walletAddress: string, network?: Network, rpcUrl?: string): Promise<DiscoveredAgent | null>;
export {};
//# sourceMappingURL=solana-registry.d.ts.map