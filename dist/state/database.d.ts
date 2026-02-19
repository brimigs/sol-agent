/**
 * Sol-Agent Database
 *
 * SQLite-backed persistent state for the Solana agent.
 * Uses better-sqlite3 for synchronous, single-process access.
 * Updated for Solana: asset_address + tx_signature in registry.
 */
import type { AgentDatabase } from "../types.js";
export declare function createDatabase(dbPath: string): AgentDatabase;
//# sourceMappingURL=database.d.ts.map