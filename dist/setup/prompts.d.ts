export declare function promptRequired(label: string): Promise<string>;
export declare function promptOptional(label: string): Promise<string>;
export declare function promptMultiline(label: string): Promise<string>;
/**
 * Prompt for a Solana base58 public key address.
 * Validates that the input is a valid base58 string (32-44 chars, base58 alphabet).
 */
export declare function promptSolanaAddress(label: string): Promise<string>;
export declare function closePrompts(): void;
//# sourceMappingURL=prompts.d.ts.map