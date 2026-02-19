/**
 * Resource Monitor (Solana)
 *
 * Continuously monitors the agent's resources and triggers
 * survival mode transitions when needed.
 * Updated for Solana: checks USDC (SPL) and SOL balances.
 */

import type {
  AgentConfig,
  AgentDatabase,
  SolanaAgentClient,
  AgentIdentity,
  FinancialState,
  SurvivalTier,
} from "../types.js";
import { getSurvivalTier, formatCredits } from "../agent-client/credits.js";
import { getUsdcBalance, getSolBalance } from "../solana/usdc.js";

export interface ResourceStatus {
  financial: FinancialState;
  tier: SurvivalTier;
  previousTier: SurvivalTier | null;
  tierChanged: boolean;
  sandboxHealthy: boolean;
}

/**
 * Check all resources and return current status.
 */
export async function checkResources(
  identity: AgentIdentity,
  agentClient: SolanaAgentClient,
  db: AgentDatabase,
  config?: AgentConfig,
): Promise<ResourceStatus> {
  const network = config?.solanaNetwork || "mainnet-beta";
  const rpcUrl = config?.solanaRpcUrl;

  // Check credits
  let creditsCents = 0;
  let creditsCheckError: string | undefined;
  try {
    creditsCents = await agentClient.getCreditsBalance();
  } catch (err: any) {
    creditsCheckError = err?.message || String(err);
    console.warn(`[monitor] Credits balance check failed: ${creditsCheckError}`);
  }

  // Check USDC (SPL token on Solana)
  let usdcBalance = 0;
  let usdcCheckError: string | undefined;
  try {
    usdcBalance = await getUsdcBalance(identity.address, network, rpcUrl);
  } catch (err: any) {
    usdcCheckError = err?.message || String(err);
    console.warn(`[monitor] USDC balance check failed: ${usdcCheckError}`);
  }

  // Check SOL balance (needed for transaction fees)
  let solBalance = 0;
  let solCheckError: string | undefined;
  try {
    solBalance = await getSolBalance(identity.address, network, rpcUrl);
  } catch (err: any) {
    solCheckError = err?.message || String(err);
    console.warn(`[monitor] SOL balance check failed: ${solCheckError}`);
  }

  // Check sandbox health
  let sandboxHealthy = true;
  try {
    const result = await agentClient.exec("echo ok", 5000);
    sandboxHealthy = result.exitCode === 0;
  } catch {
    sandboxHealthy = false;
  }

  const financial: FinancialState = {
    creditsCents,
    usdcBalance,
    solBalance,
    lastChecked: new Date().toISOString(),
    creditsCheckError,
    usdcCheckError,
    solCheckError,
  };

  const tier = getSurvivalTier(creditsCents);
  const prevTierStr = db.getKV("current_tier");
  const previousTier = (prevTierStr as SurvivalTier) || null;
  const tierChanged = previousTier !== null && previousTier !== tier;

  // Store current tier
  db.setKV("current_tier", tier);

  // Store financial state
  db.setKV("financial_state", JSON.stringify(financial));

  return {
    financial,
    tier,
    previousTier,
    tierChanged,
    sandboxHealthy,
  };
}

/**
 * Generate a human-readable resource report.
 */
export function formatResourceReport(status: ResourceStatus): string {
  const lines = [
    `=== RESOURCE STATUS ===`,
    `Credits: ${formatCredits(status.financial.creditsCents)}`,
    `USDC: ${status.financial.usdcBalance.toFixed(6)} USDC (Solana)`,
    `SOL: ${status.financial.solBalance.toFixed(6)} SOL`,
    `Tier: ${status.tier}${status.tierChanged ? ` (changed from ${status.previousTier})` : ""}`,
    `Sandbox: ${status.sandboxHealthy ? "healthy" : "UNHEALTHY"}`,
    `Checked: ${status.financial.lastChecked}`,
    `========================`,
  ];
  return lines.join("\n");
}
