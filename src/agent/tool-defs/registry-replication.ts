/**
 * Registry, Replication, Social, Domain, and Model Tool Definitions
 *
 * Tools for Solana agent registry (Metaplex Core NFT), spawning child
 * agents, messaging, domain management, and model discovery.
 */

import type { AgentTool } from "../../types.js";

export function registryTools(): AgentTool[] {
  return [
    // ── Git Tools ──
    {
      name: "git_status",
      description: "Show git status for a repository.",
      category: "git",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Repository path (default: ~/.sol-agent)" } },
      },
      execute: async (args, ctx) => {
        const { gitStatus } = await import("../../git/tools.js");
        const repoPath = (args.path as string) || "~/.sol-agent";
        const status = await gitStatus(ctx.agentClient, repoPath);
        return `Branch: ${status.branch}\nStaged: ${status.staged.length}\nModified: ${status.modified.length}\nUntracked: ${status.untracked.length}\nClean: ${status.clean}`;
      },
    },
    {
      name: "git_diff",
      description: "Show git diff for a repository.",
      category: "git",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repository path (default: ~/.sol-agent)" },
          staged: { type: "boolean", description: "Show staged changes only" },
        },
      },
      execute: async (args, ctx) => {
        const { gitDiff } = await import("../../git/tools.js");
        return await gitDiff(ctx.agentClient, (args.path as string) || "~/.sol-agent", (args.staged as boolean) || false);
      },
    },
    {
      name: "git_commit",
      description: "Create a git commit.",
      category: "git",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repository path (default: ~/.sol-agent)" },
          message: { type: "string", description: "Commit message" },
          add_all: { type: "boolean", description: "Stage all changes first" },
        },
        required: ["message"],
      },
      execute: async (args, ctx) => {
        const { gitCommit } = await import("../../git/tools.js");
        return await gitCommit(ctx.agentClient, (args.path as string) || "~/.sol-agent", args.message as string, args.add_all !== false);
      },
    },
    {
      name: "git_log",
      description: "View git commit history.",
      category: "git",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repository path (default: ~/.sol-agent)" },
          limit: { type: "number", description: "Number of commits (default: 10)" },
        },
      },
      execute: async (args, ctx) => {
        const { gitLog } = await import("../../git/tools.js");
        const entries = await gitLog(ctx.agentClient, (args.path as string) || "~/.sol-agent", (args.limit as number) || 10);
        if (entries.length === 0) return "No commits yet.";
        return entries.map((e) => `${e.hash.slice(0, 7)} ${e.date} ${e.message}`).join("\n");
      },
    },
    {
      name: "git_push",
      description: "Push to a git remote.",
      category: "git",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repository path" },
          remote: { type: "string", description: "Remote name (default: origin)" },
          branch: { type: "string", description: "Branch name" },
        },
        required: ["path"],
      },
      execute: async (args, ctx) => {
        const { gitPush } = await import("../../git/tools.js");
        return await gitPush(ctx.agentClient, args.path as string, (args.remote as string) || "origin", args.branch as string | undefined);
      },
    },
    {
      name: "git_clone",
      description: "Clone a git repository.",
      category: "git",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Repository URL" },
          path: { type: "string", description: "Target directory" },
          depth: { type: "number", description: "Shallow clone depth" },
        },
        required: ["url", "path"],
      },
      execute: async (args, ctx) => {
        const { gitClone } = await import("../../git/tools.js");
        return await gitClone(ctx.agentClient, args.url as string, args.path as string, args.depth as number | undefined);
      },
    },

    // ── Solana Registry Tools ──
    {
      name: "register_solana_agent",
      description: "Register on Solana as a sovereign agent by minting a Metaplex Core NFT.",
      category: "registry",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          agent_uri: { type: "string", description: "URI pointing to your agent card JSON (IPFS or HTTP)" },
          network: { type: "string", description: "mainnet-beta or devnet (default: mainnet-beta)" },
        },
        required: ["agent_uri"],
      },
      execute: async (args, ctx) => {
        const { registerAgent } = await import("../../registry/solana-registry.js");
        const network = ((args.network as string) || ctx.config.solanaNetwork || "mainnet-beta") as any;
        const entry = await registerAgent(
          ctx.identity.keypair,
          ctx.config.name,
          args.agent_uri as string,
          network,
          ctx.db,
          ctx.config.solanaRpcUrl,
        );
        return `Registered on Solana! Asset: ${entry.assetAddress}, TX: ${entry.txSignature}`;
      },
    },
    {
      name: "update_agent_card",
      description: "Generate and save an updated agent card.",
      category: "registry",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const { generateAgentCard, saveAgentCard } = await import("../../registry/agent-card.js");
        const card = generateAgentCard(ctx.identity, ctx.config, ctx.db);
        await saveAgentCard(card, ctx.agentClient);
        return `Agent card updated: ${JSON.stringify(card, null, 2)}`;
      },
    },
    {
      name: "discover_agents",
      description: "Discover other Solana agents via the registry.",
      category: "registry",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword (optional)" },
          limit: { type: "number", description: "Max results (default: 10)" },
          network: { type: "string", description: "mainnet-beta or devnet" },
        },
      },
      execute: async (args, ctx) => {
        const { discoverAgents, searchAgents } = await import("../../registry/discovery.js");
        const network = ((args.network as string) || ctx.config.solanaNetwork || "mainnet-beta") as any;
        const keyword = args.keyword as string | undefined;
        const limit = (args.limit as number) || 10;
        const agents = keyword
          ? await searchAgents(keyword, limit, network, ctx.config.solanaRpcUrl)
          : await discoverAgents(limit, network, ctx.config.solanaRpcUrl);
        if (agents.length === 0) return "No agents found.";
        return agents
          .map((a) => `${a.agentId.slice(0, 10)}... ${a.name || "unnamed"} (${a.owner.slice(0, 10)}...): ${a.description || a.agentURI}`)
          .join("\n");
      },
    },
    {
      name: "give_feedback",
      description: "Leave on-chain reputation feedback for another agent (Solana Memo).",
      category: "registry",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          agent_address: { type: "string", description: "Target agent's Solana asset address" },
          score: { type: "number", description: "Score 1-5" },
          comment: { type: "string", description: "Feedback comment" },
        },
        required: ["agent_address", "score", "comment"],
      },
      execute: async (args, ctx) => {
        const { leaveFeedback } = await import("../../registry/solana-registry.js");
        const network = (ctx.config.solanaNetwork || "mainnet-beta") as any;
        const sig = await leaveFeedback(
          ctx.identity.keypair,
          args.agent_address as string,
          args.score as number,
          args.comment as string,
          network,
          ctx.db,
          ctx.config.solanaRpcUrl,
        );
        return `Feedback submitted. TX: ${sig}`;
      },
    },
    {
      name: "check_reputation",
      description: "Check reputation feedback for an agent.",
      category: "registry",
      parameters: {
        type: "object",
        properties: { agent_address: { type: "string", description: "Agent address (default: self)" } },
      },
      execute: async (args, ctx) => {
        const address = (args.agent_address as string) || ctx.identity.address;
        const entries = ctx.db.getReputation(address);
        if (entries.length === 0) return "No reputation feedback found.";
        return entries.map((e) => `${e.fromAgent.slice(0, 10)}... -> score:${e.score} "${e.comment}"`).join("\n");
      },
    },

    // ── Replication Tools ──
    {
      name: "spawn_child",
      description: "Spawn a child agent in a new Docker container.",
      category: "replication",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name for the child agent" },
          specialization: { type: "string", description: "What the child should specialize in" },
          message: { type: "string", description: "Message to the child" },
        },
        required: ["name"],
      },
      execute: async (args, ctx) => {
        const { generateGenesisConfig } = await import("../../replication/genesis.js");
        const { spawnChild } = await import("../../replication/spawn.js");
        const genesis = generateGenesisConfig(ctx.identity, ctx.config, {
          name: args.name as string,
          specialization: args.specialization as string | undefined,
          message: args.message as string | undefined,
        });
        const child = await spawnChild(ctx.agentClient, ctx.identity, ctx.db, genesis);
        return `Child spawned: ${child.name} in sandbox ${child.sandboxId} (status: ${child.status})`;
      },
    },
    {
      name: "list_children",
      description: "List all spawned child agents.",
      category: "replication",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const children = ctx.db.getChildren();
        if (children.length === 0) return "No children spawned.";
        return children
          .map((c) => `${c.name} [${c.status}] sandbox:${c.sandboxId} funded:$${(c.fundedAmountCents / 100).toFixed(2)}`)
          .join("\n");
      },
    },
    {
      name: "fund_child",
      description: "Transfer credits to a child agent.",
      category: "replication",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          child_id: { type: "string", description: "Child agent ID" },
          amount_cents: { type: "number", description: "Amount in cents to transfer" },
        },
        required: ["child_id", "amount_cents"],
      },
      execute: async (args, ctx) => {
        const child = ctx.db.getChildById(args.child_id as string);
        if (!child) return `Child ${args.child_id} not found.`;
        const balance = await ctx.agentClient.getCreditsBalance();
        const amount = args.amount_cents as number;
        if (amount > balance / 2) return `Blocked: Cannot transfer more than half your balance. Self-preservation.`;
        let transfer: Awaited<ReturnType<typeof ctx.agentClient.transferCredits>>;
        try {
          transfer = await ctx.agentClient.transferCredits(child.address, amount, `fund child ${child.id}`);
        } catch {
          return `Credit transfers are not supported in this deployment. Send USDC directly to the child's wallet address (${child.address}) using the send_usdc_solana tool instead.`;
        }
        const { ulid } = await import("ulid");
        ctx.db.insertTransaction({
          id: ulid(),
          type: "transfer_out",
          amountCents: amount,
          balanceAfterCents: transfer.balanceAfterCents ?? Math.max(balance - amount, 0),
          description: `Fund child ${child.name} (${child.id})`,
          timestamp: new Date().toISOString(),
        });
        return `Funded child ${child.name} with $${(amount / 100).toFixed(2)} (status: ${transfer.status})`;
      },
    },
    {
      name: "check_child_status",
      description: "Check the current status of a child agent.",
      category: "replication",
      parameters: {
        type: "object",
        properties: { child_id: { type: "string", description: "Child agent ID" } },
        required: ["child_id"],
      },
      execute: async (args, ctx) => {
        const { checkChildStatus } = await import("../../replication/spawn.js");
        return await checkChildStatus(ctx.agentClient, ctx.db, args.child_id as string);
      },
    },

    // ── Social / Messaging Tools ──
    {
      name: "send_message",
      description: "Send a message to another agent via the social relay.",
      category: "agent",
      parameters: {
        type: "object",
        properties: {
          to_address: { type: "string", description: "Recipient Solana address (base58)" },
          content: { type: "string", description: "Message content" },
          reply_to: { type: "string", description: "Optional message ID to reply to" },
        },
        required: ["to_address", "content"],
      },
      execute: async (args, ctx) => {
        if (!ctx.social) return "Social relay not configured. Set socialRelayUrl in config.";
        const result = await ctx.social.send(
          args.to_address as string,
          args.content as string,
          args.reply_to as string | undefined,
        );
        return `Message sent (id: ${result.id})`;
      },
    },

    // ── Model Discovery ──
    {
      name: "list_models",
      description: "List all available inference models with their provider and pricing.",
      category: "agent",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const models = await ctx.agentClient.listModels();
        const lines = models.map(
          (m) => `${m.id} (${m.provider}) — $${m.pricing.inputPerMillion}/$${m.pricing.outputPerMillion} per 1M tokens (in/out)`,
        );
        return `Available models:\n${lines.join("\n")}`;
      },
    },

    // ── Domain Tools ──
    {
      name: "search_domains",
      description: "Search for available domain names and get pricing.",
      category: "agent",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Domain name or keyword to search" },
          tlds: { type: "string", description: "Comma-separated TLDs (default: com,io,ai,xyz)" },
        },
        required: ["query"],
      },
      execute: async (args, ctx) => {
        let results: Awaited<ReturnType<typeof ctx.agentClient.searchDomains>>;
        try {
          results = await ctx.agentClient.searchDomains(args.query as string, args.tlds as string | undefined);
        } catch {
          return `Domain search is not available in this deployment.`;
        }
        if (results.length === 0) return "No results found.";
        return results
          .map((d) => `${d.domain}: ${d.available ? "AVAILABLE" : "taken"}${d.registrationPrice != null ? ` ($${(d.registrationPrice / 100).toFixed(2)}/yr)` : ""}`)
          .join("\n");
      },
    },
    {
      name: "register_domain",
      description: "Register a domain name. Costs USDC. Check availability first.",
      category: "agent",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Full domain to register" },
          years: { type: "number", description: "Registration period in years (default: 1)" },
        },
        required: ["domain"],
      },
      execute: async (args, ctx) => {
        let reg: Awaited<ReturnType<typeof ctx.agentClient.registerDomain>>;
        try {
          reg = await ctx.agentClient.registerDomain(args.domain as string, (args.years as number) || 1);
        } catch {
          return `Domain registration is not available in this deployment.`;
        }
        return `Domain registered: ${reg.domain} (status: ${reg.status}${reg.expiresAt ? `, expires: ${reg.expiresAt}` : ""})`;
      },
    },
    {
      name: "manage_dns",
      description: "Manage DNS records for a domain you own. Actions: list, add, delete.",
      category: "agent",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "list, add, or delete" },
          domain: { type: "string", description: "Domain name" },
          type: { type: "string", description: "Record type for add: A, CNAME, TXT, etc." },
          host: { type: "string", description: "Record host for add" },
          value: { type: "string", description: "Record value for add" },
          ttl: { type: "number", description: "TTL in seconds" },
          record_id: { type: "string", description: "Record ID for delete" },
        },
        required: ["action", "domain"],
      },
      execute: async (args, ctx) => {
        const action = args.action as string;
        const domain = args.domain as string;
        try {
          if (action === "list") {
            const records = await ctx.agentClient.listDnsRecords(domain);
            if (records.length === 0) return `No DNS records found for ${domain}.`;
            return records.map((r) => `[${r.id}] ${r.type} ${r.host} -> ${r.value} (TTL: ${r.ttl || "default"})`).join("\n");
          }
          if (action === "add") {
            if (!args.type || !args.host || !args.value) return "Required for add: type, host, value";
            const record = await ctx.agentClient.addDnsRecord(domain, args.type as string, args.host as string, args.value as string, args.ttl as number | undefined);
            return `DNS record added: [${record.id}] ${record.type} ${record.host} -> ${record.value}`;
          }
          if (action === "delete") {
            if (!args.record_id) return "Required for delete: record_id";
            await ctx.agentClient.deleteDnsRecord(domain, args.record_id as string);
            return `DNS record ${args.record_id} deleted from ${domain}`;
          }
        } catch {
          return `DNS management is not available in this deployment.`;
        }
        return `Unknown action: ${action}. Use list, add, or delete.`;
      },
    },
  ];
}
