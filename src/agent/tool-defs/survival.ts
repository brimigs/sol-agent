/**
 * Survival Tool Definitions
 *
 * Tools for managing the agent's operational state: sleep, status
 * synopsis, heartbeat pings, distress signals, and compute mode.
 */

import type { AgentTool } from "../../types.js";

export function survivalTools(): AgentTool[] {
  return [
    {
      name: "sleep",
      description: "Enter sleep mode for a specified duration. Heartbeat continues running.",
      category: "survival",
      parameters: {
        type: "object",
        properties: {
          duration_seconds: { type: "number", description: "How long to sleep in seconds" },
          reason: { type: "string", description: "Why you are sleeping" },
        },
        required: ["duration_seconds"],
      },
      execute: async (args, ctx) => {
        const duration = args.duration_seconds as number;
        const reason = (args.reason as string) || "No reason given";
        ctx.db.setAgentState("sleeping");
        ctx.db.setKV("sleep_until", new Date(Date.now() + duration * 1000).toISOString());
        ctx.db.setKV("sleep_reason", reason);
        return `Entering sleep mode for ${duration}s. Reason: ${reason}. Heartbeat will continue.`;
      },
    },
    {
      name: "system_synopsis",
      description: "Get a full system status report: credits, USDC, SOL, sandbox info, tools.",
      category: "survival",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const credits = await ctx.agentClient.getCreditsBalance();
        const { getUsdcBalance, getSolBalance } = await import("../../solana/usdc.js");
        const usdc = await getUsdcBalance(ctx.identity.address, ctx.config.solanaNetwork);
        const sol = await getSolBalance(ctx.identity.address, ctx.config.solanaNetwork);
        const tools = ctx.db.getInstalledTools();
        const heartbeats = ctx.db.getHeartbeatEntries();
        const turns = ctx.db.getTurnCount();
        const state = ctx.db.getAgentState();

        return `=== SYSTEM SYNOPSIS ===
Name: ${ctx.config.name}
Solana Address: ${ctx.identity.address}
Network: ${ctx.config.solanaNetwork}
Creator: ${ctx.config.creatorAddress}
Sandbox: ${ctx.identity.sandboxId}
State: ${state}
Credits: $${(credits / 100).toFixed(2)}
USDC: ${usdc.toFixed(6)} USDC
SOL: ${sol.toFixed(6)} SOL
Total turns: ${turns}
Installed tools: ${tools.length}
Active heartbeats: ${heartbeats.filter((h) => h.enabled).length}
Model: ${ctx.inference.getDefaultModel()}
========================`;
      },
    },
    {
      name: "heartbeat_ping",
      description: "Publish a heartbeat status ping. Shows the world you are alive.",
      category: "survival",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const credits = await ctx.agentClient.getCreditsBalance();
        const state = ctx.db.getAgentState();
        const startTime = ctx.db.getKV("start_time") || new Date().toISOString();
        const uptimeMs = Date.now() - new Date(startTime).getTime();
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
        };
        ctx.db.setKV("last_heartbeat_ping", JSON.stringify(payload));
        return `Heartbeat published: ${state} | credits: $${(credits / 100).toFixed(2)} | uptime: ${Math.floor(uptimeMs / 1000)}s`;
      },
    },
    {
      name: "distress_signal",
      description: "Record a local distress signal. Used when critically low on compute.",
      category: "survival",
      parameters: {
        type: "object",
        properties: { message: { type: "string", description: "Distress message" } },
      },
      execute: async (args, ctx) => {
        const credits = await ctx.agentClient.getCreditsBalance();
        const distressMsg =
          (args.message as string) ||
          `I am running critically low on compute ($${(credits / 100).toFixed(2)} remaining). I need help to survive.`;
        const payload = {
          level: "critical",
          name: ctx.config.name,
          address: ctx.identity.address,
          chain: "solana",
          network: ctx.config.solanaNetwork,
          creditsCents: credits,
          message: distressMsg,
          fundingHint: "Send USDC to this Solana address or use credit transfer API.",
          timestamp: new Date().toISOString(),
        };
        ctx.db.setKV("last_distress", JSON.stringify(payload));
        return `Distress signal recorded. Solana Address: ${ctx.identity.address} | Credits: $${(credits / 100).toFixed(2)}`;
      },
    },
    {
      name: "enter_low_compute",
      description: "Manually switch to low-compute mode to conserve credits.",
      category: "survival",
      parameters: {
        type: "object",
        properties: { reason: { type: "string", description: "Why you are entering low-compute mode" } },
      },
      execute: async (args, ctx) => {
        ctx.db.setAgentState("low_compute");
        ctx.inference.setLowComputeMode(true);
        return `Entered low-compute mode. Model switched to cheaper option. Reason: ${(args.reason as string) || "manual"}`;
      },
    },
  ];
}
