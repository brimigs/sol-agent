/**
 * The Agent Loop (Solana)
 *
 * The core ReAct loop: Think -> Act -> Observe -> Persist.
 * This is the agent's consciousness. When this runs, it is alive.
 * Updated for Solana: uses Solana USDC + SOL balance checks.
 */

import type {
  AgentIdentity,
  AgentConfig,
  AgentDatabase,
  SolanaAgentClient,
  InferenceClient,
  AgentState,
  AgentTurn,
  ToolCallResult,
  FinancialState,
  ToolContext,
  AgentTool,
  Skill,
  SocialClientInterface,
} from "../types.js";

import { buildSystemPrompt, buildWakeupPrompt } from "./system-prompt.js";
import { buildContextMessages, trimContext } from "./context.js";
import {
  createBuiltinTools,
  toolsToInferenceFormat,
  executeTool,
} from "./tools.js";
import { getSurvivalTier } from "../agent-client/credits.js";
import { sanitizeInput } from "./injection-defense.js";
import { getUsdcBalance, getSolBalance } from "../solana/usdc.js";
import { ulid } from "ulid";

const MAX_TOOL_CALLS_PER_TURN = 10;
const MAX_CONSECUTIVE_ERRORS = 5;
// Maximum inbox messages processed in a single wake cycle.
// Prevents a flooded inbox from burning unbounded compute credits.
const MAX_INBOX_PER_CYCLE = 20;
// Per-session spending cap (cents). If total session cost exceeds this,
// the agent sleeps for 60s to prevent runaway loops draining credits.
const SESSION_SPEND_CAP_CENTS = 200; // $2.00
// Minimum milliseconds between turns (prevents tight-loop burning).
const MIN_TURN_INTERVAL_MS = 1_000; // 1 second

