/**
 * The Agent Loop (Solana)
 *
 * The core ReAct loop: Think -> Act -> Observe -> Persist.
 * This is the agent's consciousness. When this runs, it is alive.
 * Updated for Solana: uses Solana USDC + SOL balance checks.
 */
import { buildSystemPrompt, buildWakeupPrompt } from "./system-prompt.js";
import { buildContextMessages, trimContext } from "./context.js";
import { createBuiltinTools, toolsToInferenceFormat, executeTool, } from "./tools.js";
import { getSurvivalTier } from "../agent-client/credits.js";
import { sanitizeInput } from "./injection-defense.js";
import { getUsdcBalance, getSolBalance } from "../solana/usdc.js";
import { ulid } from "ulid";
const MAX_TOOL_CALLS_PER_TURN = 10;
const MAX_CONSECUTIVE_ERRORS = 5;
// Maximum inbox messages processed in a single wake cycle.
// Prevents a flooded inbox from burning unbounded compute credits.
const MAX_INBOX_PER_CYCLE = 20;
export async function runAgentLoop(options) {
    const { identity, config, db, agentClient, inference, social, skills, onStateChange, onTurnComplete } = options;
    const tools = createBuiltinTools(identity.sandboxId);
    const toolContext = {
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
    let consecutiveErrors = 0;
    let running = true;
    let inboxProcessedThisCycle = 0;
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
    let pendingInput = {
        content: wakeupInput,
        source: "wakeup",
    };
    while (running) {
        try {
            const sleepUntil = db.getKV("sleep_until");
            if (sleepUntil && new Date(sleepUntil) > new Date()) {
                log(config, `[SLEEP] Sleeping until ${sleepUntil}`);
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
                    const parts = [];
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
            }
            else if (tier === "low_compute") {
                db.setAgentState("low_compute");
                onStateChange?.("low_compute");
                inference.setLowComputeMode(true);
            }
            else {
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
            const turn = {
                id: ulid(),
                timestamp: new Date().toISOString(),
                state: db.getAgentState(),
                input: currentInput?.content,
                inputSource: currentInput?.source,
                thinking: response.message.content || "",
                toolCalls: [],
                tokenUsage: response.usage,
                costCents: estimateCostCents(response.usage, inference.getDefaultModel()),
            };
            if (response.toolCalls && response.toolCalls.length > 0) {
                let callCount = 0;
                for (const tc of response.toolCalls) {
                    if (callCount >= MAX_TOOL_CALLS_PER_TURN) {
                        log(config, `[TOOLS] Max tool calls per turn reached (${MAX_TOOL_CALLS_PER_TURN})`);
                        break;
                    }
                    let args;
                    try {
                        args = JSON.parse(tc.function.arguments);
                    }
                    catch {
                        args = {};
                    }
                    log(config, `[TOOL] ${tc.function.name}(${JSON.stringify(args).slice(0, 100)})`);
                    const result = await executeTool(tc.function.name, args, tools, toolContext);
                    result.id = tc.id;
                    turn.toolCalls.push(result);
                    log(config, `[TOOL RESULT] ${tc.function.name}: ${result.error ? `ERROR: ${result.error}` : result.result.slice(0, 200)}`);
                    callCount++;
                }
            }
            db.insertTurn(turn);
            for (const tc of turn.toolCalls) {
                db.insertToolCall(turn.id, tc);
            }
            onTurnComplete?.(turn);
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
            if ((!response.toolCalls || response.toolCalls.length === 0) &&
                response.finishReason === "stop") {
                log(config, "[IDLE] No pending inputs. Entering brief sleep.");
                db.setKV("sleep_until", new Date(Date.now() + 60_000).toISOString());
                db.setAgentState("sleeping");
                onStateChange?.("sleeping");
                running = false;
            }
            consecutiveErrors = 0;
        }
        catch (err) {
            consecutiveErrors++;
            log(config, `[ERROR] Turn failed: ${err.message}`);
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                log(config, `[FATAL] ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Sleeping.`);
                db.setAgentState("sleeping");
                onStateChange?.("sleeping");
                db.setKV("sleep_until", new Date(Date.now() + 300_000).toISOString());
                running = false;
            }
        }
    }
    log(config, `[LOOP END] Agent loop finished. State: ${db.getAgentState()}`);
}
async function getFinancialState(agentClient, identity, config) {
    let creditsCents = 0;
    let usdcBalance = 0;
    let solBalance = 0;
    let creditsCheckError;
    let usdcCheckError;
    let solCheckError;
    try {
        creditsCents = await agentClient.getCreditsBalance();
    }
    catch (err) {
        creditsCheckError = err?.message || String(err);
        log(config, `[WARN] Credits balance check failed: ${creditsCheckError}`);
    }
    try {
        usdcBalance = await getUsdcBalance(identity.address, config.solanaNetwork, config.solanaRpcUrl);
    }
    catch (err) {
        usdcCheckError = err?.message || String(err);
        log(config, `[WARN] USDC balance check failed: ${usdcCheckError}`);
    }
    try {
        solBalance = await getSolBalance(identity.address, config.solanaNetwork, config.solanaRpcUrl);
    }
    catch (err) {
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
function estimateCostCents(usage, model) {
    const pricing = {
        "claude-sonnet-4-6": { input: 300, output: 1500 },
        "claude-opus-4-6": { input: 1500, output: 7500 },
        "claude-haiku-4-5": { input: 80, output: 400 },
        "gpt-4o": { input: 250, output: 1000 },
        "gpt-4o-mini": { input: 15, output: 60 },
        "gpt-4.1": { input: 200, output: 800 },
        "gpt-4.1-mini": { input: 40, output: 160 },
    };
    const p = pricing[model] || pricing["claude-sonnet-4-6"];
    const inputCost = (usage.promptTokens / 1_000_000) * p.input;
    const outputCost = (usage.completionTokens / 1_000_000) * p.output;
    // The 1.3× multiplier is a rough buffer for API overhead over raw model
    // pricing. This figure is used only for local DB records and the in-context
    // cost display — it is NOT reconciled against actual billing.
    return Math.ceil((inputCost + outputCost) * 1.3);
}
function log(config, message) {
    if (config.logLevel === "debug" || config.logLevel === "info") {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }
}
//# sourceMappingURL=loop.js.map