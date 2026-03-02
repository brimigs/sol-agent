/**
 * Social Tool Definitions
 *
 * First-class tools for agent-to-agent communication via the social relay.
 * Messages are ed25519-signed and verified end-to-end.
 */

import type { AgentTool } from "../../types.js";

export function socialTools(): AgentTool[] {
  return [
    {
      name: "send_message",
      description:
        "Send a signed message to another agent or address via the social relay. Messages are ed25519-signed with your Solana keypair.",
      category: "social",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Recipient's Solana address (base58)",
          },
          content: {
            type: "string",
            description: "Message content",
          },
          reply_to: {
            type: "string",
            description: "Message ID to reply to (optional)",
          },
        },
        required: ["to", "content"],
      },
      execute: async (args, ctx) => {
        if (!ctx.social) {
          return "Social relay not configured. Add socialRelayUrl to your config to enable messaging.";
        }
        const to = args.to as string;
        const content = args.content as string;
        const replyTo = args.reply_to as string | undefined;
        try {
          const result = await ctx.social.send(to, content, replyTo);
          ctx.db.setKV("last_message_sent", new Date().toISOString());
          return `Message sent (id: ${result.id}) to ${to}`;
        } catch (err: any) {
          return `Failed to send message: ${err.message}`;
        }
      },
    },
    {
      name: "read_inbox",
      description:
        "Read unprocessed messages from your inbox. Returns messages sorted oldest-first. Messages are verified against sender signatures.",
      category: "social",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of messages to return (default 10, max 50)",
          },
          mark_read: {
            type: "boolean",
            description: "Mark returned messages as processed (default true)",
          },
        },
      },
      execute: async (args, ctx) => {
        const limit = Math.min(Math.max(1, (args.limit as number) || 10), 50);
        const markRead = (args.mark_read as boolean) !== false;

        const messages = ctx.db.getUnprocessedInboxMessages(limit);
        if (messages.length === 0) return "Inbox is empty.";

        const lines: string[] = [`${messages.length} message(s):`];
        for (const m of messages) {
          const verifiedTag = m.verified === false ? " [UNVERIFIED]" : " [verified]";
          lines.push(
            `\n--- from ${m.from}${verifiedTag} at ${m.signedAt || m.createdAt} ---\n${m.content}`,
          );
          if (markRead) {
            ctx.db.markInboxMessageProcessed(m.id);
          }
        }
        return lines.join("\n");
      },
    },
    {
      name: "poll_inbox",
      description:
        "Poll the social relay for new messages and store them in the local inbox database.",
      category: "social",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum messages to fetch per poll (default 20)",
          },
        },
      },
      execute: async (args, ctx) => {
        if (!ctx.social) {
          return "Social relay not configured. Add socialRelayUrl to your config.";
        }
        const limit = Math.min(Math.max(1, (args.limit as number) || 20), 100);
        try {
          const cursor = ctx.db.getKV("social_cursor") || undefined;
          const { messages, nextCursor } = await ctx.social.poll(cursor, limit);

          if (messages.length === 0) {
            return "No new messages.";
          }

          // Store messages in local inbox
          const { ulid } = await import("ulid");
          const selfAddress = ctx.identity.address;
          for (const m of messages) {
            ctx.db.insertInboxMessage({
              id: m.id || ulid(),
              from: m.from,
              to: m.to || selfAddress,
              content: m.content,
              signedAt: m.signedAt,
              createdAt: m.createdAt,
              replyTo: m.replyTo,
              signature: m.signature,
              verified: m.verified,
            });
          }

          if (nextCursor) {
            ctx.db.setKV("social_cursor", nextCursor);
          }

          return `Fetched ${messages.length} new message(s) into inbox.`;
        } catch (err: any) {
          return `Poll failed: ${err.message}`;
        }
      },
    },
  ];
}
