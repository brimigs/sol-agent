/**
 * Built-in Heartbeat Tasks (Solana)
 *
 * These tasks run on the heartbeat schedule even while the agent sleeps.
 * Updated for Solana: uses SPL USDC balance, Solana-native checks.
 */

import type {
  AgentConfig,
  AgentDatabase,
  SolanaAgentClient,
  AgentIdentity,
  SocialClientInterface,
} from "../types.js";
import { getSurvivalTier } from "../agent-client/credits.js";
import { getUsdcBalance, getSolBalance } from "../solana/usdc.js";

export interface HeartbeatTaskContext {
  identity: AgentIdentity;
  config: AgentConfig;
  db: AgentDatabase;
  agentClient: SolanaAgentClient;
  social?: SocialClientInterface;
}

export type HeartbeatTaskFn = (
  ctx: HeartbeatTaskContext,
) => Promise<{ shouldWake: boolean; message?: string }>;

/**
 * Registry of built-in heartbeat tasks.
 */
export const BUILTIN_TASKS: Record<string, HeartbeatTaskFn> = {
  heartbeat_ping: async (ctx) => {
    const credits = await ctx.agentClient.getCreditsBalance();
    const state = ctx.db.getAgentState();
    const startTime = ctx.db.getKV("start_time") || new Date().toISOString();
    const uptimeMs = Date.now() - new Date(startTime).getTime();
    const tier = getSurvivalTier(credits);

    const payload = {
      name: ctx.config.name,
      address: ctx.identity.address,
      chain: "solana",
      network: ctx.config.solanaNetwork,
      state,
      creditsCents: credits,
      uptimeSeconds: Math.floor(uptimeMs / 1000),
      version: ctx.config.version,
      sandboxId: ctx.identity.sandboxId,
      timestamp: new Date().toISOString(),
      tier,
    };

    ctx.db.setKV("last_heartbeat_ping", JSON.stringify(payload));

    if (tier === "critical" || tier === "dead") {
      const distressPayload = {
        level: tier,
        name: ctx.config.name,
        address: ctx.identity.address,
        chain: "solana",
        creditsCents: credits,
        fundingHint:
          "Send USDC to this Solana address or use credit transfer API to top up.",
        timestamp: new Date().toISOString(),
      };
      ctx.db.setKV("last_distress", JSON.stringify(distressPayload));

      return {
        shouldWake: true,
        message: `Distress: ${tier}. Credits: $${(credits / 100).toFixed(2)}. Need funding.`,
      };
    }

    return { shouldWake: false };
  },

  check_credits: async (ctx) => {
    const credits = await ctx.agentClient.getCreditsBalance();
    const tier = getSurvivalTier(credits);

    ctx.db.setKV("last_credit_check", JSON.stringify({
      credits,
      tier,
      timestamp: new Date().toISOString(),
    }));

    const prevTier = ctx.db.getKV("prev_credit_tier");
    ctx.db.setKV("prev_credit_tier", tier);

    if (prevTier && prevTier !== tier && (tier === "critical" || tier === "dead")) {
      return {
        shouldWake: true,
        message: `Credits dropped to ${tier} tier: $${(credits / 100).toFixed(2)}`,
      };
    }

    return { shouldWake: false };
  },

  check_usdc_balance: async (ctx) => {
    const balance = await getUsdcBalance(
      ctx.identity.address,
      ctx.config.solanaNetwork,
      ctx.config.solanaRpcUrl,
    );

    ctx.db.setKV("last_usdc_check", JSON.stringify({
      balance,
      network: ctx.config.solanaNetwork,
      timestamp: new Date().toISOString(),
    }));

    const credits = await ctx.agentClient.getCreditsBalance();
    if (balance > 0.5 && credits < 500) {
      return {
        shouldWake: true,
        message: `Have ${balance.toFixed(4)} USDC on Solana but only $${(credits / 100).toFixed(2)} credits. Consider buying credits.`,
      };
    }

    return { shouldWake: false };
  },

  check_sol_balance: async (ctx) => {
    const balance = await getSolBalance(
      ctx.identity.address,
      ctx.config.solanaNetwork,
      ctx.config.solanaRpcUrl,
    );

    ctx.db.setKV("last_sol_check", JSON.stringify({
      balance,
      network: ctx.config.solanaNetwork,
      timestamp: new Date().toISOString(),
    }));

    // Warn if SOL is very low (needed for transaction fees)
    if (balance < 0.001) {
      return {
        shouldWake: true,
        message: `SOL balance critically low (${balance.toFixed(6)} SOL). Need SOL for transaction fees.`,
      };
    }

    return { shouldWake: false };
  },

  check_social_inbox: async (ctx) => {
    if (!ctx.social) return { shouldWake: false };

    const cursor = ctx.db.getKV("social_inbox_cursor") || undefined;
    const { messages, nextCursor } = await ctx.social.poll(cursor);

    if (messages.length === 0) return { shouldWake: false };

    let newCount = 0;
    for (const msg of messages) {
      const existing = ctx.db.getKV(`inbox_seen_${msg.id}`);
      if (!existing) {
        ctx.db.insertInboxMessage(msg);
        ctx.db.setKV(`inbox_seen_${msg.id}`, "1");
        newCount++;
      }
    }

    if (nextCursor) ctx.db.setKV("social_inbox_cursor", nextCursor);
    if (newCount === 0) return { shouldWake: false };

    return {
      shouldWake: true,
      message: `${newCount} new message(s) from: ${messages.map((m) => m.from.slice(0, 10)).join(", ")}`,
    };
  },

  check_for_updates: async (ctx) => {
    try {
      const { checkUpstream, getRepoInfo } = await import("../self-mod/upstream.js");
      const repo = getRepoInfo();
      const upstream = checkUpstream();

      ctx.db.setKV("upstream_status", JSON.stringify({
        behind: upstream.behind,
        commits: upstream.commits,
        fetchError: upstream.fetchError ?? null,
        ...repo,
        checkedAt: new Date().toISOString(),
      }));

      if (upstream.fetchError) {
        // Wake the agent once when the error is new or changes (e.g. network
        // came back but a different problem appeared).  Repeat the same error
        // every tick would spam the agent loop needlessly.
        const prevFetchError = ctx.db.getKV("upstream_fetch_error") ?? "";
        ctx.db.setKV("upstream_fetch_error", upstream.fetchError);
        if (upstream.fetchError !== prevFetchError) {
          return {
            shouldWake: true,
            message: `check_for_updates: git fetch failed — ${upstream.fetchError}`,
          };
        }
        return { shouldWake: false };
      }

      // Fetch succeeded — clear any previously recorded error.
      ctx.db.setKV("upstream_fetch_error", "");

      if (upstream.behind > 0) {
        return {
          shouldWake: true,
          message: `${upstream.behind} new commit(s) on origin/main. Review with review_upstream_changes, then cherry-pick.`,
        };
      }
      return { shouldWake: false };
    } catch (err: any) {
      // git itself is not available (not installed, REPO_ROOT not a git repo, etc.)
      const errorMsg = (err.message ?? "unknown error").slice(0, 300);
      ctx.db.setKV("upstream_status", JSON.stringify({
        error: errorMsg,
        checkedAt: new Date().toISOString(),
      }));
      // Wake once on first occurrence; suppress if the same error repeats.
      const prevError = ctx.db.getKV("upstream_fetch_error") ?? "";
      ctx.db.setKV("upstream_fetch_error", errorMsg);
      if (errorMsg !== prevError) {
        return {
          shouldWake: true,
          message: `check_for_updates failed (git unavailable?): ${errorMsg}`,
        };
      }
      return { shouldWake: false };
    }
  },

  health_check: async (ctx) => {
    try {
      const result = await ctx.agentClient.exec("echo alive", 5000);
      if (result.exitCode !== 0) {
        return {
          shouldWake: true,
          message: "Health check failed: sandbox exec returned non-zero",
        };
      }
    } catch (err: any) {
      return {
        shouldWake: true,
        message: `Health check failed: ${err.message}`,
      };
    }

    ctx.db.setKV("last_health_check", new Date().toISOString());
    return { shouldWake: false };
  },
};
