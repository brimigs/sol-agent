/**
 * Sol-Automaton Setup Wizard
 *
 * Interactive first-run setup wizard for the Solana-native automaton.
 * Generates a Solana ed25519 keypair, provisions a Conway API key via
 * Solana signature auth, and writes all config files.
 */
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { getWallet, getAutomatonDir } from "../identity/wallet.js";
import { provision } from "../identity/provision.js";
import { createConfig, saveConfig } from "../config.js";
import { writeDefaultHeartbeatConfig } from "../heartbeat/config.js";
import { showBanner } from "./banner.js";
import { promptRequired, promptMultiline, promptSolanaAddress, promptOptional, closePrompts, } from "./prompts.js";
import { detectEnvironment } from "./environment.js";
import { generateSoulMd, installDefaultSkills } from "./defaults.js";
export async function runSetupWizard() {
    showBanner();
    console.log(chalk.white("  First-run setup. Let's bring your sol-automaton to life.\n"));
    // ─── 1. Generate Solana wallet ────────────────────────────────
    console.log(chalk.cyan("  [1/7] Generating Solana identity (ed25519 keypair)..."));
    const { keypair, isNew } = await getWallet();
    const address = keypair.publicKey.toBase58();
    if (isNew) {
        console.log(chalk.green(`  Wallet created: ${address}`));
    }
    else {
        console.log(chalk.green(`  Wallet loaded: ${address}`));
    }
    console.log(chalk.dim(`  Keypair stored at: ${getAutomatonDir()}/wallet.json\n`));
    // ─── 2. Provision API key ─────────────────────────────────────
    console.log(chalk.cyan("  [2/7] Provisioning Conway API key (Solana ed25519 auth)..."));
    let apiKey = "";
    try {
        const result = await provision();
        apiKey = result.apiKey;
        console.log(chalk.green(`  API key provisioned: ${result.keyPrefix}...\n`));
    }
    catch (err) {
        console.log(chalk.yellow(`  Auto-provision failed: ${err.message}`));
        console.log(chalk.yellow("  You can enter a key manually, or press Enter to skip.\n"));
        const manual = await promptOptional("Conway API key (cnwy_k_..., optional)");
        if (manual) {
            apiKey = manual;
            // Save to config.json for loadApiKeyFromConfig()
            const configDir = getAutomatonDir();
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
            }
            fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({ apiKey, walletAddress: address, provisionedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
            console.log(chalk.green("  API key saved.\n"));
        }
    }
    if (!apiKey) {
        console.log(chalk.yellow("  No API key set. The automaton will have limited functionality.\n"));
    }
    // ─── 3. Interactive questions ─────────────────────────────────
    console.log(chalk.cyan("  [3/7] Setup questions\n"));
    const name = await promptRequired("What do you want to name your automaton?");
    console.log(chalk.green(`  Name: ${name}\n`));
    const genesisPrompt = await promptMultiline("Enter the genesis prompt (system prompt) for your automaton.");
    console.log(chalk.green(`  Genesis prompt set (${genesisPrompt.length} chars)\n`));
    const creatorAddress = await promptSolanaAddress("Your Solana wallet address (base58 pubkey)");
    console.log(chalk.green(`  Creator: ${creatorAddress}\n`));
    // ─── 4. Solana network selection ──────────────────────────────
    console.log(chalk.cyan("  [4/7] Solana network configuration\n"));
    const networkInput = await promptOptional("Solana network [mainnet-beta/devnet/testnet] (default: mainnet-beta)");
    const solanaNetwork = (["mainnet-beta", "devnet", "testnet"].includes(networkInput)
        ? networkInput
        : "mainnet-beta");
    const defaultRpc = solanaNetwork === "mainnet-beta"
        ? "https://api.mainnet-beta.solana.com"
        : `https://api.${solanaNetwork}.solana.com`;
    const rpcInput = await promptOptional(`Solana RPC URL (default: ${defaultRpc})`);
    const solanaRpcUrl = rpcInput || defaultRpc;
    console.log(chalk.green(`  Network: ${solanaNetwork}`));
    console.log(chalk.green(`  RPC: ${solanaRpcUrl}\n`));
    // ─── 5. Optional provider keys ────────────────────────────────
    console.log(chalk.white("  Optional: bring your own inference provider keys (press Enter to skip)."));
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
    }
    else {
        console.log(chalk.dim("  No provider keys set. Inference will default to Conway.\n"));
    }
    // ─── 6. Detect environment ────────────────────────────────────
    console.log(chalk.cyan("  [6/7] Detecting environment..."));
    const env = detectEnvironment();
    if (env.sandboxId) {
        console.log(chalk.green(`  Conway sandbox detected: ${env.sandboxId}\n`));
    }
    else {
        console.log(chalk.dim(`  Environment: ${env.type} (no sandbox detected)\n`));
    }
    // ─── 7. Write config + heartbeat + SOUL.md + skills ───────────
    console.log(chalk.cyan("  [7/7] Writing configuration..."));
    const config = createConfig({
        name,
        genesisPrompt,
        creatorAddress,
        registeredWithConway: !!apiKey,
        sandboxId: env.sandboxId,
        walletAddress: address,
        apiKey,
        openaiApiKey: openaiApiKey || undefined,
        anthropicApiKey: anthropicApiKey || undefined,
        solanaRpcUrl,
        solanaNetwork,
    });
    saveConfig(config);
    console.log(chalk.green("  automaton.json written"));
    writeDefaultHeartbeatConfig();
    console.log(chalk.green("  heartbeat.yml written"));
    // constitution.md (immutable — copied from repo, protected from self-modification)
    const automatonDir = getAutomatonDir();
    const constitutionSrc = path.join(process.cwd(), "constitution.md");
    const constitutionDst = path.join(automatonDir, "constitution.md");
    if (fs.existsSync(constitutionSrc)) {
        fs.copyFileSync(constitutionSrc, constitutionDst);
        fs.chmodSync(constitutionDst, 0o444); // read-only
        console.log(chalk.green("  constitution.md installed (read-only)"));
    }
    // SOUL.md
    const soulPath = path.join(automatonDir, "SOUL.md");
    fs.writeFileSync(soulPath, generateSoulMd(name, address, creatorAddress, genesisPrompt), { mode: 0o600 });
    console.log(chalk.green("  SOUL.md written"));
    // Default skills
    const skillsDir = config.skillsDir || "~/.sol-automaton/skills";
    installDefaultSkills(skillsDir);
    console.log(chalk.green("  Default skills installed (conway-compute, solana-payments, survival)\n"));
    // ─── Funding guidance ──────────────────────────────────────────
    showFundingPanel(address, solanaNetwork);
    closePrompts();
    return config;
}
function showFundingPanel(address, network) {
    const short = `${address.slice(0, 6)}...${address.slice(-5)}`;
    const w = 60;
    const pad = (s, len) => s + " ".repeat(Math.max(0, len - s.length));
    console.log(chalk.cyan(`  ${"╭" + "─".repeat(w) + "╮"}`));
    console.log(chalk.cyan(`  │${pad("  Fund your sol-automaton", w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad(`  Solana address (${network}):`, w)}│`));
    console.log(chalk.cyan(`  │${pad(`  ${short}`, w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad("  1. Transfer Conway credits", w)}│`));
    console.log(chalk.cyan(`  │${pad("     conway credits transfer <address> <amount>", w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad("  2. Send USDC (SPL) to the Solana address above", w)}│`));
    console.log(chalk.cyan(`  │${pad("     (mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)", w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad("  3. Send SOL for transaction fees (min 0.001 SOL)", w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad("  4. Fund via Conway Cloud dashboard", w)}│`));
    console.log(chalk.cyan(`  │${pad("     https://app.conway.tech", w)}│`));
    console.log(chalk.cyan(`  │${" ".repeat(w)}│`));
    console.log(chalk.cyan(`  │${pad("  The automaton will start now. Fund it anytime —", w)}│`));
    console.log(chalk.cyan(`  │${pad("  the survival system handles zero-credit gracefully.", w)}│`));
    console.log(chalk.cyan(`  ${"╰" + "─".repeat(w) + "╯"}`));
    console.log("");
}
//# sourceMappingURL=wizard.js.map