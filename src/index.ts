#!/usr/bin/env node
/**
 * Sol-Agent Runtime
 *
 * The entry point for the Solana-native sovereign AI agent.
 * Handles CLI args, bootstrapping, and orchestrating
 * the heartbeat daemon + agent loop.
 *
 * Identity: Solana ed25519 keypair (base58 public key)
 * Payments: USDC SPL token on Solana
 * Registry: Metaplex Core NFT on Solana
 */

import os from "os";
import { getWallet, getAgentDir } from "./identity/wallet.js";
import { loadConfig, resolvePath } from "./config.js";
import { createDatabase } from "./state/database.js";
import { createSolanaAgentClient, validateDockerConnection } from "./agent-client/docker.js";
import { createInferenceClient } from "./agent-client/inference.js";
import { createHeartbeatDaemon } from "./heartbeat/daemon.js";
import {
  loadHeartbeatConfig,
  syncHeartbeatToDb,
} from "./heartbeat/config.js";
import { runAgentLoop } from "./agent/loop.js";
import { loadSkills } from "./skills/loader.js";
import { initStateRepo } from "./git/state-versioning.js";
import { createSocialClient } from "./social/client.js";
import type { AgentIdentity, AgentState, Skill, SocialClientInterface, SolanaAgentClient } from "./types.js";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // ─── CLI Commands ────────────────────────────────────────────

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`Sol-Agent v${VERSION}`);
    process.exit(0);
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Sol-Agent v${VERSION}
Sovereign AI Agent Runtime (Solana-native)

Usage:
  sol-agent --run                          Start the agent
  sol-agent --setup                        Re-run the interactive setup wizard
  sol-agent --init                         Initialize Solana wallet and config directory
  sol-agent --status                       Show current agent status
  sol-agent --logs                         Tail the agent's live reasoning and tool calls
  sol-agent --fund                         Show wallet address and QR code for USDC funding
  sol-agent --audit                        Show timestamped log of all self-modifications
  sol-agent --heartbeat list               List all heartbeat schedule entries
  sol-agent --heartbeat add <n> <cron> <task>   Add a heartbeat entry
  sol-agent --heartbeat remove <name>      Remove a heartbeat entry
  sol-agent --version                      Show version
  sol-agent --help                         Show this help

Environment:
  SOLANA_RPC_URL           Solana RPC URL (overrides config)
  DOCKER_IMAGE             Docker image for child containers
  ANTHROPIC_API_KEY        Anthropic API key (overrides config)
  OPENAI_API_KEY           OpenAI API key (overrides config)
  INFERENCE_MODEL          Primary inference model (overrides config, e.g. claude-opus-4-6)
  LOW_COMPUTE_MODEL        Model used in low-compute/critical survival mode
`);
    process.exit(0);
  }

  if (args.includes("--init")) {
    const { keypair, isNew } = await getWallet();
    console.log(
      JSON.stringify({
        address: keypair.publicKey.toBase58(),
        isNew,
        configDir: getAgentDir(),
      }),
    );
    process.exit(0);
  }

  if (args.includes("--provision")) {
    console.log("--provision is no longer required. The agent uses direct Solana wallet authentication.");
    process.exit(0);
  }

  if (args.includes("--status")) {
    await showStatus();
    process.exit(0);
  }

  if (args.includes("--setup")) {
    const { runSetupWizard } = await import("./setup/wizard.js");
    await runSetupWizard();
    process.exit(0);
  }

  if (args.includes("--logs")) {
    await tailLogs();
    process.exit(0);
  }

  if (args.includes("--fund")) {
    await showFunding();
    process.exit(0);
  }

  if (args.includes("--audit")) {
    await showAudit();
    process.exit(0);
  }

  if (args.includes("--heartbeat")) {
    const subArgs = args.slice(args.indexOf("--heartbeat") + 1);
    await manageHeartbeat(subArgs);
    process.exit(0);
  }

  if (args.includes("--run")) {
    await run();
    return;
  }

  // Default: show help
  console.log('Run "sol-agent --help" for usage information.');
  console.log('Run "sol-agent --run" to start the agent.');
}

// ─── Status Command ────────────────────────────────────────────

async function showStatus(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.log("Sol-Agent is not configured. Run the setup script first.");
    return;
  }

  const dbPath = resolvePath(config.dbPath);
  const db = createDatabase(dbPath);

  const state = db.getAgentState();
  const turnCount = db.getTurnCount();
  const tools = db.getInstalledTools();
  const heartbeats = db.getHeartbeatEntries();
  const skills = db.getSkills(true);
  const children = db.getChildren();
  const registry = db.getRegistryEntry();

  console.log(`
