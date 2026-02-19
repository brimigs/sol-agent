/**
 * Inference Client
 *
 * Wraps Anthropic and OpenAI APIs for LLM inference.
 * The agent pays for its own thinking through direct API keys.
 */
import type { InferenceClient } from "../types.js";
interface InferenceClientOptions {
    defaultModel: string;
    maxTokens: number;
    lowComputeModel?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
}
export declare function createInferenceClient(options: InferenceClientOptions): InferenceClient;
export {};
//# sourceMappingURL=inference.d.ts.map