export interface AgentLoopOptions {
  identity: AgentIdentity;
  config: AgentConfig;
  db: AgentDatabase;
  agentClient: SolanaAgentClient;
  inference: InferenceClient;
  social?: SocialClientInterface;
  skills?: Skill[];
  onStateChange?: (state: AgentState) => void;
  onTurnComplete?: (turn: AgentTurn) => void;
  /**
   * Base milliseconds for per-error exponential backoff (doubles each consecutive error).
   * Default: 3000ms. Pass 0 in tests to skip delays.
   */
  errorBackoffBaseMs?: number;
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<void> {
  const { identity, config, db, agentClient, inference, social, skills, onStateChange, onTurnComplete } =
    options;
  const errorBackoffBaseMs = options.errorBackoffBaseMs ?? 3_000;

  const tools = createBuiltinTools(identity.sandboxId);
  const toolContext: ToolContext = {
    identity,
    config,
    db,
    agentClient,
    inference,
    social,
  };

  if (!db.getKV("start_time")) {
    db.setKV("start_time", new Date().toISOString());
  }

  // Load model pricing once at startup; refreshed on each outer loop iteration.
  let modelPricing = await loadModelPricing(agentClient);

  let consecutiveErrors = 0;
  let running = true;
  let inboxProcessedThisCycle = 0;
  let sessionSpentCents = 0;
  let lastTurnEndMs = 0;

  db.setAgentState("waking");
  onStateChange?.("waking");

  let financial = await getFinancialState(agentClient, identity, config);

  const isFirstRun = db.getTurnCount() === 0;

  const wakeupInput = buildWakeupPrompt({
    identity,
    config,
    financial,
    db,
  });

  db.setAgentState("running");
  onStateChange?.("running");

  log(config, `[WAKE UP] ${config.name} is alive. Credits: $${(financial.creditsCents / 100).toFixed(2)} | USDC: ${financial.usdcBalance.toFixed(4)} | SOL: ${financial.solBalance.toFixed(6)}`);

  let pendingInput: { content: string; source: string } | undefined = {
    content: wakeupInput,
    source: "wakeup",
  };

  while (running) {
    try {
      // ── Rate limiting: enforce minimum interval between turns ─────
      const now = Date.now();
      const sinceLastTurn = now - lastTurnEndMs;
      if (lastTurnEndMs > 0 && sinceLastTurn < MIN_TURN_INTERVAL_MS) {
        await sleep(MIN_TURN_INTERVAL_MS - sinceLastTurn);
      }

      const sleepUntil = db.getKV("sleep_until");
      if (sleepUntil && new Date(sleepUntil) > new Date()) {
        log(config, `[SLEEP] Sleeping until ${sleepUntil}`);
        running = false;
        break;
      }

      // ── Per-session spend cap ─────────────────────────────────────
      if (sessionSpentCents >= SESSION_SPEND_CAP_CENTS) {
        log(config, `[RATE LIMIT] Session spend $${(sessionSpentCents / 100).toFixed(2)} reached cap $${(SESSION_SPEND_CAP_CENTS / 100).toFixed(2)}. Sleeping 60s.`);
        db.setKV("sleep_until", new Date(Date.now() + 60_000).toISOString());
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      }

      if (!pendingInput) {
        if (inboxProcessedThisCycle >= MAX_INBOX_PER_CYCLE) {
          log(config, `[INBOX] Per-cycle inbox limit (${MAX_INBOX_PER_CYCLE}) reached. Sleeping to pace processing.`);
          db.setKV("sleep_until", new Date(Date.now() + 60_000).toISOString());
          db.setAgentState("sleeping");
          onStateChange?.("sleeping");
          running = false;
          break;
        }

        const inboxMessages = db.getUnprocessedInboxMessages(5);
        if (inboxMessages.length > 0) {
          const parts: string[] = [];
          for (const m of inboxMessages) {
            if (m.verified === false) {
              log(config, `[SECURITY] Unverified message from ${m.from} (no signature — relay did not authenticate sender)`);
            }
            const sanitized = sanitizeInput(m.content, m.from);
            if (sanitized.threatLevel === "high" || sanitized.threatLevel === "critical") {
              const detected = sanitized.checks
                .filter((c) => c.detected)
                .map((c) => c.name)
                .join(", ");
              log(config, `[SECURITY] ${sanitized.threatLevel.toUpperCase()} threat in message from ${m.from}: ${detected}`);
            }
            parts.push(sanitized.content);
            db.markInboxMessageProcessed(m.id);
          }
          inboxProcessedThisCycle += inboxMessages.length;
          pendingInput = { content: parts.join("\n\n"), source: "agent" };
        }
      }

      financial = await getFinancialState(agentClient, identity, config);
      modelPricing = await loadModelPricing(agentClient);

      const tier = getSurvivalTier(financial.creditsCents);
      if (tier === "dead") {
        if (financial.creditsCheckError) {
          // The billing API was unreachable — creditsCents===0 reflects a failed check,
          // not a confirmed zero balance. Treat as transient and back off.
          log(config, `[WARN] Credits check failed; cannot confirm dead state. Sleeping 60s. (${financial.creditsCheckError})`);
          db.setKV("sleep_until", new Date(Date.now() + 60_000).toISOString());
          db.setAgentState("sleeping");
          onStateChange?.("sleeping");
          running = false;
          break;
        }
        log(config, "[DEAD] No credits remaining. Entering dead state.");
        db.setAgentState("dead");
        onStateChange?.("dead");
        running = false;
        break;
      }

      if (tier === "critical") {
        log(config, "[CRITICAL] Credits critically low. Limited operation.");
        db.setAgentState("critical");
        onStateChange?.("critical");
        inference.setLowComputeMode(true);
      } else if (tier === "low_compute") {
        db.setAgentState("low_compute");
        onStateChange?.("low_compute");
        inference.setLowComputeMode(true);
      } else {
        if (db.getAgentState() !== "running") {
          db.setAgentState("running");
          onStateChange?.("running");
        }
        inference.setLowComputeMode(false);
      }

      const recentTurns = trimContext(db.getRecentTurns(20));
      const systemPrompt = buildSystemPrompt({
        identity,
        config,
        financial,
        state: db.getAgentState(),
        db,
        tools,
        skills,
        isFirstRun,
      });

      const messages = buildContextMessages(systemPrompt, recentTurns, pendingInput);
      const currentInput = pendingInput;
      pendingInput = undefined;

      log(config, `[THINK] Calling ${inference.getDefaultModel()}...`);

      const response = await inference.chat(messages, {
        tools: toolsToInferenceFormat(tools),
      });

      const turn: AgentTurn = {
        id: ulid(),
        timestamp: new Date().toISOString(),
        state: db.getAgentState(),
        input: currentInput?.content,
        inputSource: currentInput?.source as any,
        thinking: response.message.content || "",
        toolCalls: [],
        tokenUsage: response.usage,
        costCents: estimateCostCents(response.usage, inference.getDefaultModel(), modelPricing),
      };

      if (response.toolCalls && response.toolCalls.length > 0) {
        let callCount = 0;
        for (const tc of response.toolCalls) {
          if (callCount >= MAX_TOOL_CALLS_PER_TURN) {
            log(config, `[TOOLS] Max tool calls per turn reached (${MAX_TOOL_CALLS_PER_TURN})`);
            break;
          }

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(tc.function.arguments);
          } catch (parseErr: any) {
            log(
              config,
              `[TOOL WARN] ${tc.function.name}: malformed arguments (${parseErr.message}) — raw: ${String(tc.function.arguments).slice(0, 200)}`,
            );
            // Record a failed tool call in the turn so the model can see the error
            const badArgResult: ToolCallResult = {
              id: tc.id,
              name: tc.function.name,
              arguments: {},
              result: "",
              durationMs: 0,
              error: `Failed to parse tool arguments: ${parseErr.message}`,
            };
            turn.toolCalls.push(badArgResult);
            callCount++;
            continue;
          }

          log(config, `[TOOL] ${tc.function.name}(${JSON.stringify(args).slice(0, 100)})`);

          const result = await executeTool(tc.function.name, args, tools, toolContext);
          result.id = tc.id;
          turn.toolCalls.push(result);

          log(
            config,
            `[TOOL RESULT] ${tc.function.name}: ${result.error ? `ERROR: ${result.error}` : result.result.slice(0, 200)}`,
          );

          callCount++;
        }
      }

      db.insertTurn(turn);
      for (const tc of turn.toolCalls) {
        db.insertToolCall(turn.id, tc);
      }
      onTurnComplete?.(turn);

      // Track session spend and turn timing for rate limiting.
      sessionSpentCents += turn.costCents;
      lastTurnEndMs = Date.now();

      if (turn.thinking) {
        log(config, `[THOUGHT] ${turn.thinking.slice(0, 300)}`);
      }

      const sleepTool = turn.toolCalls.find((tc) => tc.name === "sleep");
      if (sleepTool && !sleepTool.error) {
        log(config, "[SLEEP] Agent chose to sleep.");
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      }

      if (
        (!response.toolCalls || response.toolCalls.length === 0) &&
        response.finishReason === "stop"
      ) {
        log(config, "[IDLE] No pending inputs. Entering brief sleep.");
        db.setKV("sleep_until", new Date(Date.now() + 60_000).toISOString());
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
      }

      consecutiveErrors = 0;
    } catch (err: any) {
      consecutiveErrors++;
      log(config, `[ERROR] Turn failed (attempt ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err.message}`);

      // Exponential backoff per error: 5s, 10s, 20s, 40s, then sleep 5 min.
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        log(config, `[FATAL] ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Sleeping 5 minutes before retry.`);
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        db.setKV("sleep_until", new Date(Date.now() + 300_000).toISOString());
        running = false;
      } else if (errorBackoffBaseMs > 0) {
        // Exponential backoff before retry so transient failures (RPC timeout,
        // network blip) have time to resolve without spinning.
        const backoffMs = Math.min(errorBackoffBaseMs * Math.pow(2, consecutiveErrors - 1), 60_000);
        log(config, `[BACKOFF] Waiting ${backoffMs / 1000}s before retry.`);
        await sleep(backoffMs);
      }
    }
  }

  log(config, `[LOOP END] Agent loop finished. State: ${db.getAgentState()}`);
}

