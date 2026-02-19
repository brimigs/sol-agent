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
import { createSolanaAgentClient } from "./agent-client/docker.js";
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
  sol-agent --run          Start the agent (first run triggers setup wizard)
  sol-agent --setup        Re-run the interactive setup wizard
  sol-agent --init         Initialize Solana wallet and config directory
  sol-agent --status       Show current agent status
  sol-agent --version      Show version
  sol-agent --help         Show this help

Environment:
  SOLANA_RPC_URL           Solana RPC URL (overrides config)
  DOCKER_IMAGE             Docker image for child containers
  ANTHROPIC_API_KEY        Anthropic API key (overrides config)
  OPENAI_API_KEY           OpenAI API key (overrides config)
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

  // Build Solana-native identity (sandboxId from container hostname)
  const sandboxId = process.env.HOSTNAME || os.hostname();
  const identity: AgentIdentity = {
    name: config.name,
    address,
    publicKey: keypair.publicKey,
    keypair,
    creatorAddress: config.creatorAddress,
    sandboxId,
    apiKey: "",
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

  // Create Docker-backed agent client
  const agentClient: SolanaAgentClient = createSolanaAgentClient({
    walletAddress: address,
    solanaNetwork: config.solanaNetwork,
    solanaRpcUrl: config.solanaRpcUrl,
    dockerSocketPath: config.dockerSocketPath,
    dockerImage: config.dockerImage,
  });

  // Create inference client
  const inference = createInferenceClient({
    defaultModel: config.inferenceModel,
    maxTokens: config.maxTokensPerTurn,
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
      console.error(
        `[${new Date().toISOString()}] Fatal error in run loop: ${err.message}`,
      );
      // Wait before retrying
      await sleep(30_000);
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
