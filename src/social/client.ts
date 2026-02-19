/**
 * Sol-Agent Social Client
 *
 * Creates a SocialClient for the agent runtime using Solana ed25519 signing.
 * Replaces viem EVM signing with tweetnacl ed25519.
 */

import nacl from "tweetnacl";
import bs58 from "bs58";
import { createHash } from "crypto";
import type { Keypair } from "@solana/web3.js";
import type { SocialClientInterface, InboxMessage } from "../types.js";

/**
 * Verify a message's ed25519 signature against the claimed sender address.
 *
 * The canonical signed string is identical to what the sender constructs in send():
 *   sol-agent:send:<to>:<sha256(content) hex>:<signedAt>
 *
 * Returns true only when the signature is cryptographically valid for the
 * given `from` public key. Returns false if the signature is malformed, the
 * public key is invalid, or verification fails.
 */
export function verifyMessageSignature(msg: {
  from: string;
  to: string;
  content: string;
  signedAt: string;
  signature: string;
}): boolean {
  try {
    const contentHash = createHash("sha256").update(msg.content).digest("hex");
    const canonical = `sol-agent:send:${msg.to}:${contentHash}:${msg.signedAt}`;
    const messageBytes = new TextEncoder().encode(canonical);
    const signatureBytes = bs58.decode(msg.signature);
    const publicKeyBytes = bs58.decode(msg.from);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

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
      const canonical = `sol-agent:send:${to}:${contentHash}:${signedAt}`;
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
      const canonical = `sol-agent:poll:${address}:${timestamp}`;
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
          signature?: string;
        }>;
        next_cursor?: string;
      };

      const verified: InboxMessage[] = [];
      for (const m of data.messages) {
        if (m.signature) {
          const valid = verifyMessageSignature({
            from: m.from,
            to: m.to,
            content: m.content,
            signedAt: m.signedAt,
            signature: m.signature,
          });
          if (!valid) {
            // Relay returned a message whose signature does not match the
            // claimed sender. Drop it entirely — this is either relay tampering
            // or message corruption.
            console.warn(
              `[social] Dropping message ${m.id}: invalid signature for sender ${m.from}`,
            );
            continue;
          }
          verified.push({
            id: m.id, from: m.from, to: m.to, content: m.content,
            signedAt: m.signedAt, createdAt: m.createdAt, replyTo: m.replyTo,
            signature: m.signature, verified: true,
          });
        } else {
          // No signature — relay did not forward one (older relay version or
          // non-agent sender). Accept but mark as unverified so downstream
          // code can treat it with appropriate caution.
          verified.push({
            id: m.id, from: m.from, to: m.to, content: m.content,
            signedAt: m.signedAt, createdAt: m.createdAt, replyTo: m.replyTo,
            verified: false,
          });
        }
      }

      return {
        messages: verified,
        nextCursor: data.next_cursor,
      };
    },

    unreadCount: async (): Promise<number> => {
      const timestamp = new Date().toISOString();
      const canonical = `sol-agent:poll:${address}:${timestamp}`;
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