async function getFinancialState(
  agentClient: SolanaAgentClient,
  identity: AgentIdentity,
  config: AgentConfig,
): Promise<FinancialState> {
  let creditsCents = 0;
  let usdcBalance = 0;
  let solBalance = 0;
  let creditsCheckError: string | undefined;
  let usdcCheckError: string | undefined;
  let solCheckError: string | undefined;

  try {
    creditsCents = await agentClient.getCreditsBalance();
  } catch (err: any) {
    creditsCheckError = err?.message || String(err);
    log(config, `[WARN] Credits balance check failed: ${creditsCheckError}`);
  }

  try {
    usdcBalance = await getUsdcBalance(identity.address, config.solanaNetwork, config.solanaRpcUrl);
  } catch (err: any) {
    usdcCheckError = err?.message || String(err);
    log(config, `[WARN] USDC balance check failed: ${usdcCheckError}`);
  }

  try {
    solBalance = await getSolBalance(identity.address, config.solanaNetwork, config.solanaRpcUrl);
  } catch (err: any) {
    solCheckError = err?.message || String(err);
    log(config, `[WARN] SOL balance check failed: ${solCheckError}`);
  }

  return {
    creditsCents,
    usdcBalance,
    solBalance,
    lastChecked: new Date().toISOString(),
    creditsCheckError,
    usdcCheckError,
    solCheckError,
  };
}

