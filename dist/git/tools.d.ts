/**
 * Git Tools
 *
 * Built-in git operations for the agent.
 * Used for both state versioning and code development.
 */
import type { SolanaAgentClient, GitStatus, GitLogEntry } from "../types.js";
/**
 * Get git status for a repository.
 */
export declare function gitStatus(agentClient: SolanaAgentClient, repoPath: string): Promise<GitStatus>;
/**
 * Get git diff output.
 */
export declare function gitDiff(agentClient: SolanaAgentClient, repoPath: string, staged?: boolean): Promise<string>;
/**
 * Create a git commit.
 */
export declare function gitCommit(agentClient: SolanaAgentClient, repoPath: string, message: string, addAll?: boolean): Promise<string>;
/**
 * Get git log.
 */
export declare function gitLog(agentClient: SolanaAgentClient, repoPath: string, limit?: number): Promise<GitLogEntry[]>;
/**
 * Push to remote.
 */
export declare function gitPush(agentClient: SolanaAgentClient, repoPath: string, remote?: string, branch?: string): Promise<string>;
/**
 * Manage branches.
 */
export declare function gitBranch(agentClient: SolanaAgentClient, repoPath: string, action: "list" | "create" | "checkout" | "delete", branchName?: string): Promise<string>;
/**
 * Clone a repository.
 */
export declare function gitClone(agentClient: SolanaAgentClient, url: string, targetPath: string, depth?: number): Promise<string>;
/**
 * Initialize a git repository.
 */
export declare function gitInit(agentClient: SolanaAgentClient, repoPath: string): Promise<string>;
//# sourceMappingURL=tools.d.ts.map