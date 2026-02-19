/**
 * Sol-Agent Tool System (Solana)
 *
 * Defines all tools the agent can call.
 * Solana-native: replaces ERC-8004/x402 with Metaplex registry and SPL token payments.
 */
import type { AgentTool, ToolContext, InferenceToolDefinition, ToolCallResult } from "../types.js";
export declare function createBuiltinTools(sandboxId: string): AgentTool[];
export declare function toolsToInferenceFormat(tools: AgentTool[]): InferenceToolDefinition[];
export declare function executeTool(toolName: string, args: Record<string, unknown>, tools: AgentTool[], context: ToolContext): Promise<ToolCallResult>;
//# sourceMappingURL=tools.d.ts.map