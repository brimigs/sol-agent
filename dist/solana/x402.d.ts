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
import { Keypair } from "@solana/web3.js";
/**
 * Standard x402 PaymentRequirements (Coinbase spec).
 * Parsed from the 402 response body or PAYMENT-REQUIRED header.
 */
export interface X402PaymentRequirements {
    scheme: "exact";
    network: string;
    maxAmountRequired: string;
    payTo: string;
    asset: string;
    tokenAccount?: string;
    resource?: string;
    description?: string;
    maxTimeoutSeconds?: number;
}
/**
 * Map Solana network names to x402 network identifiers.
 * x402 uses: "solana" (mainnet-beta), "solana-devnet", "solana-testnet"
 */
export declare function toX402Network(network: string): string;
/**
 * Parse x402 payment requirements from a 402 response.
 * Handles multiple server formats:
 * - Standard x402 spec (Coinbase): body.accepts[]
 * - Faremeter/Corbits format: body.payment
 * - x402 v2: PAYMENT-REQUIRED header (base64-encoded requirements)
 */
export declare function parsePaymentRequirements(body: unknown, paymentRequiredHeader?: string | null): X402PaymentRequirements | null;
export interface X402FetchResult {
    success: boolean;
    response?: unknown;
    error?: string;
    status?: number;
    txSignature?: string;
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
export declare function x402Fetch(url: string, keypair: Keypair, options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    network?: string;
    rpcUrl?: string;
}): Promise<X402FetchResult>;
/**
 * Check if a URL requires x402 payment by making a probe request.
 * Returns the payment requirements if the endpoint is x402-gated, null otherwise.
 */
export declare function probeX402(url: string): Promise<X402PaymentRequirements | null>;
//# sourceMappingURL=x402.d.ts.map