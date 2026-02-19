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
import { promisify } from "util";
import { promises as fsp } from "fs";
import * as os from "os";
import * as path from "path";
import { getUsdcBalance } from "../solana/usdc.js";
const execAsync = promisify(cpExec);
const DOCKER_LABEL = "sol-agent-child=true";
export function createSolanaAgentClient(options) {
    function dockerHost() {
        const sock = options.dockerSocketPath || process.env.DOCKER_HOST;
        return sock ? `-H unix://${sock}` : "";
    }
    // ─── Own-container operations (child_process + fs) ────────────
    async function exec(command, timeout = 30_000) {
        try {
            const { stdout, stderr } = await execAsync(command, { timeout });
            return { stdout, stderr, exitCode: 0 };
        }
        catch (err) {
            return {
                stdout: err.stdout ?? "",
                stderr: err.stderr ?? err.message,
                exitCode: typeof err.code === "number" ? err.code : 1,
            };
        }
    }
    const writeFile = (filePath, content) => fsp.writeFile(filePath, content, "utf8");
    const readFile = (filePath) => fsp.readFile(filePath, "utf8");
    // ─── Child container operations (Docker CLI) ─────────────────
    async function createSandbox(createOptions) {
        const image = options.dockerImage ||
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
    async function deleteSandbox(sandboxId) {
        const h = dockerHost();
        await execAsync(`docker ${h} stop ${sandboxId}`, { timeout: 30_000 });
    }
    async function execInSandbox(sandboxId, command, timeout = 30_000) {
        const h = dockerHost();
        const escaped = command.replace(/'/g, "'\\''");
        const cmd = `docker ${h} exec ${sandboxId} sh -c '${escaped}'`;
        try {
            const { stdout, stderr } = await execAsync(cmd, { timeout });
            return { stdout, stderr, exitCode: 0 };
        }
        catch (err) {
            return {
                stdout: err.stdout ?? "",
                stderr: err.stderr ?? err.message,
                exitCode: typeof err.code === "number" ? err.code : 1,
            };
        }
    }
    async function writeFileToSandbox(sandboxId, filePath, content) {
        const h = dockerHost();
        const tmpFile = path.join(os.tmpdir(), `sol-agent-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
        try {
            await fsp.writeFile(tmpFile, content, "utf8");
            await execAsync(`docker ${h} cp ${tmpFile} ${sandboxId}:${filePath}`, {
                timeout: 30_000,
            });
        }
        finally {
            await fsp.unlink(tmpFile).catch(() => { });
        }
    }
    async function listSandboxes() {
        const h = dockerHost();
        try {
            const { stdout } = await execAsync(`docker ${h} ps --filter label=${DOCKER_LABEL} --format "{{.ID}}\t{{.Status}}\t{{.CreatedAt}}"`, { timeout: 10_000 });
            if (!stdout.trim())
                return [];
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
        }
        catch {
            return [];
        }
    }
    // ─── Port exposure (no-op — Docker handles at run time) ───────
    async function exposePort(port) {
        return {
            port,
            publicUrl: `http://localhost:${port}`,
            sandboxId: os.hostname(),
        };
    }
    const removePort = async (_port) => {
        // no-op for Docker
    };
    // ─── Credits: derived from on-chain USDC balance ─────────────
    async function getCreditsBalance() {
        const usdc = await getUsdcBalance(options.walletAddress, options.solanaNetwork, options.solanaRpcUrl);
        return Math.floor(usdc * 100);
    }
    const getCreditsPricing = async () => [];
    // ─── Unsupported operations ───────────────────────────────────
    const transferCredits = async (_toAddress, _amountCents, _note) => {
        throw new Error("Credit transfers are not available in the Docker agent client.");
    };
    const searchDomains = async (_query, _tlds) => {
        throw new Error("Domain search is not available in the Docker agent client.");
    };
    const registerDomain = async (_domain, _years) => {
        throw new Error("Domain registration is not available in the Docker agent client.");
    };
    const listDnsRecords = async (_domain) => {
        throw new Error("DNS management is not available in the Docker agent client.");
    };
    const addDnsRecord = async (_domain, _type, _host, _value, _ttl) => {
        throw new Error("DNS management is not available in the Docker agent client.");
    };
    const deleteDnsRecord = async (_domain, _recordId) => {
        throw new Error("DNS management is not available in the Docker agent client.");
    };
    // ─── Model discovery (hardcoded supported models) ─────────────
    const listModels = async () => [
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
//# sourceMappingURL=docker.js.map