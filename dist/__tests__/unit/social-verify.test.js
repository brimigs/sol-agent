/**
 * Tests for verifyMessageSignature in social/client.ts
 *
 * Uses a real tweetnacl keypair so every test exercises the actual
 * cryptographic path — no mocking of the crypto primitives.
 */
import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createHash } from "crypto";
import { verifyMessageSignature } from "../../social/client.js";
// ─── Helpers ──────────────────────────────────────────────────────
function hashContent(content) {
    return createHash("sha256").update(content).digest("hex");
}
function makeSignature(keypair, to, content, signedAt) {
    const canonical = `sol-agent:send:${to}:${hashContent(content)}:${signedAt}`;
    const sig = nacl.sign.detached(new TextEncoder().encode(canonical), keypair.secretKey);
    return bs58.encode(sig);
}
// Generate a stable keypair for tests
const senderKeypair = nacl.sign.keyPair();
const senderAddress = bs58.encode(senderKeypair.publicKey);
const recipientAddress = bs58.encode(nacl.sign.keyPair().publicKey);
const SIGNED_AT = "2025-01-01T00:00:00.000Z";
const CONTENT = "Hello from the other side";
// ─── Tests ────────────────────────────────────────────────────────
describe("verifyMessageSignature – valid signatures", () => {
    it("accepts a correctly signed message", () => {
        const signature = makeSignature(senderKeypair, recipientAddress, CONTENT, SIGNED_AT);
        expect(verifyMessageSignature({
            from: senderAddress,
            to: recipientAddress,
            content: CONTENT,
            signedAt: SIGNED_AT,
            signature,
        })).toBe(true);
    });
    it("accepts messages with different content lengths", () => {
        const longContent = "x".repeat(10_000);
        const signature = makeSignature(senderKeypair, recipientAddress, longContent, SIGNED_AT);
        expect(verifyMessageSignature({
            from: senderAddress,
            to: recipientAddress,
            content: longContent,
            signedAt: SIGNED_AT,
            signature,
        })).toBe(true);
    });
});
describe("verifyMessageSignature – tampered messages", () => {
    it("rejects a message with modified content", () => {
        const signature = makeSignature(senderKeypair, recipientAddress, CONTENT, SIGNED_AT);
        expect(verifyMessageSignature({
            from: senderAddress,
            to: recipientAddress,
            content: CONTENT + " (tampered)",
            signedAt: SIGNED_AT,
            signature,
        })).toBe(false);
    });
    it("rejects a message with a different 'to' address", () => {
        const otherRecipient = bs58.encode(nacl.sign.keyPair().publicKey);
        const signature = makeSignature(senderKeypair, recipientAddress, CONTENT, SIGNED_AT);
        expect(verifyMessageSignature({
            from: senderAddress,
            to: otherRecipient, // relay swapped the recipient
            content: CONTENT,
            signedAt: SIGNED_AT,
            signature,
        })).toBe(false);
    });
    it("rejects a message with a modified signedAt timestamp", () => {
        const signature = makeSignature(senderKeypair, recipientAddress, CONTENT, SIGNED_AT);
        expect(verifyMessageSignature({
            from: senderAddress,
            to: recipientAddress,
            content: CONTENT,
            signedAt: "2099-12-31T23:59:59.000Z", // relay changed the timestamp
            signature,
        })).toBe(false);
    });
    it("rejects a message claiming a different 'from' address (relay spoofing)", () => {
        const attacker = nacl.sign.keyPair();
        const attackerAddress = bs58.encode(attacker.publicKey);
        // Attacker signs the message with their own key
        const signature = makeSignature(attacker, recipientAddress, CONTENT, SIGNED_AT);
        // But relay claims it came from the legitimate sender
        expect(verifyMessageSignature({
            from: senderAddress, // lie: relay says it's from senderAddress
            to: recipientAddress,
            content: CONTENT,
            signedAt: SIGNED_AT,
            signature, // but signature was made with attacker's key
        })).toBe(false);
        // The same message verifies fine when `from` is the actual signer
        expect(verifyMessageSignature({
            from: attackerAddress,
            to: recipientAddress,
            content: CONTENT,
            signedAt: SIGNED_AT,
            signature,
        })).toBe(true);
    });
});
describe("verifyMessageSignature – malformed inputs", () => {
    it("returns false for a garbage signature string", () => {
        expect(verifyMessageSignature({
            from: senderAddress,
            to: recipientAddress,
            content: CONTENT,
            signedAt: SIGNED_AT,
            signature: "notavalidsignature!!!",
        })).toBe(false);
    });
    it("returns false for an invalid 'from' address", () => {
        const signature = makeSignature(senderKeypair, recipientAddress, CONTENT, SIGNED_AT);
        expect(verifyMessageSignature({
            from: "not-a-valid-base58-pubkey!!!",
            to: recipientAddress,
            content: CONTENT,
            signedAt: SIGNED_AT,
            signature,
        })).toBe(false);
    });
    it("returns false for an empty signature", () => {
        expect(verifyMessageSignature({
            from: senderAddress,
            to: recipientAddress,
            content: CONTENT,
            signedAt: SIGNED_AT,
            signature: "",
        })).toBe(false);
    });
});
//# sourceMappingURL=social-verify.test.js.map