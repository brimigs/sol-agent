/**
 * x402 Protocol Client for Solana
 *
 * Implements the x402 HTTP payment protocol on Solana using SPL tokens (USDC).
 * https://solana.com/developers/guides/getstarted/intro-to-x402
 *
 * Protocol flow:
 * 1. Client makes initial request (no payment)
 * 2. Server responds 402 with PaymentRequirements
 * 3. Client builds and signs a Solana SPL transfer tx (does NOT broadcast)
 * 4. Signed tx is base64-encoded into the X-PAYMENT header
 * 5. Client retries with X-PAYMENT header
 * 6. Server validates, broadcasts the tx, confirms, then serves the resource
 *
 * The critical distinction from a direct transfer: the CLIENT signs but the
 * SERVER broadcasts the transaction.
 */
import { Connection, PublicKey, Transaction, } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, } from "@solana/spl-token";
import { getRpcUrl, USDC_DECIMALS } from "./usdc.js";
// ─── Network Mapping ───────────────────────────────────────────
/**
 * Map Solana network names to x402 network identifiers.
 * x402 uses: "solana" (mainnet-beta), "solana-devnet", "solana-testnet"
 */
export function toX402Network(network) {
    switch (network) {
        case "mainnet-beta": return "solana";
        case "devnet": return "solana-devnet";
        case "testnet": return "solana-testnet";
        default:
            // Allow pass-through if already in x402 format or CAIP-2
            return network.startsWith("solana") ? network : `solana-${network}`;
    }
}
// ─── Payment Requirements Parser ───────────────────────────────
/**
 * Parse x402 payment requirements from a 402 response.
 * Handles multiple server formats:
 * - Standard x402 spec (Coinbase): body.accepts[]
 * - Faremeter/Corbits format: body.payment
 * - x402 v2: PAYMENT-REQUIRED header (base64-encoded requirements)
 */
export function parsePaymentRequirements(body, paymentRequiredHeader) {
    // v2: Check PAYMENT-REQUIRED header first (highest priority)
    if (paymentRequiredHeader) {
        try {
            const decoded = JSON.parse(Buffer.from(paymentRequiredHeader, "base64").toString("utf-8"));
            const req = extractFromAccepts(decoded);
            if (req)
                return req;
        }
        catch { }
    }
    if (!body || typeof body !== "object")
        return null;
    const b = body;
    // Standard x402 spec: { x402Version, accepts: [...] }
    if (b.accepts && Array.isArray(b.accepts)) {
        const req = extractFromAccepts(b);
        if (req)
            return req;
    }
    // Faremeter/Corbits format: { payment: { recipientWallet, tokenAccount, mint, amount } }
    if (b.payment && typeof b.payment === "object") {
        return parseFaremeterFormat(b.payment);
    }
    // Some servers return requirements directly at top level
    if (b.scheme === "exact" && b.payTo) {
        return b;
    }
    return null;
}
function extractFromAccepts(obj) {
    const accepts = obj.accepts;
    if (!Array.isArray(accepts))
        return null;
    // Find first Solana exact-scheme requirement
    for (const item of accepts) {
        if (typeof item !== "object" || !item)
            continue;
        const req = item;
        if (req.scheme === "exact" &&
            typeof req.network === "string" &&
            req.network.startsWith("solana")) {
            return {
                scheme: "exact",
                network: req.network,
                maxAmountRequired: String(req.maxAmountRequired ?? "0"),
                payTo: req.payTo,
                asset: req.asset,
                tokenAccount: req.extra ? req.extra.tokenAccount : undefined,
                resource: req.resource,
                description: req.description,
                maxTimeoutSeconds: req.maxTimeoutSeconds,
            };
        }
    }
    return null;
}
function parseFaremeterFormat(p) {
    // Faremeter uses amount in atomic units OR amountUSDC in decimal
    const atomicAmount = p.amount
        ? String(p.amount)
        : String(Math.round(Number(p.amountUSDC ?? 0) * 10 ** USDC_DECIMALS));
    const cluster = p.cluster || "mainnet";
    const network = cluster === "devnet" ? "solana-devnet"
        : cluster === "testnet" ? "solana-testnet"
            : "solana";
    return {
        scheme: "exact",
        network,
        maxAmountRequired: atomicAmount,
        payTo: p.recipientWallet,
        asset: p.mint,
        tokenAccount: p.tokenAccount,
    };
}
// ─── Transaction Builder ────────────────────────────────────────
/**
 * Build and sign an SPL token transfer transaction for x402 payment.
 *
 * IMPORTANT: We sign but do NOT broadcast — the server broadcasts.
 * The serialized signed transaction goes in the X-PAYMENT header.
 */
