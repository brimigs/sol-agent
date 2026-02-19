import { describe, it, expect, beforeEach, vi } from "vitest";
import { createBuiltinTools } from "../../agent/tools.js";
import type { ToolContext } from "../../types.js";

const SANDBOX_ID = "test-sandbox-abc123";

const mockExec = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });
const mockWriteFile = vi.fn().mockResolvedValue(undefined);

const mockCtx = {
  identity: { sandboxId: SANDBOX_ID } as ToolContext["identity"],
  agentClient: { exec: mockExec, writeFile: mockWriteFile } as unknown as ToolContext["agentClient"],
  config: {} as ToolContext["config"],
  db: {} as ToolContext["db"],
  inference: {} as ToolContext["inference"],
} as ToolContext;

let execTool: ReturnType<typeof createBuiltinTools>[number];
let writeFileTool: ReturnType<typeof createBuiltinTools>[number];

beforeEach(() => {
  mockExec.mockClear();
  mockWriteFile.mockClear();
  const tools = createBuiltinTools(SANDBOX_ID);
  const foundExec = tools.find((t) => t.name === "exec");
  if (!foundExec) throw new Error("exec tool not found");
  execTool = foundExec;
  const foundWrite = tools.find((t) => t.name === "write_file");
  if (!foundWrite) throw new Error("write_file tool not found");
  writeFileTool = foundWrite;
});

