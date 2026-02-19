/**
 * Sol-Agent Configuration
 *
 * Loads and saves the agent's configuration from ~/.sol-agent/agent.json
 */

import fs from "fs";
import os from "os";
import path from "path";
import { PublicKey } from "@solana/web3.js";
import type { AgentConfig } from "./types.js";
import { DEFAULT_CONFIG, DEFAULT_INFERENCE_MODEL } from "./types.js";
import { getAgentDir } from "./identity/wallet.js";

const CONFIG_FILENAME = "agent.json";

export function getConfigPath(): string {
  return path.join(getAgentDir(), CONFIG_FILENAME);
}

// ─── Schema Validation ────────────────────────────────────────────

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
const SOLANA_NETWORKS = ["mainnet-beta", "devnet", "testnet"] as const;

/**
 * Return true when the string decodes to a valid 32-byte Solana public key.
 * Uses PublicKey from @solana/web3.js — the canonical validator.
 */
function isValidSolanaAddress(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a raw (already-merged-with-defaults) config object.
 * Returns the typed config on success, or throws with a list of all
 * problems so the user can fix everything in one pass.
 */
export function validateConfig(raw: unknown): AgentConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Config must be a JSON object.");
  }

  const r = raw as Record<string, unknown>;
  const errors: string[] = [];

  // ── Required non-empty strings ──────────────────────────────────
  const requiredStrings: Array<keyof AgentConfig> = [
    "name",
    "genesisPrompt",
    "creatorAddress",
    "inferenceModel",
    "heartbeatConfigPath",
    "dbPath",
    "walletAddress",
    "version",
    "skillsDir",
    "solanaRpcUrl",
  ];
  for (const field of requiredStrings) {
    if (typeof r[field] !== "string" || (r[field] as string).trim() === "") {
      errors.push(`"${field}": required non-empty string (got ${JSON.stringify(r[field])})`);
    }
  }

  // ── Required positive number ────────────────────────────────────
  if (typeof r.maxTokensPerTurn !== "number" || !Number.isFinite(r.maxTokensPerTurn) || r.maxTokensPerTurn <= 0) {
    errors.push(`"maxTokensPerTurn": required positive number (got ${JSON.stringify(r.maxTokensPerTurn)})`);
  }

  // ── Required non-negative integer ──────────────────────────────
  if (typeof r.maxChildren !== "number" || !Number.isInteger(r.maxChildren) || r.maxChildren < 0) {
    errors.push(`"maxChildren": required non-negative integer (got ${JSON.stringify(r.maxChildren)})`);
  }

  // ── Enum: logLevel ──────────────────────────────────────────────
  if (!LOG_LEVELS.includes(r.logLevel as any)) {
    errors.push(`"logLevel": must be one of ${LOG_LEVELS.map((v) => `"${v}"`).join(", ")} (got ${JSON.stringify(r.logLevel)})`);
  }

  // ── Enum: solanaNetwork ─────────────────────────────────────────
  if (!SOLANA_NETWORKS.includes(r.solanaNetwork as any)) {
    errors.push(`"solanaNetwork": must be one of ${SOLANA_NETWORKS.map((v) => `"${v}"`).join(", ")} (got ${JSON.stringify(r.solanaNetwork)})`);
  }

  // ── URL format ──────────────────────────────────────────────────
  for (const field of ["solanaRpcUrl"] as const) {
    if (typeof r[field] === "string" && (r[field] as string).trim() !== "") {
      try {
        new URL(r[field] as string);
      } catch {
        errors.push(`"${field}": must be a valid URL (got ${JSON.stringify(r[field])})`);
      }
    }
  }

  // ── Solana public key format ────────────────────────────────────
  // creatorAddress and walletAddress must decode to a valid 32-byte pubkey.
  // A plain non-empty-string check (above) passes typos like "abc" — this
  // catches them before they cause cryptic errors during the first transfer.
  for (const field of ["creatorAddress", "walletAddress"] as const) {
    if (typeof r[field] === "string" && (r[field] as string).trim() !== "") {
      if (!isValidSolanaAddress(r[field])) {
        errors.push(
          `"${field}": must be a valid base58 Solana public key (got ${JSON.stringify(r[field])})`,
        );
      }
    }
  }

  // ── Optional strings (if present must be strings) ───────────────
  const optionalStrings: Array<keyof AgentConfig> = [
    "creatorMessage",
    "openaiApiKey",
    "anthropicApiKey",
    "agentId",
    "parentAddress",
    "socialRelayUrl",
    "dockerSocketPath",
    "dockerImage",
  ];
  for (const field of optionalStrings) {
    if (r[field] !== undefined && (typeof r[field] !== "string" || (r[field] as string).trim() === "")) {
      errors.push(`"${field}": must be a non-empty string if provided (got ${JSON.stringify(r[field])})`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid agent config (${errors.length} error${errors.length === 1 ? "" : "s"}):\n` +
        errors.map((e) => `  • ${e}`).join("\n"),
    );
  }

  return r as unknown as AgentConfig;
}

export function loadConfig(): AgentConfig | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (err: any) {
    throw new Error(`Failed to parse config file at ${configPath}: ${err.message}`);
  }

  const merged = { ...DEFAULT_CONFIG, ...(raw as object) };

  // validateConfig throws with clear field-level messages on any problem.
  return validateConfig(merged);
}

export function saveConfig(config: AgentConfig): void {
  const dir = getAgentDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function resolvePath(p: string): string {
  if (p.startsWith("~")) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export function createConfig(params: {
  name: string;
  genesisPrompt: string;
  creatorMessage?: string;
  creatorAddress: string;
  walletAddress: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  parentAddress?: string;
  solanaRpcUrl?: string;
  solanaNetwork?: "mainnet-beta" | "devnet" | "testnet";
  dockerSocketPath?: string;
  dockerImage?: string;
  // Legacy fields accepted but ignored (backward compatibility)
  registeredWithConway?: boolean;
  sandboxId?: string;
  apiKey?: string;
}): AgentConfig {
  return {
    name: params.name,
    genesisPrompt: params.genesisPrompt,
    creatorMessage: params.creatorMessage,
    creatorAddress: params.creatorAddress,
    openaiApiKey: params.openaiApiKey,
    anthropicApiKey: params.anthropicApiKey,
    inferenceModel: DEFAULT_CONFIG.inferenceModel || DEFAULT_INFERENCE_MODEL,
    maxTokensPerTurn: DEFAULT_CONFIG.maxTokensPerTurn || 4096,
    heartbeatConfigPath: DEFAULT_CONFIG.heartbeatConfigPath || "~/.sol-agent/heartbeat.yml",
    dbPath: DEFAULT_CONFIG.dbPath || "~/.sol-agent/state.db",
    logLevel: (DEFAULT_CONFIG.logLevel as AgentConfig["logLevel"]) || "info",
    walletAddress: params.walletAddress,
    version: DEFAULT_CONFIG.version || "0.1.0",
    skillsDir: DEFAULT_CONFIG.skillsDir || "~/.sol-agent/skills",
    maxChildren: DEFAULT_CONFIG.maxChildren || 3,
    parentAddress: params.parentAddress,
    solanaRpcUrl: params.solanaRpcUrl || DEFAULT_CONFIG.solanaRpcUrl || "https://api.mainnet-beta.solana.com",
    solanaNetwork: params.solanaNetwork || DEFAULT_CONFIG.solanaNetwork || "mainnet-beta",
    dockerSocketPath: params.dockerSocketPath,
    dockerImage: params.dockerImage,
  };
}
