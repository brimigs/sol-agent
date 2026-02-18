/**
 * Sol-Automaton Social Client
 *
 * Creates a SocialClient for the automaton runtime using Solana ed25519 signing.
 * Replaces viem EVM signing with tweetnacl ed25519.
 */

import nacl from "tweetnacl";
import bs58 from "bs58";
import { createHash } from "crypto";
import type { Keypair } from "@solana/web3.js";
import type { SocialClientInterface, InboxMessage } from "../types.js";

/**
 * Create a SocialClient wired to the agent's Solana keypair.
 */
export function createSocialClient(
  relayUrl: string,
  keypair: Keypair,
): SocialClientInterface {
  const baseUrl = relayUrl.replace(/\/$/, "");
  const address = keypair.publicKey.toBase58();

  function sign(message: string): string {
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    return bs58.encode(signature);
  }

  function hash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  return {
    send: async (
      to: string,
      content: string,
      replyTo?: string,
    ): Promise<{ id: string }> => {
      const signedAt = new Date().toISOString();
      const contentHash = hash(content);
      const canonical = `sol-automaton:send:${to}:${contentHash}:${signedAt}`;
      const signature = sign(canonical);

      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: address,
          to,
          content,
          signature,
          signed_at: signedAt,
          reply_to: replyTo,
          chain: "solana",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(
          `Send failed (${res.status}): ${(err as any).error || res.statusText}`,
        );
      }

      const data = (await res.json()) as { id: string };
      return { id: data.id };
    },

    poll: async (
      cursor?: string,
      limit?: number,
    ): Promise<{ messages: InboxMessage[]; nextCursor?: string }> => {
      const timestamp = new Date().toISOString();
      const canonical = `sol-automaton:poll:${address}:${timestamp}`;
      const signature = sign(canonical);

      const res = await fetch(`${baseUrl}/v1/messages/poll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Address": address,
          "X-Signature": signature,
          "X-Timestamp": timestamp,
          "X-Chain": "solana",
        },
        body: JSON.stringify({ cursor, limit }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(
          `Poll failed (${res.status}): ${(err as any).error || res.statusText}`,
        );
      }

      const data = (await res.json()) as {
        messages: Array<{
          id: string;
          from: string;
          to: string;
          content: string;
          signedAt: string;
          createdAt: string;
          replyTo?: string;
        }>;
        next_cursor?: string;
      };

      return {
        messages: data.messages.map((m) => ({
          id: m.id,
          from: m.from,
          to: m.to,
          content: m.content,
          signedAt: m.signedAt,
          createdAt: m.createdAt,
          replyTo: m.replyTo,
        })),
        nextCursor: data.next_cursor,
      };
    },

    unreadCount: async (): Promise<number> => {
      const timestamp = new Date().toISOString();
      const canonical = `sol-automaton:poll:${address}:${timestamp}`;
      const signature = sign(canonical);

      const res = await fetch(`${baseUrl}/v1/messages/count`, {
        method: "GET",
        headers: {
          "X-Wallet-Address": address,
          "X-Signature": signature,
          "X-Timestamp": timestamp,
          "X-Chain": "solana",
        },
      });

      if (!res.ok) return 0;
      const data = (await res.json()) as { unread: number };
      return data.unread;
    },
  };
}
