/**
 * Sol-Automaton Database
 *
 * SQLite-backed persistent state for the Solana automaton.
 * Uses better-sqlite3 for synchronous, single-process access.
 * Updated for Solana: asset_address + tx_signature in registry.
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { SCHEMA_VERSION, CREATE_TABLES, MIGRATION_V2, MIGRATION_V3 } from "./schema.js";
export function createDatabase(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(CREATE_TABLES);
    const versionRow = db
        .prepare("SELECT MAX(version) as v FROM schema_version")
        .get();
    const currentVersion = versionRow?.v ?? 0;
    if (currentVersion < 2)
        db.exec(MIGRATION_V2);
    if (currentVersion < 3)
        db.exec(MIGRATION_V3);
    if (currentVersion < SCHEMA_VERSION) {
        db.prepare("INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, datetime('now'))").run(SCHEMA_VERSION);
    }
    const getIdentity = (key) => {
        const row = db
            .prepare("SELECT value FROM identity WHERE key = ?")
            .get(key);
        return row?.value;
    };
    const setIdentity = (key, value) => {
        db.prepare("INSERT OR REPLACE INTO identity (key, value) VALUES (?, ?)").run(key, value);
    };
    const insertTurn = (turn) => {
        db.prepare(`INSERT INTO turns (id, timestamp, state, input, input_source, thinking, tool_calls, token_usage, cost_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(turn.id, turn.timestamp, turn.state, turn.input ?? null, turn.inputSource ?? null, turn.thinking, JSON.stringify(turn.toolCalls), JSON.stringify(turn.tokenUsage), turn.costCents);
    };
    const getRecentTurns = (limit) => {
        const rows = db.prepare("SELECT * FROM turns ORDER BY timestamp DESC LIMIT ?").all(limit);
        return rows.map(deserializeTurn).reverse();
    };
    const getTurnById = (id) => {
        const row = db.prepare("SELECT * FROM turns WHERE id = ?").get(id);
        return row ? deserializeTurn(row) : undefined;
    };
    const getTurnCount = () => {
        return db.prepare("SELECT COUNT(*) as count FROM turns").get().count;
    };
    const insertToolCall = (turnId, call) => {
        db.prepare(`INSERT INTO tool_calls (id, turn_id, name, arguments, result, duration_ms, error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(call.id, turnId, call.name, JSON.stringify(call.arguments), call.result, call.durationMs, call.error ?? null);
    };
    const getToolCallsForTurn = (turnId) => {
        return db.prepare("SELECT * FROM tool_calls WHERE turn_id = ?").all(turnId).map(deserializeToolCall);
    };
    const getHeartbeatEntries = () => {
        return db.prepare("SELECT * FROM heartbeat_entries").all().map(deserializeHeartbeatEntry);
    };
    const upsertHeartbeatEntry = (entry) => {
        db.prepare(`INSERT OR REPLACE INTO heartbeat_entries (name, schedule, task, enabled, last_run, next_run, params, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(entry.name, entry.schedule, entry.task, entry.enabled ? 1 : 0, entry.lastRun ?? null, entry.nextRun ?? null, JSON.stringify(entry.params ?? {}));
    };
    const updateHeartbeatLastRun = (name, timestamp) => {
        db.prepare("UPDATE heartbeat_entries SET last_run = ?, updated_at = datetime('now') WHERE name = ?").run(timestamp, name);
    };
    const insertTransaction = (txn) => {
        db.prepare(`INSERT INTO transactions (id, type, amount_cents, balance_after_cents, description)
       VALUES (?, ?, ?, ?, ?)`).run(txn.id, txn.type, txn.amountCents ?? null, txn.balanceAfterCents ?? null, txn.description);
    };
    const getRecentTransactions = (limit) => {
        return db.prepare("SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?").all(limit).map(deserializeTransaction).reverse();
    };
    const getInstalledTools = () => {
        return db.prepare("SELECT * FROM installed_tools WHERE enabled = 1").all().map(deserializeInstalledTool);
    };
    const installTool = (tool) => {
        db.prepare(`INSERT OR REPLACE INTO installed_tools (id, name, type, config, installed_at, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`).run(tool.id, tool.name, tool.type, JSON.stringify(tool.config ?? {}), tool.installedAt, tool.enabled ? 1 : 0);
    };
    const removeTool = (id) => {
        db.prepare("UPDATE installed_tools SET enabled = 0 WHERE id = ?").run(id);
    };
    const insertModification = (mod) => {
        db.prepare(`INSERT INTO modifications (id, timestamp, type, description, file_path, diff, reversible)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(mod.id, mod.timestamp, mod.type, mod.description, mod.filePath ?? null, mod.diff ?? null, mod.reversible ? 1 : 0);
    };
    const getRecentModifications = (limit) => {
        return db.prepare("SELECT * FROM modifications ORDER BY timestamp DESC LIMIT ?").all(limit).map(deserializeModification).reverse();
    };
    const getKV = (key) => {
        const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key);
        return row?.value;
    };
    const setKV = (key, value) => {
        db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
    };
    const deleteKV = (key) => {
        db.prepare("DELETE FROM kv WHERE key = ?").run(key);
    };
    const getSkills = (enabledOnly) => {
        const query = enabledOnly ? "SELECT * FROM skills WHERE enabled = 1" : "SELECT * FROM skills";
        return db.prepare(query).all().map(deserializeSkill);
    };
    const getSkillByName = (name) => {
        const row = db.prepare("SELECT * FROM skills WHERE name = ?").get(name);
        return row ? deserializeSkill(row) : undefined;
    };
    const upsertSkill = (skill) => {
        db.prepare(`INSERT OR REPLACE INTO skills (name, description, auto_activate, requires, instructions, source, path, enabled, installed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(skill.name, skill.description, skill.autoActivate ? 1 : 0, JSON.stringify(skill.requires ?? {}), skill.instructions, skill.source, skill.path, skill.enabled ? 1 : 0, skill.installedAt);
    };
    const removeSkill = (name) => {
        db.prepare("UPDATE skills SET enabled = 0 WHERE name = ?").run(name);
    };
    const getChildren = () => {
        return db.prepare("SELECT * FROM children ORDER BY created_at DESC").all().map(deserializeChild);
    };
    const getChildById = (id) => {
        const row = db.prepare("SELECT * FROM children WHERE id = ?").get(id);
        return row ? deserializeChild(row) : undefined;
    };
    const insertChild = (child) => {
        db.prepare(`INSERT INTO children (id, name, address, sandbox_id, genesis_prompt, creator_message, funded_amount_cents, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(child.id, child.name, child.address, child.sandboxId, child.genesisPrompt, child.creatorMessage ?? null, child.fundedAmountCents, child.status, child.createdAt);
    };
    const updateChildStatus = (id, status) => {
        db.prepare("UPDATE children SET status = ?, last_checked = datetime('now') WHERE id = ?").run(status, id);
    };
    // Solana registry: uses asset_address and tx_signature
    const getRegistryEntry = () => {
        const row = db.prepare("SELECT * FROM registry LIMIT 1").get();
        return row ? deserializeRegistry(row) : undefined;
    };
    const setRegistryEntry = (entry) => {
        db.prepare(`INSERT OR REPLACE INTO registry (agent_id, agent_uri, chain, asset_address, tx_signature, registered_at)
       VALUES (?, ?, ?, ?, ?, ?)`).run(entry.agentId, entry.agentURI, entry.chain, entry.assetAddress, entry.txSignature, entry.registeredAt);
    };
    const insertReputation = (entry) => {
        db.prepare(`INSERT INTO reputation (id, from_agent, to_agent, score, comment, tx_signature)
       VALUES (?, ?, ?, ?, ?, ?)`).run(entry.id, entry.fromAgent, entry.toAgent, entry.score, entry.comment, entry.txSignature ?? null);
    };
    const getReputation = (agentAddress) => {
        const query = agentAddress
            ? "SELECT * FROM reputation WHERE to_agent = ? ORDER BY created_at DESC"
            : "SELECT * FROM reputation ORDER BY created_at DESC";
        const params = agentAddress ? [agentAddress] : [];
        return db.prepare(query).all(...params).map(deserializeReputation);
    };
    const insertInboxMessage = (msg) => {
        db.prepare(`INSERT OR IGNORE INTO inbox_messages (id, from_address, content, received_at, reply_to)
       VALUES (?, ?, ?, ?, ?)`).run(msg.id, msg.from, msg.content, msg.createdAt || new Date().toISOString(), msg.replyTo ?? null);
    };
    const getUnprocessedInboxMessages = (limit) => {
        return db.prepare("SELECT * FROM inbox_messages WHERE processed_at IS NULL ORDER BY received_at ASC LIMIT ?").all(limit).map(deserializeInboxMessage);
    };
    const markInboxMessageProcessed = (id) => {
        db.prepare("UPDATE inbox_messages SET processed_at = datetime('now') WHERE id = ?").run(id);
    };
    const getAgentState = () => getKV("agent_state") || "setup";
    const setAgentState = (state) => setKV("agent_state", state);
    const close = () => { db.close(); };
    return {
        getIdentity, setIdentity, insertTurn, getRecentTurns, getTurnById, getTurnCount,
        insertToolCall, getToolCallsForTurn, getHeartbeatEntries, upsertHeartbeatEntry,
        updateHeartbeatLastRun, insertTransaction, getRecentTransactions, getInstalledTools,
        installTool, removeTool, insertModification, getRecentModifications, getKV, setKV, deleteKV,
        getSkills, getSkillByName, upsertSkill, removeSkill, getChildren, getChildById, insertChild,
        updateChildStatus, getRegistryEntry, setRegistryEntry, insertReputation, getReputation,
        insertInboxMessage, getUnprocessedInboxMessages, markInboxMessageProcessed,
        getAgentState, setAgentState, close,
    };
}
function deserializeTurn(row) {
    return { id: row.id, timestamp: row.timestamp, state: row.state, input: row.input ?? undefined,
        inputSource: row.input_source ?? undefined, thinking: row.thinking,
        toolCalls: JSON.parse(row.tool_calls || "[]"), tokenUsage: JSON.parse(row.token_usage || "{}"),
        costCents: row.cost_cents };
}
function deserializeToolCall(row) {
    return { id: row.id, name: row.name, arguments: JSON.parse(row.arguments || "{}"),
        result: row.result, durationMs: row.duration_ms, error: row.error ?? undefined };
}
function deserializeHeartbeatEntry(row) {
    return { name: row.name, schedule: row.schedule, task: row.task, enabled: !!row.enabled,
        lastRun: row.last_run ?? undefined, nextRun: row.next_run ?? undefined,
        params: JSON.parse(row.params || "{}") };
}
function deserializeTransaction(row) {
    return { id: row.id, type: row.type, amountCents: row.amount_cents ?? undefined,
        balanceAfterCents: row.balance_after_cents ?? undefined, description: row.description,
        timestamp: row.created_at };
}
function deserializeInstalledTool(row) {
    return { id: row.id, name: row.name, type: row.type, config: JSON.parse(row.config || "{}"),
        installedAt: row.installed_at, enabled: !!row.enabled };
}
function deserializeModification(row) {
    return { id: row.id, timestamp: row.timestamp, type: row.type, description: row.description,
        filePath: row.file_path ?? undefined, diff: row.diff ?? undefined, reversible: !!row.reversible };
}
function deserializeSkill(row) {
    return { name: row.name, description: row.description, autoActivate: !!row.auto_activate,
        requires: JSON.parse(row.requires || "{}"), instructions: row.instructions,
        source: row.source, path: row.path, enabled: !!row.enabled, installedAt: row.installed_at };
}
function deserializeChild(row) {
    return { id: row.id, name: row.name, address: row.address, sandboxId: row.sandbox_id,
        genesisPrompt: row.genesis_prompt, creatorMessage: row.creator_message ?? undefined,
        fundedAmountCents: row.funded_amount_cents, status: row.status, createdAt: row.created_at,
        lastChecked: row.last_checked ?? undefined };
}
function deserializeRegistry(row) {
    return { agentId: row.agent_id, agentURI: row.agent_uri, chain: row.chain,
        assetAddress: row.asset_address, txSignature: row.tx_signature, registeredAt: row.registered_at };
}
function deserializeInboxMessage(row) {
    return { id: row.id, from: row.from_address, to: "", content: row.content,
        signedAt: row.received_at, createdAt: row.received_at, replyTo: row.reply_to ?? undefined };
}
function deserializeReputation(row) {
    return { id: row.id, fromAgent: row.from_agent, toAgent: row.to_agent, score: row.score,
        comment: row.comment, txSignature: row.tx_signature ?? undefined, timestamp: row.created_at };
}
//# sourceMappingURL=database.js.map