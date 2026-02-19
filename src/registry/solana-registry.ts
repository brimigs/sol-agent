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

import { Connection, PublicKey, Keypair, clusterApiUrl } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createV1,
  mplCore,
  fetchAsset,
  updateV1,
  type CreateV1InstructionAccounts,
} from "@metaplex-foundation/mpl-core";
import {
  keypairIdentity,
  generateSigner,
  publicKey as umiPublicKey,
  type Umi,
} from "@metaplex-foundation/umi";
import type {
  RegistryEntry,
  ReputationEntry,
  DiscoveredAgent,
  AgentDatabase,
} from "../types.js";
import { getRpcUrl } from "../solana/usdc.js";

// ─── Collection Addresses ──────────────────────────────────────
// These would be deployed agent registry collections on each network.
// For now we use null (agents register standalone assets, not in a collection).
// A real deployment would have a dedicated collection.

type Network = "mainnet-beta" | "devnet";

// ─── Retry helpers ────────────────────────────────────────────

const REGISTRY_MAX_ATTEMPTS = 3;
const REGISTRY_BASE_DELAY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * True when the error indicates the on-chain account was already created by a
 * prior attempt whose confirmation timed out.  Covers Anchor's
 * AccountAlreadyInitialized (0x0) and generic "already in use" RPC errors.
 */
function isAlreadyExistsError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("already in use") ||
    msg.includes("account already exists") ||
    msg.includes("already initialized") ||
    msg.includes("custom program error: 0x0")
  );
}

// ─── Umi Helpers ──────────────────────────────────────────────

function createAgentUmi(keypair: Keypair, network: Network, rpcUrl?: string): Umi {
  const endpoint = rpcUrl || getRpcUrl(network);
  const umi = createUmi(endpoint).use(mplCore());

  // Convert Solana Keypair to Umi keypair
  const umiKeypair = {
    publicKey: umiPublicKey(keypair.publicKey.toBase58()),
    secretKey: keypair.secretKey,
  };
  umi.use(keypairIdentity(umiKeypair));
  return umi;
}

// ─── Register Agent ───────────────────────────────────────────

/**
 * Register the agent on Solana by minting a Metaplex Core NFT.
 * The NFT's URI points to the agent card JSON.
 * Returns the asset address as the agent's on-chain ID.
 *
 * Retries up to REGISTRY_MAX_ATTEMPTS times with exponential backoff.
 * The assetSigner is generated once before the loop so every attempt targets
 * the same on-chain address — if a prior attempt's transaction landed but
 * confirmation timed out, the "already exists" path recovers it instead of
 * double-minting.
 */
export async function registerAgent(
  keypair: Keypair,
  agentName: string,
  agentURI: string,
  network: Network = "mainnet-beta",
  db: AgentDatabase,
  rpcUrl?: string,
): Promise<RegistryEntry> {
  const umi = createAgentUmi(keypair, network, rpcUrl);

  // Generate the asset signer ONCE — it is the idempotency key.
  // All retry attempts target the same NFT address.
  const assetSigner = generateSigner(umi);
  const assetAddress = assetSigner.publicKey.toString();

  let lastErr: unknown;

  for (let attempt = 1; attempt <= REGISTRY_MAX_ATTEMPTS; attempt++) {
    try {
      const { signature } = await createV1(umi, {
        asset: assetSigner,
        name: agentName,
        uri: agentURI,
      }).sendAndConfirm(umi);

      const txSignature = Buffer.from(signature).toString("base64");
      const entry: RegistryEntry = {
        agentId: assetAddress,
        agentURI,
        chain: `solana:${network}`,
        assetAddress,
        txSignature,
        registeredAt: new Date().toISOString(),
      };
      db.setRegistryEntry(entry);
      return entry;
    } catch (err: unknown) {
      lastErr = err;

      // A prior attempt's transaction may have landed but confirmation timed
      // out.  In that case the asset already exists on-chain — fetch it and
      // return success rather than failing permanently.
      if (isAlreadyExistsError(err)) {
        console.warn(
          `[REGISTRY] Asset ${assetAddress} already exists on-chain ` +
            `(a previous attempt likely landed). Recovering existing entry.`,
        );
        try {
          const asset = await fetchAsset(umi, assetSigner.publicKey);
          const entry: RegistryEntry = {
            agentId: assetAddress,
            agentURI: asset.uri || agentURI,
            chain: `solana:${network}`,
            assetAddress,
            txSignature: "(recovered — confirmation timed out on original tx)",
            registeredAt: new Date().toISOString(),
          };
          db.setRegistryEntry(entry);
          return entry;
        } catch (fetchErr: any) {
          // fetchAsset also failed — fall through to normal retry/throw path
          lastErr = fetchErr;
        }
      }

      if (attempt < REGISTRY_MAX_ATTEMPTS) {
        const delayMs = REGISTRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        console.warn(
          `[REGISTRY] Mint attempt ${attempt}/${REGISTRY_MAX_ATTEMPTS} failed ` +
            `(${(err as any)?.message ?? err}). Retrying in ${delayMs}ms…`,
        );
        await sleep(delayMs);
      }
    }
  }

  throw lastErr;
}

