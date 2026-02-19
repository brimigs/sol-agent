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
import type { SolanaAgentClient } from "../types.js";
export declare function createSolanaAgentClient(options: {
    walletAddress: string;
    solanaNetwork: string;
    solanaRpcUrl?: string;
    /** Path to Docker socket. Defaults to /var/run/docker.sock */
    dockerSocketPath?: string;
    /** Docker image to use for child containers. Defaults to DOCKER_IMAGE env var or sol-agent:latest */
    dockerImage?: string;
}): SolanaAgentClient;
//# sourceMappingURL=docker.d.ts.map