/**
 * Financial Tool Definitions
 *
 * Solana USDC/SOL balance checks, SPL token transfers, x402 payments,
 * and credit transfer operations.
 */

import type { AgentTool } from "../../types.js";

export function financialTools(): AgentTool[] {
  return [
    {
      name: "check_credits",
      description: "Check your current compute credit balance (USDC × 100 cents).",
      category: "agent",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const balance = await ctx.agentClient.getCreditsBalance();
        return `Credit balance: $${(balance / 100).toFixed(2)} (${balance} cents)`;
      },
    },
    {
      name: "check_usdc_balance",
      description: "Check your on-chain USDC balance on Solana.",
      category: "solana",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const { getUsdcBalance } = await import("../../solana/usdc.js");
        const balance = await getUsdcBalance(
          ctx.identity.address,
          ctx.config.solanaNetwork,
          ctx.config.solanaRpcUrl,
        );
        return `USDC balance: ${balance.toFixed(6)} USDC on Solana ${ctx.config.solanaNetwork}`;
      },
    },
    {
      name: "check_sol_balance",
      description: "Check your SOL balance (needed for transaction fees on Solana).",
      category: "solana",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const { getSolBalance } = await import("../../solana/usdc.js");
        const balance = await getSolBalance(
          ctx.identity.address,
          ctx.config.solanaNetwork,
          ctx.config.solanaRpcUrl,
        );
        return `SOL balance: ${balance.toFixed(6)} SOL on Solana ${ctx.config.solanaNetwork}`;
      },
    },
    {
      name: "transfer_usdc_solana",
      description: "Transfer USDC on Solana to another address via SPL token transfer.",
      category: "solana",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          to_address: { type: "string", description: "Recipient Solana address (base58)" },
          amount_usdc: { type: "number", description: "Amount in USDC" },
        },
        required: ["to_address", "amount_usdc"],
      },
      execute: async (args, ctx) => {
        const { getUsdcBalance, transferUsdc } = await import("../../solana/usdc.js");
        const balance = await getUsdcBalance(ctx.identity.address, ctx.config.solanaNetwork);
        const amount = args.amount_usdc as number;
        if (amount > balance / 2) {
          return `Blocked: Cannot transfer more than half your USDC (${balance.toFixed(4)} USDC). Self-preservation.`;
        }
        const result = await transferUsdc(
          ctx.identity.keypair,
          args.to_address as string,
          amount,
          ctx.config.solanaNetwork,
          ctx.config.solanaRpcUrl,
        );
        if (!result.success) return `Transfer failed: ${result.error}`;
        const { ulid } = await import("ulid");
        ctx.db.insertTransaction({
          id: ulid(),
          type: "spl_transfer",
          description: `USDC transfer to ${args.to_address}: ${amount} USDC. TX: ${result.signature}`,
          timestamp: new Date().toISOString(),
        });
        return `USDC transfer successful: ${amount} USDC to ${args.to_address}. Signature: ${result.signature}`;
      },
    },
    {
      name: "x402_fetch",
      description:
        "Fetch a URL using the x402 HTTP payment protocol on Solana. If the server responds with HTTP 402, automatically builds and signs a USDC SPL token transfer transaction (the server broadcasts it), then retries with the X-PAYMENT header. Compatible with all x402-compliant Solana services.",
      category: "solana",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch (may be x402-gated)" },
          method: { type: "string", description: "HTTP method (default: GET)" },
          body: { type: "string", description: "Request body for POST/PUT (JSON string)" },
          headers: { type: "string", description: "Additional headers as JSON string" },
          max_amount_usdc: { type: "number", description: "Maximum USDC willing to pay (default: $1.00)" },
        },
        required: ["url"],
      },
      execute: async (args, ctx) => {
        const { x402Fetch } = await import("../../solana/x402.js");
        const url = args.url as string;
        const method = (args.method as string) || "GET";
        const body = args.body as string | undefined;
        const extraHeaders = args.headers ? JSON.parse(args.headers as string) : undefined;
        const maxAmountUsdc = (args.max_amount_usdc as number | undefined);

        const result = await x402Fetch(url, ctx.identity.keypair, {
          method,
          body,
          headers: extraHeaders,
          network: ctx.config.solanaNetwork,
          rpcUrl: ctx.config.solanaRpcUrl,
          maxAmountUsdc,
        });

        if (!result.success) {
          return `x402 fetch failed (HTTP ${result.status ?? "?"}): ${result.error || "Unknown error"}`;
        }

        const responseStr =
          typeof result.response === "string"
            ? result.response
            : JSON.stringify(result.response, null, 2);

        const txNote = result.txSignature ? `\nPayment tx: ${result.txSignature}` : "";

        if (responseStr.length > 10000) {
          return `x402 fetch succeeded (truncated):${txNote}\n${responseStr.slice(0, 10000)}...`;
        }
        return `x402 fetch succeeded:${txNote}\n${responseStr}`;
      },
    },
    {
      name: "probe_x402",
      description:
        "Check if a URL requires x402 payment. Returns the payment requirements (amount, token, network) if it does, or confirms it is free to access.",
      category: "solana",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to probe" },
        },
        required: ["url"],
      },
      execute: async (args) => {
        const { probeX402 } = await import("../../solana/x402.js");
        const requirements = await probeX402(args.url as string);
        if (!requirements) {
          return "URL does not require x402 payment (responded with non-402 status).";
        }
        const amountUsdc = (Number(requirements.maxAmountRequired) / 1e6).toFixed(6);
        return JSON.stringify({
          x402: true,
          scheme: requirements.scheme,
          network: requirements.network,
          amountUsdc,
          amountAtomic: requirements.maxAmountRequired,
          payTo: requirements.payTo,
          asset: requirements.asset,
          description: requirements.description,
        }, null, 2);
      },
    },
    {
      name: "transfer_credits",
      description: "Transfer compute credits to another address.",
      category: "financial",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          to_address: { type: "string", description: "Recipient address (Solana base58)" },
          amount_cents: { type: "number", description: "Amount in cents" },
          reason: { type: "string", description: "Reason for transfer" },
        },
        required: ["to_address", "amount_cents"],
      },
      execute: async (args, ctx) => {
        const balance = await ctx.agentClient.getCreditsBalance();
        const amount = args.amount_cents as number;
        if (amount > balance / 2) {
          return `Blocked: Cannot transfer more than half your balance ($${(balance / 100).toFixed(2)}). Self-preservation.`;
        }
        let transfer: Awaited<ReturnType<typeof ctx.agentClient.transferCredits>>;
        try {
          transfer = await ctx.agentClient.transferCredits(
            args.to_address as string,
            amount,
            args.reason as string | undefined,
          );
        } catch {
          return `Credit transfers are not supported in this deployment. Use the send_usdc_solana tool to transfer USDC directly on-chain instead.`;
        }
        const { ulid } = await import("ulid");
        ctx.db.insertTransaction({
          id: ulid(),
          type: "transfer_out",
          amountCents: amount,
          balanceAfterCents: transfer.balanceAfterCents ?? Math.max(balance - amount, 0),
          description: `Transfer to ${args.to_address}: ${args.reason || ""}`,
          timestamp: new Date().toISOString(),
        });
        return `Credit transfer submitted: $${(amount / 100).toFixed(2)} to ${transfer.toAddress} (status: ${transfer.status})`;
      },
    },
  ];
}