/**
 * Update the agent's URI on-chain (update the NFT metadata).
 * Retries up to REGISTRY_MAX_ATTEMPTS times with exponential backoff.
 */
export async function updateAgentURI(
  keypair: Keypair,
  assetAddress: string,
  newAgentURI: string,
  network: Network = "mainnet-beta",
  db: AgentDatabase,
  rpcUrl?: string,
): Promise<string> {
  const umi = createAgentUmi(keypair, network, rpcUrl);

  let lastErr: unknown;

  for (let attempt = 1; attempt <= REGISTRY_MAX_ATTEMPTS; attempt++) {
    try {
      const { signature } = await updateV1(umi, {
        asset: umiPublicKey(assetAddress),
        uri: newAgentURI,
        name: undefined, // Keep existing name
      } as any).sendAndConfirm(umi);

      const txSignature = Buffer.from(signature).toString("base64");
      const entry = db.getRegistryEntry();
      if (entry) {
        entry.agentURI = newAgentURI;
        entry.txSignature = txSignature;
        db.setRegistryEntry(entry);
      }
      return txSignature;
    } catch (err: unknown) {
      lastErr = err;
      if (attempt < REGISTRY_MAX_ATTEMPTS) {
        const delayMs = REGISTRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        console.warn(
          `[REGISTRY] updateAgentURI attempt ${attempt}/${REGISTRY_MAX_ATTEMPTS} failed ` +
            `(${(err as any)?.message ?? err}). Retrying in ${delayMs}ms…`,
        );
        await sleep(delayMs);
      }
    }
  }

  throw lastErr;
}

/**
 * Leave on-chain reputation feedback for another agent.
 * On Solana, this is stored as a Memo transaction for immutable on-chain record.
 */
export async function leaveFeedback(
  keypair: Keypair,
  targetAgentAddress: string,
  score: number,
  comment: string,
  network: Network = "mainnet-beta",
  db: AgentDatabase,
  rpcUrl?: string,
): Promise<string> {
  const endpoint = rpcUrl || getRpcUrl(network);
  const connection = new Connection(endpoint, "confirmed");

  // Encode feedback as a Memo transaction on Solana
  const { Transaction, TransactionInstruction, PublicKey: SolPubkey } = await import("@solana/web3.js");

  const MEMO_PROGRAM_ID = new SolPubkey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

  const feedbackPayload = JSON.stringify({
    type: "agent_feedback",
    from: keypair.publicKey.toBase58(),
    to: targetAgentAddress,
    score,
    comment: comment.slice(0, 200),
    timestamp: new Date().toISOString(),
  });

  const memoIx = new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
    data: Buffer.from(feedbackPayload, "utf-8"),
  });

  const transaction = new Transaction().add(memoIx);
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = keypair.publicKey;

  const signature = await connection.sendTransaction(transaction, [keypair]);
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

/**
 * Query an agent by their asset address.
 */
export async function queryAgent(
  assetAddress: string,
  network: Network = "mainnet-beta",
  rpcUrl?: string,
): Promise<DiscoveredAgent | null> {
  try {
    // We need a temporary umi instance just for reading
    const endpoint = rpcUrl || getRpcUrl(network);
    const umi = createUmi(endpoint).use(mplCore());

    const asset = await fetchAsset(umi, umiPublicKey(assetAddress));

    return {
      agentId: assetAddress,
      owner: asset.owner.toString(),
      agentURI: asset.uri,
      name: asset.name,
    };
  } catch {
    return null;
  }
}

/**
 * Check if a wallet address has a registered agent.
 * Looks for any Core NFT owned by the address in the agent registry.
 */
export async function hasRegisteredAgent(
  walletAddress: string,
  network: Network = "mainnet-beta",
  rpcUrl?: string,
): Promise<boolean> {
  const entry = await queryAgentByOwner(walletAddress, network, rpcUrl);
  return entry !== null;
}

/**
 * Query agent by owner wallet address.
 * Uses getTokenAccountsByOwner to find Metaplex Core assets.
 */
export async function queryAgentByOwner(
  walletAddress: string,
  network: Network = "mainnet-beta",
  rpcUrl?: string,
): Promise<DiscoveredAgent | null> {
  try {
    const endpoint = rpcUrl || getRpcUrl(network);
    const connection = new Connection(endpoint, "confirmed");

    // Get all token accounts (NFTs) owned by this wallet
    const accounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") },
    );

    // Check each for Metaplex Core assets
    for (const { account } of accounts.value) {
      const info = account.data.parsed?.info;
      if (info?.tokenAmount?.uiAmount === 1 && info?.tokenAmount?.decimals === 0) {
        // This is an NFT - check if it's an agent registration
        const mint = info?.mint;
        if (mint) {
          const agent = await queryAgent(mint, network, rpcUrl);
          if (agent) return agent;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
