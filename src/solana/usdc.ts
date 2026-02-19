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

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { UsdcBalanceResult, SolanaPaymentResult } from "../types.js";

// ─── USDC Mint Addresses ──────────────────────────────────────

export const USDC_MINTS: Record<string, PublicKey> = {
  "mainnet-beta": new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  devnet: new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"),
  testnet: new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"),
};

export const USDC_DECIMALS = 6;

/**
 * Get the RPC URL for a Solana network.
 */
export function getRpcUrl(network: string, customRpcUrl?: string): string {
  if (customRpcUrl) return customRpcUrl;
  switch (network) {
    case "mainnet-beta":
      return "https://api.mainnet-beta.solana.com";
    case "devnet":
      return "https://api.devnet.solana.com";
    case "testnet":
      return "https://api.testnet.solana.com";
    default:
      return "https://api.mainnet-beta.solana.com";
  }
}

/**
 * Get the USDC balance for a wallet on Solana.
 */
export async function getUsdcBalance(
  walletAddress: string,
  network: string = "mainnet-beta",
  rpcUrl?: string,
): Promise<number> {
  const result = await getUsdcBalanceDetailed(walletAddress, network, rpcUrl);
  return result.balance;
}

/**
 * Get the USDC balance with detailed status info.
 */
export async function getUsdcBalanceDetailed(
  walletAddress: string,
  network: string = "mainnet-beta",
  rpcUrl?: string,
): Promise<UsdcBalanceResult> {
  const usdcMint = USDC_MINTS[network];
  if (!usdcMint) {
    return {
      balance: 0,
      network,
      ok: false,
      error: `Unsupported USDC network: ${network}`,
    };
  }

  try {
    const connection = new Connection(getRpcUrl(network, rpcUrl), "confirmed");
    const walletPubkey = new PublicKey(walletAddress);

    // Derive the associated token account (ATA) address — no network call.
    const tokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      walletPubkey,
    );

    // Check existence via getAccountInfo, which returns null for any missing
    // account on every conforming Solana RPC provider. This avoids matching
    // provider-specific error message strings from getTokenAccountBalance.
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (accountInfo === null) {
      // ATA has not been created yet; wallet holds 0 USDC.
      return { balance: 0, network, ok: true };
    }

    const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
    const balance = tokenBalance.value.uiAmount ?? 0;

    return { balance, network, ok: true };
  } catch (err: any) {
    return {
      balance: 0,
      network,
      ok: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Get the SOL balance for a wallet.
 */
export async function getSolBalance(
  walletAddress: string,
  network: string = "mainnet-beta",
  rpcUrl?: string,
): Promise<number> {
  try {
    const connection = new Connection(getRpcUrl(network, rpcUrl), "confirmed");
    const walletPubkey = new PublicKey(walletAddress);
    const lamports = await connection.getBalance(walletPubkey);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

/**
 * Transfer USDC on Solana (SPL token transfer).
 * This is the Solana equivalent of the EVM x402 USDC transfer.
 */
export async function transferUsdc(
  fromKeypair: Keypair,
  toAddress: string,
  amountUsdc: number,
  network: string = "mainnet-beta",
  rpcUrl?: string,
): Promise<SolanaPaymentResult> {
  const usdcMint = USDC_MINTS[network];
  if (!usdcMint) {
    return { success: false, error: `Unsupported network: ${network}` };
  }

  try {
    const connection = new Connection(getRpcUrl(network, rpcUrl), "confirmed");
    const toPubkey = new PublicKey(toAddress);
    const amountLamports = Math.floor(amountUsdc * 10 ** USDC_DECIMALS);

    // Get or create source ATA
    const fromAta = await getOrCreateAssociatedTokenAccount(
      connection,
      fromKeypair,
      usdcMint,
      fromKeypair.publicKey,
    );

    // Get or create destination ATA
    const toAta = await getOrCreateAssociatedTokenAccount(
      connection,
      fromKeypair,
      usdcMint,
      toPubkey,
    );

    // Build transfer instruction
    const transferIx = createTransferInstruction(
      fromAta.address,
      toAta.address,
      fromKeypair.publicKey,
      amountLamports,
    );

    const transaction = new Transaction().add(transferIx);
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKeypair.publicKey;

    const signature = await connection.sendTransaction(transaction, [fromKeypair]);
    await connection.confirmTransaction(signature, "confirmed");

    return { success: true, signature };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Transfer SOL (native token).
 */
export async function transferSol(
  fromKeypair: Keypair,
  toAddress: string,
  amountSol: number,
  network: string = "mainnet-beta",
  rpcUrl?: string,
): Promise<SolanaPaymentResult> {
  try {
    const connection = new Connection(getRpcUrl(network, rpcUrl), "confirmed");
    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey,
        lamports,
      }),
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromKeypair.publicKey;

    const signature = await connection.sendTransaction(transaction, [fromKeypair]);
    await connection.confirmTransaction(signature, "confirmed");

    return { success: true, signature };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
