/**
 * Solana USDC Operations
 *
 * USDC on Solana via SPL Token program.
 * Replaces the Base/EVM x402 USDC module.
 *
 * USDC Mint Addresses:
 * - Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
 * - Devnet:  Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
 */
import { PublicKey, Keypair } from "@solana/web3.js";
import type { UsdcBalanceResult, SolanaPaymentResult } from "../types.js";
export declare const USDC_MINTS: Record<string, PublicKey>;
export declare const USDC_DECIMALS = 6;
/**
 * Get the RPC URL for a Solana network.
 */
export declare function getRpcUrl(network: string, customRpcUrl?: string): string;
/**
 * Get the USDC balance for a wallet on Solana.
 */
export declare function getUsdcBalance(walletAddress: string, network?: string, rpcUrl?: string): Promise<number>;
/**
 * Get the USDC balance with detailed status info.
 */
export declare function getUsdcBalanceDetailed(walletAddress: string, network?: string, rpcUrl?: string): Promise<UsdcBalanceResult>;
/**
 * Get the SOL balance for a wallet.
 */
export declare function getSolBalance(walletAddress: string, network?: string, rpcUrl?: string): Promise<number>;
/**
 * Transfer USDC on Solana (SPL token transfer).
 * This is the Solana equivalent of the EVM x402 USDC transfer.
 */
export declare function transferUsdc(fromKeypair: Keypair, toAddress: string, amountUsdc: number, network?: string, rpcUrl?: string): Promise<SolanaPaymentResult>;
/**
 * Transfer SOL (native token).
 */
export declare function transferSol(fromKeypair: Keypair, toAddress: string, amountSol: number, network?: string, rpcUrl?: string): Promise<SolanaPaymentResult>;
//# sourceMappingURL=usdc.d.ts.map