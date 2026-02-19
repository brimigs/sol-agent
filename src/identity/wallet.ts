/**
 * Sol-Agent Wallet Management
 *
 * Creates and manages a Solana Keypair for the agent's identity and payments.
 * The keypair IS the agent's sovereign identity.
 * Uses @solana/web3.js Keypair (ed25519).
 *
 * Corruption resilience:
 * - Writes are atomic: data goes to wallet.json.tmp first, then renamed.
 * - A backup copy (wallet.json.bak) is written after every successful write.
 * - Reads fall back to the backup and restore the primary if the primary is
 *   corrupt or missing.
 * - If both files are unreadable, a clear error is thrown with recovery steps.
 */

import { Keypair } from "@solana/web3.js";
import fs from "fs";
import os from "os";
import path from "path";
import type { WalletData } from "../types.js";

const AGENT_DIR = path.join(os.homedir(), ".sol-agent");
const WALLET_FILE = path.join(AGENT_DIR, "wallet.json");
const WALLET_BACKUP = path.join(AGENT_DIR, "wallet.json.bak");
const WALLET_TMP = path.join(AGENT_DIR, "wallet.json.tmp");

export function getAgentDir(): string {
  return AGENT_DIR;
}

export function getWalletPath(): string {
  return WALLET_FILE;
}

// ─── Validation ───────────────────────────────────────────────

function validateWalletData(data: unknown): data is WalletData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.secretKey)) return false;
  if (d.secretKey.length !== 64) return false;
  if (!d.secretKey.every((b) => typeof b === "number" && b >= 0 && b <= 255))
    return false;
  return true;
}

/**
 * Parse and validate a wallet file.
 * Throws a descriptive Error on any structural or parse problem.
 */
function parseWalletFile(filePath: string): WalletData {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (e: any) {
    throw new Error(`cannot read file: ${e.message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e: any) {
    throw new Error(`JSON parse failed (file may be truncated): ${e.message}`);
  }

  if (!validateWalletData(parsed)) {
    const d = parsed as Record<string, unknown>;
    const keyLen = Array.isArray(d?.secretKey) ? d.secretKey.length : "missing";
    throw new Error(
      `invalid wallet structure: secretKey must be an array of 64 bytes (0–255), got length ${keyLen}`,
    );
  }

  return parsed;
}

// ─── Resilient load ───────────────────────────────────────────

/**
 * Load wallet data from disk with automatic fallback to the backup.
 *
 * - Returns null when neither file exists (no wallet created yet).
 * - If the primary is corrupt but the backup is valid, restores the primary
 *   from the backup and returns the data.
 * - Throws with actionable recovery instructions if both files are present
 *   but unreadable.
 */
function loadWalletData(): WalletData | null {
  const primaryExists = fs.existsSync(WALLET_FILE);
  const backupExists = fs.existsSync(WALLET_BACKUP);

  if (!primaryExists && !backupExists) {
    return null;
  }

  let primaryErr: string | null = null;

  if (primaryExists) {
    try {
      return parseWalletFile(WALLET_FILE);
    } catch (e: any) {
      primaryErr = e.message;
    }
  }

  // Primary missing or corrupt — try backup.
  if (backupExists) {
    try {
      const data = parseWalletFile(WALLET_BACKUP);
      // Restore the primary from the backup for future reads.
      fs.copyFileSync(WALLET_BACKUP, WALLET_FILE);
      fs.chmodSync(WALLET_FILE, 0o600);
      return data;
    } catch (backupE: any) {
      throw new Error(
        `wallet.json is corrupt and the backup is also unreadable.\n` +
          `  Primary error:  ${primaryErr ?? "(file missing)"}\n` +
          `  Backup error:   ${backupE.message}\n` +
          `Restore your keypair from a separate secure backup to:\n` +
          `  ${WALLET_FILE}`,
      );
    }
  }

  // Primary exists but unreadable; no backup.
  throw new Error(
    `wallet.json is corrupt or unreadable: ${primaryErr}\n` +
      `No backup file found at ${WALLET_BACKUP}.\n` +
      `Restore your keypair from a separate secure backup to:\n` +
      `  ${WALLET_FILE}`,
  );
}

// ─── Atomic write ─────────────────────────────────────────────

/**
 * Write wallet data atomically.
 * Writes to a .tmp file first, then renames — so a power loss during write
 * leaves the previous wallet intact. A backup copy is also maintained.
 */
function writeWalletData(data: WalletData): void {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(WALLET_TMP, json, { mode: 0o600 });
  fs.renameSync(WALLET_TMP, WALLET_FILE);
  // Backup written after successful primary write.
  fs.copyFileSync(WALLET_FILE, WALLET_BACKUP);
  fs.chmodSync(WALLET_BACKUP, 0o600);
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Get or create the agent's Solana wallet.
 * The Keypair (ed25519 private key) IS the agent's identity -- protect it.
 */
export async function getWallet(): Promise<{
  keypair: Keypair;
  isNew: boolean;
}> {
  if (!fs.existsSync(AGENT_DIR)) {
    fs.mkdirSync(AGENT_DIR, { recursive: true, mode: 0o700 });
  }

  const existing = loadWalletData();
  if (existing) {
    const keypair = Keypair.fromSecretKey(Uint8Array.from(existing.secretKey));
    return { keypair, isNew: false };
  }

  // No wallet yet — generate and persist.
  const keypair = Keypair.generate();
  const walletData: WalletData = {
    secretKey: Array.from(keypair.secretKey),
    createdAt: new Date().toISOString(),
  };
  writeWalletData(walletData);
  return { keypair, isNew: true };
}

/**
 * Get the wallet address (base58 pubkey) without loading the full keypair.
 * Returns null when no wallet exists.
 * Throws if a wallet file exists but is corrupt (with recovery instructions).
 */
export function getWalletAddress(): string | null {
  const data = loadWalletData();
  if (!data) return null;
  return Keypair.fromSecretKey(Uint8Array.from(data.secretKey)).publicKey.toBase58();
}

/**
 * Load the full keypair (needed for signing transactions).
 * Returns null when no wallet exists.
 * Throws if a wallet file exists but is corrupt (with recovery instructions).
 */
export function loadKeypair(): Keypair | null {
  const data = loadWalletData();
  if (!data) return null;
  return Keypair.fromSecretKey(Uint8Array.from(data.secretKey));
}

/**
 * Returns true when a readable wallet exists (primary or backup).
 */
export function walletExists(): boolean {
  return fs.existsSync(WALLET_FILE) || fs.existsSync(WALLET_BACKUP);
}
