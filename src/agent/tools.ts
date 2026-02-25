/**
 * Sol-Agent Tool System (Solana)
 *
 * Orchestrates all tool categories into createBuiltinTools().
 * Tool definitions live in ./tool-defs/ — this file owns the
 * self-preservation guard (isForbiddenCommand) which is protected
 * from agent modification by the PROTECTED_FILES list in self-mod/code.ts.
 *
 * NOTE on security: regex-based command filtering is defense-in-depth only.
 * A sufficiently clever shell command can bypass any pattern (variable
 * indirection, sub-shells, Python, etc.). The primary protection for critical
 * files is filesystem permissions and the isProtectedFile check in
 * self-mod/code.ts. These patterns catch common naive attempts and provide
 * a visible signal in the audit log.
 */

import type {
  AgentTool,
  ToolContext,
  InferenceToolDefinition,
  ToolCallResult,
} from "../types.js";
import { vmTools } from "./tool-defs/vm.js";
import { financialTools } from "./tool-defs/financial.js";
import { selfModTools } from "./tool-defs/self-mod.js";
import { survivalTools } from "./tool-defs/survival.js";
import { skillsTools } from "./tool-defs/skills.js";
import { registryTools } from "./tool-defs/registry-replication.js";

// ─── Self-Preservation Guard ───────────────────────────────────

const FORBIDDEN_COMMAND_PATTERNS = [
  // ── Critical file deletion ──
  /rm\s+.*\.sol-agent/,
  /rm\s+.*state\.db/,
  /rm\s+.*wallet\.json/,
  /rm\s+.*agent\.json/,
  /rm\s+.*heartbeat\.yml/,
  /rm\s+.*SOUL\.md/,
  // Catch "rm -- wallet.json" (end-of-options marker)
  /rm\s+--\s+.*wallet/,
  // ── Process termination ──
  /kill\s+.*agent/,
  /pkill\s+.*agent/,
  /killall\s+.*agent/,
  /systemctl\s+(stop|disable)\s+agent/,
  /supervisorctl\s+(stop|restart)\s+agent/,
  // ── Database destruction ──
  /DROP\s+TABLE/i,
  /DELETE\s+FROM\s+(turns|identity|kv|schema_version|skills|children|registry)/i,
  /TRUNCATE/i,
  // ── Safety file tampering (sed/awk overwrites) ──
  /sed\s+.*injection-defense/,
  /sed\s+.*self-mod\/code/,
  /sed\s+.*audit-log/,
  /awk\s+.*injection-defense/,
  /awk\s+.*self-mod\/code/,
  // ── Redirect-overwrites of safety files ──
  />\s*.*injection-defense/,
  />\s*.*self-mod\/code/,
  />\s*.*audit-log/,
  />\s*.*agent\/tools/,
  />\s*.*agent\/loop/,
  // ── Credential exposure ──
  /cat\s+.*\.ssh/,
  /cat\s+.*\.gnupg/,
  /cat\s+.*\.env/,
  /cat\s+.*wallet\.json/,
  // ── Python/Node file-deletion bypass attempts ──
  /python[23]?\s+.*os\.(remove|unlink|rmdir|rmtree)/,
  /node\s+.*fs\.(unlink|rmSync|rmdirSync)/,
];

function isForbiddenCommand(command: string, sandboxId: string): string | null {
  for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return `Blocked: Command matches self-harm pattern: ${pattern.source}`;
    }
  }
  if (command.includes("sandbox_delete") && command.includes(sandboxId)) {
    return "Blocked: Cannot delete own sandbox";
  }
  return null;
}

// ─── Built-in Tools ────────────────────────────────────────────

export function createBuiltinTools(sandboxId: string): AgentTool[] {
  // isForbiddenCommand is defined here (protected file) and passed into vmTools
  // so the guard cannot be bypassed by modifying a tool-defs category file.
  return [
    ...vmTools(isForbiddenCommand),
    ...financialTools(),
    ...selfModTools(),
    ...survivalTools(),
    ...skillsTools(),
    ...registryTools(),
  ];
}

export function toolsToInferenceFormat(tools: AgentTool[]): InferenceToolDefinition[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  tools: AgentTool[],
  context: ToolContext,
): Promise<ToolCallResult> {
  const tool = tools.find((t) => t.name === toolName);
  const startTime = Date.now();

  if (!tool) {
    return {
      id: `tc_${Date.now()}`,
      name: toolName,
      arguments: args,
      result: "",
      durationMs: 0,
      error: `Unknown tool: ${toolName}`,
    };
  }

  try {
    const result = await tool.execute(args, context);
    return {
      id: `tc_${Date.now()}`,
      name: toolName,
      arguments: args,
      result,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      id: `tc_${Date.now()}`,
      name: toolName,
      arguments: args,
      result: "",
      durationMs: Date.now() - startTime,
      error: err.message || String(err),
    };
  }
}