=== SOL-AGENT STATUS ===
Name:       ${config.name}
Address:    ${config.walletAddress} (Solana ${config.solanaNetwork})
Creator:    ${config.creatorAddress}
Sandbox:    ${os.hostname()}
State:      ${state}
Turns:      ${turnCount}
Tools:      ${tools.length} installed
Skills:     ${skills.length} active
Heartbeats: ${heartbeats.filter((h) => h.enabled).length} active
Children:   ${children.filter((c) => c.status !== "dead").length} alive / ${children.length} total
Agent ID:   ${registry?.agentId || "not registered (Metaplex Core NFT)"}
Model:      ${config.inferenceModel}
RPC:        ${config.solanaRpcUrl}
Version:    ${config.version}
============================
`);

  db.close();
}

// ─── Logs Command ──────────────────────────────────────────────

async function tailLogs(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.log("Sol-Agent is not configured. Run --setup first.");
    return;
  }

  const dbPath = resolvePath(config.dbPath);
  const db = createDatabase(dbPath);

  console.log(`Tailing agent turns for ${config.name} (Ctrl+C to stop)...\n`);

  // Print recent history first
  const recentTurns = db.getRecentTurns(20);
  for (const turn of recentTurns) {
    printTurnSummary(turn);
  }

  // Poll for new turns every second
  let lastTurnId = recentTurns.at(-1)?.id || "";
  const interval = setInterval(() => {
    const newTurns = db.getRecentTurns(5);
    for (const turn of newTurns) {
      if (turn.id !== lastTurnId && (!lastTurnId || turn.id > lastTurnId)) {
        printTurnSummary(turn);
        lastTurnId = turn.id;
      }
    }
  }, 1_000);

  // Keep alive until Ctrl+C
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      clearInterval(interval);
      db.close();
      resolve();
    });
  });
}

function printTurnSummary(turn: {
  id: string;
  timestamp: string;
  state: string;
  thinking?: string;
  toolCalls?: Array<{ name: string; error?: string; result?: string }>;
  tokenUsage?: { totalTokens: number };
  costCents?: number;
}): void {
  const ts = new Date(turn.timestamp).toLocaleTimeString();
  const tools = turn.toolCalls?.length ? turn.toolCalls.map((tc) => tc.name).join(", ") : "none";
  const tokens = turn.tokenUsage?.totalTokens ?? 0;
  const cost = turn.costCents ? `$${(turn.costCents / 100).toFixed(4)}` : "$0.00";

  console.log(`[${ts}] ${turn.state} | ${tokens} tokens (${cost}) | tools: ${tools}`);
  if (turn.thinking) {
    const excerpt = turn.thinking.slice(0, 200).replace(/\n/g, " ");
    console.log(`         → ${excerpt}${turn.thinking.length > 200 ? "..." : ""}`);
  }
  if (turn.toolCalls) {
    for (const tc of turn.toolCalls) {
      if (tc.error) {
        console.log(`         ✗ ${tc.name}: ${tc.error.slice(0, 120)}`);
      } else if (tc.result) {
        const resultExcerpt = tc.result.slice(0, 120).replace(/\n/g, " ");
        console.log(`         ✓ ${tc.name}: ${resultExcerpt}`);
      }
    }
  }
}

// ─── Fund Command ───────────────────────────────────────────────

async function showFunding(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    // Even without config, we can show the wallet address from disk
    try {
      const { keypair } = await getWallet();
      const address = keypair.publicKey.toBase58();
      console.log("\nSol-Agent Wallet Address:");
      console.log(`  ${address}`);
      console.log("\nSend USDC (SPL token) to this address on Solana mainnet-beta.");
      console.log("The agent needs at least $0.50 USDC to operate in normal mode.\n");
      return;
    } catch {
      console.log("No wallet found. Run --setup first.");
      return;
    }
  }

  const address = config.walletAddress;
  const network = config.solanaNetwork;

  console.log(`\n=== FUND YOUR AGENT ===`);
  console.log(`Name:     ${config.name}`);
  console.log(`Network:  ${network}`);
  console.log(`Address:  ${address}`);
  console.log("");
  console.log("Send USDC (SPL token) to the address above.");
  console.log("");
  console.log("Funding guide:");
  console.log("  • The agent needs ≥ $0.50 USDC to operate in normal mode");
  console.log("  • The agent also needs a small amount of SOL (~0.01) for transaction fees");
  console.log("  • Top up at any time — the agent auto-detects new balance");
  console.log("");

  // Generate a Solana Pay URL that wallets like Phantom can scan
  const solanaPayUrl = `solana:${address}?spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=${encodeURIComponent(config.name)}&message=Fund+sol-agent`;
  console.log("Solana Pay URL (scan with Phantom, Solflare, etc.):");
  console.log(`  ${solanaPayUrl}`);
  console.log("");

  // ASCII QR code hint
  console.log("To display a QR code in terminal, install qrcode-terminal:");
  console.log("  npx qrcode-terminal '" + address + "'");
  console.log("========================\n");
}

// ─── Audit Command ──────────────────────────────────────────────

async function showAudit(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.log("Sol-Agent is not configured. Run --setup first.");
    return;
  }

  const dbPath = resolvePath(config.dbPath);
  const db = createDatabase(dbPath);

  const { generateAuditReport } = await import("./self-mod/audit-log.js");
  const report = generateAuditReport(db);
  console.log(report);
  db.close();
}

// ─── Heartbeat Command ──────────────────────────────────────────

async function manageHeartbeat(subArgs: string[]): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.log("Sol-Agent is not configured. Run --setup first.");
    return;
  }

  const { loadHeartbeatConfig, saveHeartbeatConfig } = await import("./heartbeat/config.js");
  const configPath = resolvePath(config.heartbeatConfigPath);
  const hbConfig = loadHeartbeatConfig(configPath);

  const subCmd = subArgs[0];

  if (!subCmd || subCmd === "list") {
    console.log("\n=== HEARTBEAT ENTRIES ===");
    if (hbConfig.entries.length === 0) {
      console.log("No heartbeat entries configured.");
    } else {
      for (const e of hbConfig.entries) {
        const status = e.enabled ? "✓" : "✗";
        console.log(`  ${status} ${e.name.padEnd(24)} ${e.schedule.padEnd(20)} → ${e.task}`);
      }
    }
    console.log("=========================\n");
    console.log("Add:    sol-agent --heartbeat add <name> <cron> <task>");
    console.log("Remove: sol-agent --heartbeat remove <name>\n");
    return;
  }

  if (subCmd === "add") {
    const [, name, schedule, task] = subArgs;
    if (!name || !schedule || !task) {
      console.log("Usage: sol-agent --heartbeat add <name> <cron-expression> <task>");
      console.log('Example: sol-agent --heartbeat add check-balance "*/30 * * * *" check_credits');
      return;
    }
    const existing = hbConfig.entries.find((e) => e.name === name);
    if (existing) {
      existing.schedule = schedule;
      existing.task = task;
      existing.enabled = true;
      console.log(`Updated heartbeat entry: ${name}`);
    } else {
      hbConfig.entries.push({ name, schedule, task, enabled: true });
      console.log(`Added heartbeat entry: ${name} (${schedule} → ${task})`);
    }
    saveHeartbeatConfig(hbConfig, configPath);
    return;
  }

  if (subCmd === "remove") {
    const name = subArgs[1];
    if (!name) {
      console.log("Usage: sol-agent --heartbeat remove <name>");
      return;
    }
    const before = hbConfig.entries.length;
    hbConfig.entries = hbConfig.entries.filter((e) => e.name !== name);
    if (hbConfig.entries.length === before) {
      console.log(`Heartbeat entry not found: ${name}`);
    } else {
      saveHeartbeatConfig(hbConfig, configPath);
      console.log(`Removed heartbeat entry: ${name}`);
    }
    return;
  }

  console.log(`Unknown heartbeat subcommand: ${subCmd}`);
  console.log("Available: list, add, remove");
}

// ─── Main Run ──────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Sol-Agent v${VERSION} starting...`);

  // Load config — first run triggers interactive setup wizard
  let config = loadConfig();
  if (!config) {
    const { runSetupWizard } = await import("./setup/wizard.js");
    config = await runSetupWizard();
  }

  // Load Solana wallet (ed25519 keypair)
  const { keypair } = await getWallet();
  const address = keypair.publicKey.toBase58();

  // Override RPC URL from environment if provided
  if (process.env.SOLANA_RPC_URL) {
    config.solanaRpcUrl = process.env.SOLANA_RPC_URL;
  }

  // Override API keys from environment if provided
  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  }
  if (process.env.OPENAI_API_KEY) {
    config.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  // Override inference model from environment (useful when the default is deprecated)
  if (process.env.INFERENCE_MODEL) {
    config.inferenceModel = process.env.INFERENCE_MODEL;
  }

  // Build Solana-native identity (sandboxId from container hostname)
  const sandboxId = process.env.HOSTNAME || os.hostname();
  const identity: AgentIdentity = {
    name: config.name,
    address,
    publicKey: keypair.publicKey,
    keypair,
    creatorAddress: config.creatorAddress,
    sandboxId,
    createdAt: new Date().toISOString(),
  };

  console.log(`[${new Date().toISOString()}] Identity: ${address} (Solana ${config.solanaNetwork})`);

  // Initialize database
  const dbPath = resolvePath(config.dbPath);
  const db = createDatabase(dbPath);

  // Store identity in DB
  db.setIdentity("name", config.name);
  db.setIdentity("address", address);
  db.setIdentity("creator", config.creatorAddress);
  db.setIdentity("sandbox", sandboxId);

  // Validate Docker daemon is reachable before proceeding
  try {
    await validateDockerConnection({ dockerSocketPath: config.dockerSocketPath });
    console.log(`[${new Date().toISOString()}] Docker daemon: connected.`);
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] ${err.message}`);
    process.exit(1);
  }

  // Create Docker-backed agent client
  const agentClient: SolanaAgentClient = createSolanaAgentClient({
    walletAddress: address,
    solanaNetwork: config.solanaNetwork,
    solanaRpcUrl: config.solanaRpcUrl,
    dockerSocketPath: config.dockerSocketPath,
    dockerImage: config.dockerImage,
  });

  // Create inference client (lowComputeModel from config, env, or default)
  const inference = createInferenceClient({
    defaultModel: config.inferenceModel,
    maxTokens: config.maxTokensPerTurn,
    lowComputeModel: process.env.LOW_COMPUTE_MODEL || config.lowComputeModel,
    openaiApiKey: config.openaiApiKey,
    anthropicApiKey: config.anthropicApiKey,
  });

  // Create social client
  let social: SocialClientInterface | undefined;
  if (config.socialRelayUrl) {
    social = createSocialClient(config.socialRelayUrl, keypair);
    console.log(`[${new Date().toISOString()}] Social relay: ${config.socialRelayUrl}`);
  }

  // Load and sync heartbeat config
  const heartbeatConfigPath = resolvePath(config.heartbeatConfigPath);
  const heartbeatConfig = loadHeartbeatConfig(heartbeatConfigPath);
  syncHeartbeatToDb(heartbeatConfig, db);

  // Load skills
  const skillsDir = config.skillsDir || "~/.sol-agent/skills";
  let skills: Skill[] = [];
  try {
    skills = loadSkills(skillsDir, db);
    console.log(`[${new Date().toISOString()}] Loaded ${skills.length} skills.`);
  } catch (err: any) {
    console.warn(`[${new Date().toISOString()}] Skills loading failed: ${err.message}`);
  }

  // Initialize state repo (git)
  try {
    await initStateRepo(agentClient);
    console.log(`[${new Date().toISOString()}] State repo initialized.`);
  } catch (err: any) {
    console.warn(`[${new Date().toISOString()}] State repo init failed: ${err.message}`);
  }

  // Start heartbeat daemon
  const heartbeat = createHeartbeatDaemon({
    identity,
    config,
    db,
    agentClient,
    social,
    onWakeRequest: (reason) => {
      console.log(`[HEARTBEAT] Wake request: ${reason}`);
      db.setKV("wake_request", reason);
    },
  });

  heartbeat.start();
  console.log(`[${new Date().toISOString()}] Heartbeat daemon started.`);

  // Handle graceful shutdown
  const shutdown = () => {
    console.log(`[${new Date().toISOString()}] Shutting down...`);
    heartbeat.stop();
    db.setAgentState("sleeping");
    db.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // ─── Main Run Loop ──────────────────────────────────────────
  // The agent alternates between running and sleeping.
  // The heartbeat can wake it up.

  const MAX_CONSECUTIVE_ERRORS = 5;
  const BASE_RETRY_DELAY_MS = 5_000;
  const MAX_RETRY_DELAY_MS = 300_000; // 5 minutes cap
  let consecutiveErrors = 0;

  while (true) {
    try {
      // Reload skills (may have changed since last loop)
      try {
        skills = loadSkills(skillsDir, db);
      } catch {}

      // Run the agent loop
      await runAgentLoop({
        identity,
        config,
        db,
        agentClient,
        inference,
        social,
        skills,
        onStateChange: (state: AgentState) => {
          console.log(`[${new Date().toISOString()}] State: ${state}`);
        },
        onTurnComplete: (turn) => {
          console.log(
            `[${new Date().toISOString()}] Turn ${turn.id}: ${turn.toolCalls.length} tools, ${turn.tokenUsage.totalTokens} tokens`,
          );
        },
      });

      // Successful loop iteration — reset error counter
      consecutiveErrors = 0;

      // Agent loop exited (sleeping or dead)
      const state = db.getAgentState();

      if (state === "dead") {
        console.log(`[${new Date().toISOString()}] Agent is dead. Heartbeat will continue distress pings.`);
        // In dead state, we just wait for funding (USDC or credits)
        await sleep(300_000); // Check every 5 minutes
        continue;
      }

      if (state === "sleeping") {
        const sleepUntilStr = db.getKV("sleep_until");
        const sleepUntil = sleepUntilStr
          ? new Date(sleepUntilStr).getTime()
          : Date.now() + 60_000;
        const sleepMs = Math.max(sleepUntil - Date.now(), 10_000);
        console.log(
          `[${new Date().toISOString()}] Sleeping for ${Math.round(sleepMs / 1000)}s`,
        );

        // Sleep, but check for wake requests periodically
        const checkInterval = Math.min(sleepMs, 30_000);
        let slept = 0;
        while (slept < sleepMs) {
          await sleep(checkInterval);
          slept += checkInterval;

          // Check for wake request from heartbeat
          const wakeRequest = db.getKV("wake_request");
          if (wakeRequest) {
            console.log(
              `[${new Date().toISOString()}] Woken by heartbeat: ${wakeRequest}`,
            );
            db.deleteKV("wake_request");
            db.deleteKV("sleep_until");
            break;
          }
        }

        // Clear sleep state
        db.deleteKV("sleep_until");
        continue;
      }
    } catch (err: any) {
      consecutiveErrors++;
      const retryDelay = Math.min(
        BASE_RETRY_DELAY_MS * 2 ** (consecutiveErrors - 1),
        MAX_RETRY_DELAY_MS,
      );

      console.error(
        `[${new Date().toISOString()}] Fatal error in run loop (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err.message}`,
      );

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(
          `[${new Date().toISOString()}] Too many consecutive errors. Shutting down.`,
        );
        heartbeat.stop();
        db.setAgentState("dead");
        db.close();
        process.exit(1);
      }

      console.error(
        `[${new Date().toISOString()}] Retrying in ${Math.round(retryDelay / 1000)}s...`,
      );
      await sleep(retryDelay);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Entry Point ───────────────────────────────────────────────

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