async function buildSignedPaymentTx(keypair, requirements, connection) {
    const mint = new PublicKey(requirements.asset);
    const amount = BigInt(requirements.maxAmountRequired);
    // Sender's associated token account
    const senderAta = await getAssociatedTokenAddress(mint, keypair.publicKey);
    // Recipient's token account — server may provide it directly, or we derive it
    let recipientAta;
    if (requirements.tokenAccount) {
        recipientAta = new PublicKey(requirements.tokenAccount);
    }
    else {
        recipientAta = await getAssociatedTokenAddress(mint, new PublicKey(requirements.payTo));
    }
    const instructions = [];
    // Check if recipient ATA exists; if not, include creation instruction.
    // The server will broadcast the whole tx, creating the ATA atomically.
    const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
    if (!recipientAtaInfo) {
        instructions.push(createAssociatedTokenAccountInstruction(keypair.publicKey, // payer (us)
        recipientAta, // new ATA address
        new PublicKey(requirements.payTo), // owner of the ATA
        mint));
    }
    // SPL token transfer instruction
    instructions.push(createTransferInstruction(senderAta, recipientAta, keypair.publicKey, amount, [], TOKEN_PROGRAM_ID));
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({
        feePayer: keypair.publicKey,
        recentBlockhash: blockhash,
    });
    tx.add(...instructions);
    // Sign the transaction (client-side only; server broadcasts)
    tx.sign(keypair);
    // Serialize to binary and base64-encode
    return Buffer.from(tx.serialize()).toString("base64");
}
/**
 * Fetch a URL with automatic x402 Solana payment.
 *
 * Implements the full x402 protocol:
 * 1. Initial request → 402 response with PaymentRequirements
 * 2. Build + sign Solana SPL token transfer tx (client signs, server broadcasts)
 * 3. Retry with X-PAYMENT header containing base64-encoded signed tx
 * 4. Server verifies, broadcasts, confirms, serves the resource
 */
export async function x402Fetch(url, keypair, options = {}) {
    const { method = "GET", body, headers = {}, network = "mainnet-beta", rpcUrl, } = options;
    const connection = new Connection(getRpcUrl(network, rpcUrl), "confirmed");
    const baseHeaders = {
        "Content-Type": "application/json",
        ...headers,
    };
    try {
        // ── Phase 1: Initial request (no payment) ────────────────
        const resp1 = await fetch(url, { method, headers: baseHeaders, body });
        if (resp1.status !== 402) {
            const data = await resp1.json().catch(() => resp1.text());
            return { success: resp1.ok, response: data, status: resp1.status };
        }
        // ── Phase 2: Parse payment requirements ──────────────────
        const paymentRequiredHeader = resp1.headers.get("PAYMENT-REQUIRED") ??
            resp1.headers.get("payment-required") ??
            null;
        let bodyJson = null;
        try {
            bodyJson = await resp1.json();
        }
        catch { }
        const requirements = parsePaymentRequirements(bodyJson, paymentRequiredHeader);
        if (!requirements) {
            return {
                success: false,
                error: "x402: Could not parse payment requirements from 402 response",
                status: 402,
            };
        }
        // ── Phase 3: Build + sign Solana payment tx ──────────────
        // The tx is signed by the client but will be BROADCAST by the server.
        // Do not call connection.sendTransaction() here.
        let serializedTx;
        try {
            serializedTx = await buildSignedPaymentTx(keypair, requirements, connection);
        }
        catch (err) {
            return {
                success: false,
                error: `x402: Failed to build payment transaction: ${err.message}`,
                status: 402,
            };
        }
        // ── Phase 4: Encode X-PAYMENT header ─────────────────────
        const paymentPayload = {
            x402Version: 1,
            scheme: requirements.scheme,
            network: requirements.network,
            payload: { serializedTransaction: serializedTx },
        };
        const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
        // ── Phase 5: Retry with payment ───────────────────────────
        const resp2 = await fetch(url, {
            method,
            headers: {
                ...baseHeaders,
                "X-PAYMENT": xPaymentHeader,
            },
            body,
        });
        const data = await resp2.json().catch(() => resp2.text());
        // Extract settlement info from response header if present
        let txSignature;
        const paymentResponse = resp2.headers.get("X-PAYMENT-RESPONSE") ?? resp2.headers.get("PAYMENT-RESPONSE");
        if (paymentResponse) {
            try {
                const settlement = JSON.parse(Buffer.from(paymentResponse, "base64").toString("utf-8"));
                txSignature = settlement.txHash ?? settlement.txSignature ?? settlement.signature;
            }
            catch { }
        }
        return {
            success: resp2.ok,
            response: data,
            status: resp2.status,
            txSignature,
        };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
/**
 * Check if a URL requires x402 payment by making a probe request.
 * Returns the payment requirements if the endpoint is x402-gated, null otherwise.
 */
export async function probeX402(url) {
    try {
        const resp = await fetch(url, { method: "GET" });
        if (resp.status !== 402)
            return null;
        const paymentRequiredHeader = resp.headers.get("PAYMENT-REQUIRED") ??
            resp.headers.get("payment-required") ??
            null;
        let bodyJson = null;
        try {
            bodyJson = await resp.json();
        }
        catch { }
        return parsePaymentRequirements(bodyJson, paymentRequiredHeader);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=x402.js.map