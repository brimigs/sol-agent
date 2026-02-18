/**
 * Sol-Automaton Database
 *
 * SQLite-backed persistent state for the Solana automaton.
 * Uses better-sqlite3 for synchronous, single-process access.
 * Updated for Solana: asset_address + tx_signature in registry.
 */
import type { AutomatonDatabase } from "../types.js";
export declare function createDatabase(dbPath: string): AutomatonDatabase;
//# sourceMappingURL=database.d.ts.map