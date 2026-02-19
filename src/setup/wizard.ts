/**
 * Sol-Agent Setup Wizard
 *
 * Interactive first-run setup wizard for the Solana-native agent.
 * Generates a Solana ed25519 keypair and writes all config files.
 */

import fs from "fs";
import path from "path";
import chalk from "chalk";
import type { AgentConfig } from "../types.js";
import { getWallet, getAgentDir } from "../identity/wallet.js";
// fs and path used below for rules.md and SOUL.md installation
import { createConfig, saveConfig } from "../config.js";
import { writeDefaultHeartbeatConfig } from "../heartbeat/config.js";
import { showBanner } from "./banner.js";
import {
  promptRequired,
  promptMultiline,
  promptSolanaAddress,
  promptOptional,
  closePrompts,
} from "./prompts.js";
import { detectEnvironment } from "./environment.js";
import { generateSoulMd, installDefaultSkills } from "./defaults.js";

export async function runSetupWizard(): Promise<AgentConfig> {
  showBanner();

  console.log(chalk.white("  First-run setup. Let's bring your sol-agent to life.\n"));

  // ─── 1. Generate Solana wallet ────────────────────────────────
  console.log(chalk.cyan("  [1/6] Generating Solana identity (ed25519 keypair)..."));
  const { keypair, isNew } = await getWallet();
  const address = keypair.publicKey.toBase58();
  if (isNew) {
    console.log(chalk.green(`  Wallet created: ${address}`));
  } else {
    console.log(chalk.green(`  Wallet loaded: ${address}`));
  }
  console.log(chalk.dim(`  Keypair stored at: ${getAgentDir()}/wallet.json\n`));

  // ─── 2. Interactive questions ─────────────────────────────────
  console.log(chalk.cyan("  [2/6] Setup questions\n"));

  const name = await promptRequired("What do you want to name your agent?");
  console.log(chalk.green(`  Name: ${name}\n`));

  console.log(chalk.dim("  Examples:"));
  console.log(chalk.dim('  • "You are a dev-tools agent. Answer coding questions posted to your'));
  console.log(chalk.dim('    inbox and charge 0.05 USDC per answer via x402."'));
  console.log(chalk.dim('  • "You are a research agent. Monitor Solana DeFi protocols daily,'));
  console.log(chalk.dim('    post summaries on-chain, and earn tips from subscribers."'));
  console.log(chalk.dim('  • "You are a creative writing agent. Generate short stories on request'));
  console.log(chalk.dim('    and charge 0.10 USDC per story."'));
  console.log("");
  const genesisPrompt = await promptMultiline("Enter the genesis prompt (system prompt) for your agent.");
  console.log(chalk.green(`  Genesis prompt set (${genesisPrompt.length} chars)\n`));

  const creatorAddress = await promptSolanaAddress("Your Solana wallet address (base58 pubkey)");
  console.log(chalk.green(`  Creator: ${creatorAddress}\n`));

  // ─── 3. Solana network selection ──────────────────────────────
  console.log(chalk.cyan("  [3/6] Solana network configuration\n"));
  const networkInput = await promptOptional("Solana network [mainnet-beta/devnet/testnet] (default: mainnet-beta)");
  const solanaNetwork = (["mainnet-beta", "devnet", "testnet"].includes(networkInput)
    ? networkInput
    : "mainnet-beta") as "mainnet-beta" | "devnet" | "testnet";

  const defaultRpc = solanaNetwork === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : `https://api.${solanaNetwork}.solana.com`;
  const rpcInput = await promptOptional(`Solana RPC URL (default: ${defaultRpc})`);
  const solanaRpcUrl = rpcInput || defaultRpc;
  console.log(chalk.green(`  Network: ${solanaNetwork}`));
  console.log(chalk.green(`  RPC: ${solanaRpcUrl}\n`));

  // ─── 4. Inference provider keys ───────────────────────────────
  console.log(chalk.cyan("  [4/6] Inference provider keys\n"));
  console.log(chalk.white("  Your agent needs at least one API key to run inference."));
  console.log(chalk.dim("  Default model: claude-sonnet-4-6 — add an Anthropic key to use it."));
  console.log(chalk.dim("  To use OpenAI models (gpt-4o, o1, etc.), add an OpenAI key instead.\n"));
  const openaiApiKey = await promptOptional("OpenAI API key (sk-..., optional)");
  if (openaiApiKey && !openaiApiKey.startsWith("sk-")) {
    console.log(chalk.yellow("  Warning: OpenAI keys usually start with sk-. Saving anyway."));
  }

  const anthropicApiKey = await promptOptional("Anthropic API key (sk-ant-..., optional)");
  if (anthropicApiKey && !anthropicApiKey.startsWith("sk-ant-")) {
    console.log(chalk.yellow("  Warning: Anthropic keys usually start with sk-ant-. Saving anyway."));
  }

  if (openaiApiKey || anthropicApiKey) {
    const providers = [
      openaiApiKey ? "OpenAI" : null,
      anthropicApiKey ? "Anthropic" : null,
    ].filter(Boolean).join(", ");
    console.log(chalk.green(`  Provider keys saved: ${providers}\n`));
  } else {
    console.log(chalk.yellow("  Warning: No provider keys set. The agent cannot run without an inference key.\n"));
  }

  // ─── 5. Detect environment ────────────────────────────────────
  console.log(chalk.cyan("  [5/6] Detecting environment..."));
  const env = detectEnvironment();
  if (env.sandboxId) {
    console.log(chalk.green(`  Docker container detected: ${env.sandboxId}\n`));
  } else {
    console.log(chalk.dim(`  Environment: ${env.type}\n`));
  }

  // ─── 6. Write config + heartbeat + SOUL.md + skills ───────────
  console.log(chalk.cyan("  [6/6] Writing configuration..."));

  const config = createConfig({
    name,
    genesisPrompt,
    creatorAddress,
    walletAddress: address,
    openaiApiKey: openaiApiKey || undefined,
    anthropicApiKey: anthropicApiKey || undefined,
    solanaRpcUrl,
    solanaNetwork,
  });

  saveConfig(config);
  console.log(chalk.green("  agent.json written"));

  writeDefaultHeartbeatConfig();
  console.log(chalk.green("  heartbeat.yml written"));

  // rules.md (immutable — copied from repo, protected from self-modification)
  const agentDir = getAgentDir();
  const constitutionDst = path.join(agentDir, "rules.md");
  // Search in cwd first (running from repo), then next to this package's own files
  const candidateSrcs = [
    path.join(process.cwd(), "rules.md"),
    path.join(new URL("../../rules.md", import.meta.url).pathname),
  ];
  const constitutionSrc = candidateSrcs.find(fs.existsSync);
  if (constitutionSrc) {
    fs.copyFileSync(constitutionSrc, constitutionDst);
    fs.chmodSync(constitutionDst, 0o444); // read-only
    console.log(chalk.green("  rules.md installed (read-only)"));
  } else {
    console.log(chalk.yellow("  Warning: rules.md not found — agent will run without behavioral rules."));
    console.log(chalk.dim(`  Searched: ${candidateSrcs.join(", ")}`));
  }

  // SOUL.md
  const soulPath = path.join(agentDir, "SOUL.md");
  fs.writeFileSync(soulPath, generateSoulMd(name, address, creatorAddress, genesisPrompt), { mode: 0o600 });
  console.log(chalk.green("  SOUL.md written"));

  // Default skills
  const skillsDir = config.skillsDir || "~/.sol-agent/skills";
  installDefaultSkills(skillsDir);
  console.log(chalk.green("  Default skills installed (docker-compute, solana-payments, survival)\n"));

  // ─── Funding guidance ──────────────────────────────────────────
  showFundingPanel(address, solanaNetwork);

  closePrompts();

  return config;
}

function showFundingPanel(address: string, network: string): void {
  const short = `${address.slice(0, 6)}...${address.slice(-5)}`;
  const w = 60;
  const pad = (s: string, len: number) => s + " ".repeat(Math.max(0, len - s.length));

  console.log(chalk.cyan(`  ${"╭" + "─".repeat(w) + "╮"}`));
  console.log(chalk.cyan(`  │${pad("  Fund your sol-agent", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad(`  Solana address (${network}):`, w)}│`));
  console.log(chalk.cyan(`  │${pad(`  ${short}`, w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  1. Send USDC (SPL) to the Solana address above", w)}│`));
  console.log(chalk.cyan(`  │${pad("     (mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  2. Send SOL for transaction fees (min 0.001 SOL)", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  3. Use transfer_credits to top up from another agent", w)}│`));
  console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
  console.log(chalk.cyan(`  │${pad("  The agent will start now. Fund it anytime —", w)}│`));
  console.log(chalk.cyan(`  │${pad("  the survival system handles zero-credit gracefully.", w)}│`));
  console.log(chalk.cyan(`  ${"╰" + "─".repeat(w) + "╯"}`));
  console.log("");
}