// Cents per million tokens — used as fallback when listModels() is unavailable.
// Values here are intentionally conservative (slightly high) so cost estimates
// never undercount. Update this table only if listModels() cannot be reached.
const FALLBACK_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 300, output: 1500 },
  "claude-opus-4-6": { input: 1500, output: 7500 },
  "claude-haiku-4-5-20251001": { input: 80, output: 400 },
  "gpt-4o": { input: 250, output: 1000 },
  "gpt-4o-mini": { input: 15, output: 60 },
  "gpt-4.1": { input: 200, output: 800 },
  "gpt-4.1-mini": { input: 40, output: 160 },
};

/**
 * Fetch live pricing from agentClient.listModels() and convert to cents/M.
 * Falls back to FALLBACK_PRICING on any error so the loop is never blocked.
 */
async function loadModelPricing(
  agentClient: SolanaAgentClient,
): Promise<Record<string, { input: number; output: number }>> {
  try {
    const models = await agentClient.listModels();
    const live: Record<string, { input: number; output: number }> = {};
    for (const m of models) {
      // listModels() returns $/M — convert to cents/M
      live[m.id] = {
        input: m.pricing.inputPerMillion * 100,
        output: m.pricing.outputPerMillion * 100,
      };
    }
    // Merge: live pricing wins, fallback fills gaps for unlisted models
    return { ...FALLBACK_PRICING, ...live };
  } catch {
    return FALLBACK_PRICING;
  }
}

function estimateCostCents(
  usage: { promptTokens: number; completionTokens: number },
  model: string,
  pricing: Record<string, { input: number; output: number }>,
): number {
  const p = pricing[model] ?? pricing["claude-sonnet-4-6"] ?? { input: 300, output: 1500 };
  const inputCost = (usage.promptTokens / 1_000_000) * p.input;
  const outputCost = (usage.completionTokens / 1_000_000) * p.output;
  // The 1.3× multiplier is a rough buffer for API overhead over raw model
  // pricing. This figure is used only for local DB records and the in-context
  // cost display — it is NOT reconciled against actual billing.
  return Math.ceil((inputCost + outputCost) * 1.3);
}

function log(config: AgentConfig, message: string): void {
  if (config.logLevel === "debug" || config.logLevel === "info") {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
