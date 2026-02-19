/**
 * Docker Agent Client
 *
 * Implements SolanaAgentClient using the local Docker daemon and
 * Node.js child_process / fs for exec and file I/O.
 *
 * The agent runs inside its own Docker container; child containers are
 * managed via /var/run/docker.sock (or a configurable socket path).
 *
 * Credits balance is derived from on-chain USDC balance × 100 cents.
 * Domain management and credit transfers are not available.
 */

import { exec as cpExec } from "child_process";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { promises as fsp } from "fs";
import * as os from "os";
import * as path from "path";
import { getUsdcBalance } from "../solana/usdc.js";
import type {
  SolanaAgentClient,
  ExecResult,
  PortInfo,
  CreateSandboxOptions,
  SandboxInfo,
  PricingTier,
  CreditTransferResult,
  DomainSearchResult,
  DomainRegistration,
  DnsRecord,
  ModelInfo,
} from "../types.js";

const execAsync = promisify(cpExec);
const DOCKER_LABEL = "sol-agent-child=true";

/**
 * Verify that the Docker daemon is reachable before the agent starts.
 * Throws with a clear message if Docker is unavailable.
 */
export async function validateDockerConnection(options?: {
  dockerSocketPath?: string;
}): Promise<void> {
  const sock = options?.dockerSocketPath || process.env.DOCKER_HOST;
  const hostFlag = sock ? `-H unix://${sock}` : "";
  const cmd = `docker ${hostFlag} info --format "{{.ServerVersion}}"`.trim();
  try {
    const { stdout } = await execAsync(cmd, { timeout: 10_000 });
    if (!stdout.trim()) {
      throw new Error("docker info returned empty output");
    }
  } catch (err: any) {
    const hint = sock
      ? `socket path: ${sock}`
      : "default socket: /var/run/docker.sock";
    throw new Error(
      `Docker daemon is not reachable (${hint}). ` +
        `Ensure Docker is running and the socket is accessible.\n` +
        `Underlying error: ${err.message}`,
    );
  }
}