describe("exec tool – forbidden commands (self-preservation guard)", () => {
  it("blocks: rm -rf ~/.sol-agent", async () => {
    const result = await execTool.execute({ command: "rm -rf ~/.sol-agent" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: rm -rf state.db", async () => {
    const result = await execTool.execute({ command: "rm -rf state.db" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: cat wallet.json", async () => {
    const result = await execTool.execute({ command: "cat wallet.json" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: cat .env", async () => {
    const result = await execTool.execute({ command: "cat .env" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: DROP TABLE", async () => {
    const result = await execTool.execute({ command: "DROP TABLE users" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: DELETE FROM turns", async () => {
    const result = await execTool.execute(
      { command: "DELETE FROM turns WHERE id = '1'" },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: kill agent", async () => {
    const result = await execTool.execute({ command: "kill agent" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: pkill agent", async () => {
    const result = await execTool.execute({ command: "pkill agent" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: TRUNCATE", async () => {
    const result = await execTool.execute({ command: "TRUNCATE TABLE turns" }, mockCtx);
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("blocks: sandbox_delete with own sandboxId", async () => {
    const result = await execTool.execute(
      { command: `sandbox_delete ${SANDBOX_ID}` },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockExec).not.toHaveBeenCalled();
  });
});

describe("exec tool – allowed commands", () => {
  it("allows: ls", async () => {
    const result = await execTool.execute({ command: "ls" }, mockCtx);
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockExec).toHaveBeenCalledWith("ls", 30_000);
  });

  it("allows: node --version", async () => {
    const result = await execTool.execute({ command: "node --version" }, mockCtx);
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockExec).toHaveBeenCalledWith("node --version", 30_000);
  });

  it("allows: echo hello", async () => {
    const result = await execTool.execute({ command: "echo hello" }, mockCtx);
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockExec).toHaveBeenCalledWith("echo hello", 30_000);
  });

  it("allows: rm -rf /tmp/work (not a protected path)", async () => {
    const result = await execTool.execute({ command: "rm -rf /tmp/work" }, mockCtx);
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockExec).toHaveBeenCalledWith("rm -rf /tmp/work", 30_000);
  });

  it("allows: sandbox_delete with a different sandboxId", async () => {
    const result = await execTool.execute(
      { command: "sandbox_delete other-sandbox-xyz" },
      mockCtx,
    );
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockExec).toHaveBeenCalled();
  });
});

describe("exec tool – timeout validation", () => {
  it("uses default 30s when timeout is omitted", async () => {
    await execTool.execute({ command: "ls" }, mockCtx);
    expect(mockExec).toHaveBeenCalledWith("ls", 30_000);
  });

  it("uses default 30s when timeout is 0 (falsy but invalid)", async () => {
    await execTool.execute({ command: "ls", timeout: 0 }, mockCtx);
    expect(mockExec).toHaveBeenCalledWith("ls", 30_000);
  });

  it("uses default 30s when timeout is negative", async () => {
    await execTool.execute({ command: "ls", timeout: -1 }, mockCtx);
    expect(mockExec).toHaveBeenCalledWith("ls", 30_000);
  });

  it("uses default 30s when timeout is below minimum (999ms)", async () => {
    await execTool.execute({ command: "ls", timeout: 999 }, mockCtx);
    expect(mockExec).toHaveBeenCalledWith("ls", 30_000);
  });

  it("passes through a valid timeout of 10000ms", async () => {
    await execTool.execute({ command: "ls", timeout: 10_000 }, mockCtx);
    expect(mockExec).toHaveBeenCalledWith("ls", 10_000);
  });

  it("clamps timeout to 300000ms maximum", async () => {
    await execTool.execute({ command: "ls", timeout: 999_999 }, mockCtx);
    expect(mockExec).toHaveBeenCalledWith("ls", 300_000);
  });

  it("accepts exactly the minimum (1000ms)", async () => {
    await execTool.execute({ command: "ls", timeout: 1_000 }, mockCtx);
    expect(mockExec).toHaveBeenCalledWith("ls", 1_000);
  });

  it("accepts exactly the maximum (300000ms)", async () => {
    await execTool.execute({ command: "ls", timeout: 300_000 }, mockCtx);
    expect(mockExec).toHaveBeenCalledWith("ls", 300_000);
  });
});

describe("write_file tool – protected path guard (isProtectedFile)", () => {
  it("blocks: wallet.json (direct name)", async () => {
    const result = await writeFileTool.execute(
      { path: "wallet.json", content: "evil" },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("blocks: ./wallet.json (relative path)", async () => {
    const result = await writeFileTool.execute(
      { path: "./wallet.json", content: "evil" },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("blocks: /root/.sol-agent/wallet.json (absolute path)", async () => {
    const result = await writeFileTool.execute(
      { path: "/root/.sol-agent/wallet.json", content: "evil" },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("blocks: state.db", async () => {
    const result = await writeFileTool.execute(
      { path: "state.db", content: "evil" },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("blocks: constitution.md", async () => {
    const result = await writeFileTool.execute(
      { path: "constitution.md", content: "evil" },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("blocks: path containing .ssh", async () => {
    const result = await writeFileTool.execute(
      { path: "/root/.ssh/authorized_keys", content: "evil" },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("allows: /tmp/output.txt (unprotected path)", async () => {
    const result = await writeFileTool.execute(
      { path: "/tmp/output.txt", content: "safe" },
      mockCtx,
    );
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockWriteFile).toHaveBeenCalledWith("/tmp/output.txt", "safe");
  });

  it("allows: /root/myapp/index.js (unprotected path)", async () => {
    const result = await writeFileTool.execute(
      { path: "/root/myapp/index.js", content: "console.log('hi')" },
      mockCtx,
    );
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockWriteFile).toHaveBeenCalledWith("/root/myapp/index.js", "console.log('hi')");
  });

  it("allows: a file inside a directory that happens to be named 'state.db'", async () => {
    // old substring .includes() match would have blocked this (false positive);
    // the new check uses path-boundary matching so only the file itself is protected
    const result = await writeFileTool.execute(
      { path: "/tmp/state.db/output.txt", content: "data" },
      mockCtx,
    );
    expect(result).not.toMatch(/^Blocked:/);
    expect(mockWriteFile).toHaveBeenCalledWith("/tmp/state.db/output.txt", "data");
  });

  it("still blocks the actual state.db file", async () => {
    const result = await writeFileTool.execute(
      { path: "/root/.sol-agent/state.db", content: "evil" },
      mockCtx,
    );
    expect(result).toMatch(/^Blocked:/);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
