/**
 * Sol-Automaton Tool System (Solana)
 *
 * Defines all tools the automaton can call.
 * Solana-native: replaces ERC-8004/x402 with Metaplex registry and SPL token payments.
 */
import type { AutomatonTool, ToolContext, InferenceToolDefinition, ToolCallResult } from "../types.js";
export declare function createBuiltinTools(sandboxId: string): AutomatonTool[];
export declare function toolsToInferenceFormat(tools: AutomatonTool[]): InferenceToolDefinition[];
export declare function executeTool(toolName: string, args: Record<string, unknown>, tools: AutomatonTool[], context: ToolContext): Promise<ToolCallResult>;
//# sourceMappingURL=tools.d.ts.map