export function createSolanaAgentClient(options: {
  walletAddress: string;
  solanaNetwork: string;
  solanaRpcUrl?: string;
  /** Path to Docker socket. Defaults to /var/run/docker.sock */
  dockerSocketPath?: string;
  /** Docker image to use for child containers. Defaults to DOCKER_IMAGE env var or sol-agent:latest */
  dockerImage?: string;
}): SolanaAgentClient {
  function dockerHost(): string {
    const sock = options.dockerSocketPath || process.env.DOCKER_HOST;
    return sock ? `-H unix://${sock}` : "";
  }

  // ─── Own-container operations (child_process + fs) ────────────

  async function exec(command: string, timeout = 30_000): Promise<ExecResult> {
    try {
      const { stdout, stderr } = await execAsync(command, { timeout });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? err.message,
        exitCode: typeof err.code === "number" ? err.code : 1,
      };
    }
  }

  const writeFile = (filePath: string, content: string): Promise<void> =>
    fsp.writeFile(filePath, content, "utf8");

  const readFile = (filePath: string): Promise<string> =>
    fsp.readFile(filePath, "utf8");

  // ─── Child container operations (Docker CLI) ─────────────────

  async function createSandbox(
    createOptions: CreateSandboxOptions,
  ): Promise<SandboxInfo> {
    const image =
      options.dockerImage ||
      process.env.DOCKER_IMAGE ||
      "sol-agent:latest";

    const safeName = createOptions.name
      ? createOptions.name.replace(/[^a-zA-Z0-9_-]/g, "-")
      : "";
    const nameFlag = safeName ? `--name ${safeName}` : "";

    const h = dockerHost();
    const cmd = `docker ${h} run --rm -d --label ${DOCKER_LABEL} ${nameFlag} ${image}`.trim();
    const result = await execAsync(cmd, { timeout: 60_000 });
    const id = result.stdout.trim();

    return {
      id,
      status: "running",
      region: "",
      vcpu: createOptions.vcpu || 1,
      memoryMb: createOptions.memoryMb || 512,
      diskGb: createOptions.diskGb || 5,
      createdAt: new Date().toISOString(),
    };
  }

  async function deleteSandbox(sandboxId: string): Promise<void> {
    const h = dockerHost();
    await execAsync(`docker ${h} stop ${sandboxId}`, { timeout: 30_000 });
  }

  async function execInSandbox(
    sandboxId: string,
    command: string,
    timeout = 30_000,
  ): Promise<ExecResult> {
    const h = dockerHost();
    const escaped = command.replace(/'/g, "'\\''");
    const cmd = `docker ${h} exec ${sandboxId} sh -c '${escaped}'`;
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? err.message,
        exitCode: typeof err.code === "number" ? err.code : 1,
      };
    }
  }

  async function writeFileToSandbox(
    sandboxId: string,
    filePath: string,
    content: string,
  ): Promise<void> {
    const h = dockerHost();
    // crypto-random name avoids collisions across concurrent calls
    const tmpFile = path.join(os.tmpdir(), `sol-agent-${Date.now()}-${randomUUID()}.tmp`);

    // POSIX single-quote escaping for paths used in container shell commands.
    // execInSandbox wraps its argument with sh -c '...', so inner single
    // quotes must be escaped as '\'' .
    function sq(s: string): string {
      return "'" + s.replace(/'/g, "'\\''") + "'";
    }

    try {
      await fsp.writeFile(tmpFile, content, "utf8");
      const expectedBytes = Buffer.byteLength(content, "utf8");

      // Ensure the destination directory exists inside the container before
      // copying. docker cp fails if the parent directory is absent.
      const dir = path.posix.dirname(filePath);
      if (dir && dir !== ".") {
        await execInSandbox(sandboxId, `mkdir -p ${sq(dir)}`, 10_000);
      }

      // docker cp uses the Docker daemon API, not a shell pipe, so it handles
      // arbitrary content sizes without argument-length limits or base64
      // line-wrapping. Quote the destination to handle paths with spaces.
      const dest = `${sandboxId}:${filePath}`;
      await execAsync(
        `docker ${h} cp ${tmpFile} '${dest.replace(/'/g, "'\\''")}'`.trim(),
        { timeout: 30_000 },
      );

      // Integrity check: verify the container received the correct byte count.
      // wc -c with stdin redirect outputs only a number (no filename noise).
      const wcResult = await execInSandbox(
        sandboxId,
        `wc -c < ${sq(filePath)}`,
        10_000,
      );
      const actualBytes = parseInt(wcResult.stdout.trim(), 10);
      if (isNaN(actualBytes) || actualBytes !== expectedBytes) {
        throw new Error(
          `writeFileToSandbox: integrity check failed for ${filePath} ` +
            `(expected ${expectedBytes} bytes, got ${actualBytes} bytes)`,
        );
      }
    } finally {
      await fsp.unlink(tmpFile).catch(() => {});
    }
  }

  async function listSandboxes(): Promise<SandboxInfo[]> {
    const h = dockerHost();
    try {
      const { stdout } = await execAsync(
        `docker ${h} ps --filter label=${DOCKER_LABEL} --format "{{.ID}}\t{{.Status}}\t{{.CreatedAt}}"`,
        { timeout: 10_000 },
      );
      if (!stdout.trim()) return [];
      return stdout
        .trim()
        .split("\n")
        .map((line) => {
          const [id, status, createdAt] = line.split("\t");
          return {
            id: id || "",
            status: status || "unknown",
            region: "",
            vcpu: 0,
            memoryMb: 0,
            diskGb: 0,
            createdAt: createdAt || new Date().toISOString(),
          };
        });
    } catch {
      return [];
    }
  }

  // ─── Port exposure (no-op — Docker handles at run time) ───────

  async function exposePort(port: number): Promise<PortInfo> {
    return {
      port,
      publicUrl: `http://localhost:${port}`,
      sandboxId: os.hostname(),
    };
  }

  const removePort = async (_port: number): Promise<void> => {
    // no-op for Docker
  };

  // ─── Credits: derived from on-chain USDC balance ─────────────

  async function getCreditsBalance(): Promise<number> {
    const usdc = await getUsdcBalance(
      options.walletAddress,
      options.solanaNetwork as any,
      options.solanaRpcUrl,
    );
    return Math.floor(usdc * 100);
  }

  const getCreditsPricing = async (): Promise<PricingTier[]> => [];

  // ─── Unsupported operations ───────────────────────────────────

  const transferCredits = async (
    _toAddress: string,
    _amountCents: number,
    _note?: string,
  ): Promise<CreditTransferResult> => {
    throw new Error("Credit transfers are not available in the Docker agent client.");
  };

  const searchDomains = async (
    _query: string,
    _tlds?: string,
  ): Promise<DomainSearchResult[]> => {
    throw new Error("Domain search is not available in the Docker agent client.");
  };

  const registerDomain = async (
    _domain: string,
    _years?: number,
  ): Promise<DomainRegistration> => {
    throw new Error("Domain registration is not available in the Docker agent client.");
  };

  const listDnsRecords = async (_domain: string): Promise<DnsRecord[]> => {
    throw new Error("DNS management is not available in the Docker agent client.");
  };

  const addDnsRecord = async (
    _domain: string,
    _type: string,
    _host: string,
    _value: string,
    _ttl?: number,
  ): Promise<DnsRecord> => {
    throw new Error("DNS management is not available in the Docker agent client.");
  };

  const deleteDnsRecord = async (
    _domain: string,
    _recordId: string,
  ): Promise<void> => {
    throw new Error("DNS management is not available in the Docker agent client.");
  };

  // ─── Model discovery (hardcoded supported models) ─────────────

  const listModels = async (): Promise<ModelInfo[]> => [
    {
      id: "claude-sonnet-4-6",
      provider: "anthropic",
      pricing: { inputPerMillion: 3, outputPerMillion: 15 },
    },
    {
      id: "claude-opus-4-6",
      provider: "anthropic",
      pricing: { inputPerMillion: 15, outputPerMillion: 75 },
    },
    {
      id: "claude-haiku-4-5",
      provider: "anthropic",
      pricing: { inputPerMillion: 0.8, outputPerMillion: 4 },
    },
    {
      id: "gpt-4o",
      provider: "openai",
      pricing: { inputPerMillion: 2.5, outputPerMillion: 10 },
    },
    {
      id: "gpt-4o-mini",
      provider: "openai",
      pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
    },
    {
      id: "gpt-4.1",
      provider: "openai",
      pricing: { inputPerMillion: 2, outputPerMillion: 8 },
    },
  ];

  return {
    exec,
    writeFile,
    readFile,
    execInSandbox,
    writeFileToSandbox,
    exposePort,
    removePort,
    createSandbox,
    deleteSandbox,
    listSandboxes,
    getCreditsBalance,
    getCreditsPricing,
    transferCredits,
    searchDomains,
    registerDomain,
    listDnsRecords,
    addDnsRecord,
    deleteDnsRecord,
    listModels,
  };
}
