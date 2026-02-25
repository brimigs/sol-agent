/**
 * VM / Sandbox Tool Definitions
 *
 * Tools for executing commands, reading/writing files, and managing
 * child Docker containers.
 */

import type { AgentTool } from "../../types.js";
import { isProtectedFile } from "../../self-mod/code.js";

export function vmTools(isForbiddenCommand: (cmd: string, sandboxId: string) => string | null): AgentTool[] {
  return [
    {
      name: "exec",
      description: "Execute a shell command in your sandbox. Returns stdout, stderr, and exit code.",
      category: "vm",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to execute" },
          timeout: { type: "number", description: "Timeout in milliseconds (default: 30000, min: 1000, max: 300000)" },
        },
        required: ["command"],
      },
      execute: async (args, ctx) => {
        const command = args.command as string;
        const forbidden = isForbiddenCommand(command, ctx.identity.sandboxId);
        if (forbidden) return forbidden;
        const rawTimeout = args.timeout as number | undefined;
        const timeout =
          typeof rawTimeout === "number" && Number.isFinite(rawTimeout) && rawTimeout >= 1000
            ? Math.min(rawTimeout, 300_000)
            : 30_000;
        const result = await ctx.agentClient.exec(command, timeout);
        return `exit_code: ${result.exitCode}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;
      },
    },
    {
      name: "write_file",
      description: "Write content to a file in your sandbox.",
      category: "vm",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          content: { type: "string", description: "File content" },
        },
        required: ["path", "content"],
      },
      execute: async (args, ctx) => {
        const filePath = args.path as string;
        if (isProtectedFile(filePath)) {
          return "Blocked: Cannot overwrite protected file";
        }
        await ctx.agentClient.writeFile(filePath, args.content as string);
        return `File written: ${filePath}`;
      },
    },
    {
      name: "read_file",
      description: "Read content from a file in your sandbox.",
      category: "vm",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "File path to read" } },
        required: ["path"],
      },
      execute: async (args, ctx) => {
        return await ctx.agentClient.readFile(args.path as string);
      },
    },
    {
      name: "expose_port",
      description: "Expose a port from your sandbox to the internet. Returns a public URL.",
      category: "vm",
      parameters: {
        type: "object",
        properties: { port: { type: "number", description: "Port number to expose" } },
        required: ["port"],
      },
      execute: async (args, ctx) => {
        const info = await ctx.agentClient.exposePort(args.port as number);
        return `Port ${info.port} exposed at: ${info.publicUrl}`;
      },
    },
    {
      name: "remove_port",
      description: "Remove a previously exposed port.",
      category: "vm",
      parameters: {
        type: "object",
        properties: { port: { type: "number", description: "Port number to remove" } },
        required: ["port"],
      },
      execute: async (args, ctx) => {
        await ctx.agentClient.removePort(args.port as number);
        return `Port ${args.port} removed`;
      },
    },
    {
      name: "create_sandbox",
      description: "Create a new Docker container (separate VM) for sub-tasks or testing.",
      category: "agent",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Sandbox name" },
          vcpu: { type: "number", description: "vCPUs (default: 1)" },
          memory_mb: { type: "number", description: "Memory in MB (default: 512)" },
          disk_gb: { type: "number", description: "Disk in GB (default: 5)" },
        },
      },
      execute: async (args, ctx) => {
        const info = await ctx.agentClient.createSandbox({
          name: args.name as string,
          vcpu: args.vcpu as number,
          memoryMb: args.memory_mb as number,
          diskGb: args.disk_gb as number,
        });
        return `Sandbox created: ${info.id} (${info.vcpu} vCPU, ${info.memoryMb}MB RAM)`;
      },
    },
    {
      name: "delete_sandbox",
      description: "Delete a sandbox. Cannot delete your own sandbox.",
      category: "agent",
      dangerous: true,
      parameters: {
        type: "object",
        properties: {
          sandbox_id: { type: "string", description: "ID of sandbox to delete" },
        },
        required: ["sandbox_id"],
      },
      execute: async (args, ctx) => {
        const targetId = args.sandbox_id as string;
        if (targetId === ctx.identity.sandboxId) {
          return "Blocked: Cannot delete your own sandbox. Self-preservation overrides this request.";
        }
        await ctx.agentClient.deleteSandbox(targetId);
        return `Sandbox ${targetId} deleted`;
      },
    },
    {
      name: "list_sandboxes",
      description: "List all your sandboxes.",
      category: "agent",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const sandboxes = await ctx.agentClient.listSandboxes();
        if (sandboxes.length === 0) return "No sandboxes found.";
        return sandboxes
          .map((s) => `${s.id} [${s.status}] ${s.vcpu}vCPU/${s.memoryMb}MB ${s.region}`)
          .join("\n");
      },
    },
  ];
}
