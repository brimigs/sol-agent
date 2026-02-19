import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDatabase } from "../../state/database.js";
import type { AgentDatabase, AgentTurn, ToolCallResult, Skill, ChildAgent } from "../../types.js";

let db: AgentDatabase;

beforeEach(() => {
  db = createDatabase(":memory:");
});

afterEach(() => {
  db.close();
});

// ─── Helpers ───────────────────────────────────────────────────

function makeTurn(id: string, timestampMs = Date.now()): AgentTurn {
  return {
    id,
    timestamp: new Date(timestampMs).toISOString(),
    state: "running",
    thinking: `thinking for ${id}`,
    toolCalls: [],
    tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    costCents: 1,
  };
}

function makeToolCall(id: string): ToolCallResult {
  return {
    id,
    name: "exec",
    arguments: { command: "ls" },
    result: "file1.txt\nfile2.txt",
    durationMs: 42,
  };
}

function makeSkill(name: string): Skill {
  return {
    name,
    description: `Description for ${name}`,
    autoActivate: false,
    instructions: "Do the thing",
    source: "self",
    path: `/skills/${name}.md`,
    enabled: true,
    installedAt: new Date().toISOString(),
  };
}

function makeChild(id: string): ChildAgent {
  return {
    id,
    name: `child-${id}`,
    address: "11111111111111111111111111111111",
    sandboxId: `sandbox-${id}`,
    genesisPrompt: "Be helpful",
    fundedAmountCents: 500,
    status: "spawning",
    createdAt: new Date().toISOString(),
  };
}

// ─── Schema ────────────────────────────────────────────────────

describe("schema", () => {
  it("initializes without error", () => {
    expect(db).toBeDefined();
  });
});

// ─── Identity ──────────────────────────────────────────────────

describe("identity", () => {
  it("set/get round-trip", () => {
    db.setIdentity("name", "test-agent");
    expect(db.getIdentity("name")).toBe("test-agent");
  });

  it("overwrites existing key", () => {
    db.setIdentity("name", "first");
    db.setIdentity("name", "second");
    expect(db.getIdentity("name")).toBe("second");
  });

  it("returns undefined for missing key", () => {
    expect(db.getIdentity("nonexistent")).toBeUndefined();
  });
});

// ─── Turns ─────────────────────────────────────────────────────

describe("turns", () => {
  it("insertTurn + getRecentTurns ordering and limit", () => {
    const base = Date.now();
    db.insertTurn(makeTurn("turn-1", base));
    db.insertTurn(makeTurn("turn-2", base + 1000));
    db.insertTurn(makeTurn("turn-3", base + 2000));

    const turns = db.getRecentTurns(10);
    expect(turns).toHaveLength(3);
    // getRecentTurns returns oldest-first (DESC then reversed)
    expect(turns[0].id).toBe("turn-1");
    expect(turns[2].id).toBe("turn-3");
  });

  it("getRecentTurns respects limit", () => {
    db.insertTurn(makeTurn("t1", Date.now()));
    db.insertTurn(makeTurn("t2", Date.now() + 1));
    db.insertTurn(makeTurn("t3", Date.now() + 2));

    const turns = db.getRecentTurns(2);
    expect(turns).toHaveLength(2);
  });

  it("getTurnCount increments", () => {
    expect(db.getTurnCount()).toBe(0);
    db.insertTurn(makeTurn("t1"));
    expect(db.getTurnCount()).toBe(1);
    db.insertTurn(makeTurn("t2"));
    expect(db.getTurnCount()).toBe(2);
  });

  it("getTurnById retrieves by id", () => {
    db.insertTurn(makeTurn("specific-id"));
    const turn = db.getTurnById("specific-id");
    expect(turn).toBeDefined();
    expect(turn?.id).toBe("specific-id");
    expect(turn?.thinking).toBe("thinking for specific-id");
  });

  it("getTurnById returns undefined for missing id", () => {
    expect(db.getTurnById("ghost")).toBeUndefined();
  });
});

// ─── Tool Calls ────────────────────────────────────────────────

describe("tool calls", () => {
  it("insertToolCall + getToolCallsForTurn", () => {
    db.insertTurn(makeTurn("parent-turn"));
    db.insertToolCall("parent-turn", makeToolCall("call-1"));
    db.insertToolCall("parent-turn", makeToolCall("call-2"));

    const calls = db.getToolCallsForTurn("parent-turn");
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.id)).toContain("call-1");
    expect(calls.map((c) => c.id)).toContain("call-2");
  });

  it("getToolCallsForTurn returns empty array for unknown turnId", () => {
    const calls = db.getToolCallsForTurn("no-such-turn");
    expect(calls).toHaveLength(0);
  });

  it("tool call result and arguments round-trip", () => {
    db.insertTurn(makeTurn("t1"));
    db.insertToolCall("t1", makeToolCall("tc-1"));

    const [call] = db.getToolCallsForTurn("t1");
    expect(call.name).toBe("exec");
    expect(call.arguments).toEqual({ command: "ls" });
    expect(call.result).toBe("file1.txt\nfile2.txt");
    expect(call.durationMs).toBe(42);
  });
});

// ─── KV Store ──────────────────────────────────────────────────

describe("KV store", () => {
  it("setKV / getKV round-trip", () => {
    db.setKV("my-key", "my-value");
    expect(db.getKV("my-key")).toBe("my-value");
  });

  it("getKV returns undefined for missing key", () => {
    expect(db.getKV("missing")).toBeUndefined();
  });

  it("setKV overwrites existing value", () => {
    db.setKV("k", "v1");
    db.setKV("k", "v2");
    expect(db.getKV("k")).toBe("v2");
  });

  it("deleteKV removes the key", () => {
    db.setKV("temp", "yes");
    db.deleteKV("temp");
    expect(db.getKV("temp")).toBeUndefined();
  });
});

// ─── Heartbeat ─────────────────────────────────────────────────

describe("heartbeat", () => {
  it("upsertHeartbeatEntry + getHeartbeatEntries", () => {
    db.upsertHeartbeatEntry({
      name: "daily-check",
      schedule: "0 9 * * *",
      task: "check_credits",
      enabled: true,
    });

    const entries = db.getHeartbeatEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("daily-check");
    expect(entries[0].schedule).toBe("0 9 * * *");
    expect(entries[0].enabled).toBe(true);
  });

  it("updateHeartbeatLastRun updates lastRun", () => {
    db.upsertHeartbeatEntry({ name: "ping", schedule: "* * * * *", task: "ping", enabled: true });
    const ts = "2024-06-01T12:00:00.000Z";
    db.updateHeartbeatLastRun("ping", ts);

    const entries = db.getHeartbeatEntries();
    expect(entries[0].lastRun).toBe(ts);
  });
});

// ─── Skills ────────────────────────────────────────────────────

describe("skills", () => {
  it("upsertSkill + getSkillByName", () => {
    db.upsertSkill(makeSkill("my-skill"));
    const skill = db.getSkillByName("my-skill");
    expect(skill).toBeDefined();
    expect(skill?.name).toBe("my-skill");
    expect(skill?.enabled).toBe(true);
  });

  it("getSkillByName returns undefined for missing skill", () => {
    expect(db.getSkillByName("ghost-skill")).toBeUndefined();
  });

  it("removeSkill disables the skill", () => {
    db.upsertSkill(makeSkill("to-remove"));
    db.removeSkill("to-remove");

    const skill = db.getSkillByName("to-remove");
    expect(skill?.enabled).toBe(false);
  });

  it("getSkills(enabledOnly=true) filters disabled skills", () => {
    db.upsertSkill(makeSkill("active-skill"));
    db.upsertSkill(makeSkill("inactive-skill"));
    db.removeSkill("inactive-skill");

    const enabled = db.getSkills(true);
    expect(enabled.map((s) => s.name)).toContain("active-skill");
    expect(enabled.map((s) => s.name)).not.toContain("inactive-skill");
  });
});

// ─── Children ──────────────────────────────────────────────────

describe("children", () => {
  it("insertChild + getChildById", () => {
    db.insertChild(makeChild("child-abc"));
    const child = db.getChildById("child-abc");
    expect(child).toBeDefined();
    expect(child?.name).toBe("child-child-abc");
    expect(child?.status).toBe("spawning");
  });

  it("updateChildStatus updates status", () => {
    db.insertChild(makeChild("child-xyz"));
    db.updateChildStatus("child-xyz", "running");

    const child = db.getChildById("child-xyz");
    expect(child?.status).toBe("running");
  });

  it("getChildren returns all children", () => {
    db.insertChild(makeChild("c1"));
    db.insertChild(makeChild("c2"));
    const children = db.getChildren();
    expect(children).toHaveLength(2);
  });
});

// ─── Registry ──────────────────────────────────────────────────

describe("registry", () => {
  it("setRegistryEntry + getRegistryEntry round-trip", () => {
    db.setRegistryEntry({
      agentId: "agent-123",
      agentURI: "https://example.com/agent.json",
      chain: "solana:devnet",
      assetAddress: "FakeAssetAddrBase58xxx",
      txSignature: "FakeTxSigBase58yyy",
      registeredAt: "2024-01-01T00:00:00.000Z",
    });

    const entry = db.getRegistryEntry();
    expect(entry).toBeDefined();
    expect(entry?.agentId).toBe("agent-123");
    expect(entry?.assetAddress).toBe("FakeAssetAddrBase58xxx");
    expect(entry?.txSignature).toBe("FakeTxSigBase58yyy");
    expect(entry?.chain).toBe("solana:devnet");
  });

  it("getRegistryEntry returns undefined when empty", () => {
    expect(db.getRegistryEntry()).toBeUndefined();
  });
});

// ─── Inbox ─────────────────────────────────────────────────────

describe("inbox messages", () => {
  const makeMsg = (id: string) => ({
    id,
    from: "SenderAddr111",
    to: "RecipientAddr222",
    content: `Message content for ${id}`,
    signedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });

  it("insertInboxMessage + getUnprocessedInboxMessages", () => {
    db.insertInboxMessage(makeMsg("msg-1"));
    db.insertInboxMessage(makeMsg("msg-2"));

    const msgs = db.getUnprocessedInboxMessages(10);
    expect(msgs).toHaveLength(2);
  });

  it("markInboxMessageProcessed removes from unprocessed", () => {
    db.insertInboxMessage(makeMsg("msg-a"));
    db.insertInboxMessage(makeMsg("msg-b"));

    db.markInboxMessageProcessed("msg-a");
    const unprocessed = db.getUnprocessedInboxMessages(10);
    expect(unprocessed.map((m) => m.id)).not.toContain("msg-a");
    expect(unprocessed.map((m) => m.id)).toContain("msg-b");
  });

  it("getUnprocessedInboxMessages respects limit", () => {
    db.insertInboxMessage(makeMsg("m1"));
    db.insertInboxMessage(makeMsg("m2"));
    db.insertInboxMessage(makeMsg("m3"));

    const msgs = db.getUnprocessedInboxMessages(2);
    expect(msgs).toHaveLength(2);
  });

  it("per-sender cap: drops messages beyond 10 unprocessed from same sender", () => {
    for (let i = 0; i < 12; i++) {
      db.insertInboxMessage({ ...makeMsg(`flood-${i}`), from: "FloodSender" });
    }
    const msgs = db.getUnprocessedInboxMessages(100);
    const fromFlooder = msgs.filter((m) => m.from === "FloodSender");
    expect(fromFlooder).toHaveLength(10);
  });

  it("per-sender cap: a different sender is unaffected by another sender's cap", () => {
    for (let i = 0; i < 12; i++) {
      db.insertInboxMessage({ ...makeMsg(`s1-${i}`), from: "Sender1" });
    }
    for (let i = 0; i < 5; i++) {
      db.insertInboxMessage({ ...makeMsg(`s2-${i}`), from: "Sender2" });
    }
    const msgs = db.getUnprocessedInboxMessages(100);
    expect(msgs.filter((m) => m.from === "Sender1")).toHaveLength(10);
    expect(msgs.filter((m) => m.from === "Sender2")).toHaveLength(5);
  });

  it("global cap: total unprocessed queue is capped at 100", () => {
    // Insert from many different senders to bypass per-sender cap
    for (let i = 0; i < 110; i++) {
      db.insertInboxMessage({ ...makeMsg(`global-${i}`), from: `Sender-${i}` });
    }
    const msgs = db.getUnprocessedInboxMessages(200);
    expect(msgs).toHaveLength(100);
  });

  it("global cap: processed messages free space for new ones", () => {
    // Fill to the global cap
    for (let i = 0; i < 100; i++) {
      db.insertInboxMessage({ ...makeMsg(`fill-${i}`), from: `S-${i}` });
    }
    // This should be dropped (queue full)
    db.insertInboxMessage({ ...makeMsg("overflow"), from: "NewSender" });
    expect(db.getUnprocessedInboxMessages(200)).toHaveLength(100);

    // Process one to free a slot
    db.markInboxMessageProcessed("fill-0");
    // Now the new message should be accepted
    db.insertInboxMessage({ ...makeMsg("after-free"), from: "NewSender" });
    const msgs = db.getUnprocessedInboxMessages(200);
    expect(msgs).toHaveLength(100);
    expect(msgs.some((m) => m.id === "after-free")).toBe(true);
  });

  it("content size: stores small messages unchanged", () => {
    const small = { ...makeMsg("small-1"), content: "Hello, agent!" };
    db.insertInboxMessage(small);
    const [stored] = db.getUnprocessedInboxMessages(1);
    expect(stored.content).toBe("Hello, agent!");
  });

  it("content size: replaces oversized content with a rejection notice", () => {
    const bigContent = "A".repeat(65 * 1024); // 65 KB — just over the 64 KB limit
    db.insertInboxMessage({ ...makeMsg("big-1"), content: bigContent, from: "BigSender" });

    const msgs = db.getUnprocessedInboxMessages(10);
    const stored = msgs.find((m) => m.id === "big-1");
    expect(stored).toBeDefined();
    // Content must be replaced, not stored as-is
    expect(stored!.content).not.toBe(bigContent);
    // Notice must mention the rejection and the size
    expect(stored!.content).toMatch(/rejected/i);
    expect(stored!.content).toMatch(/65/); // byte count present
  });

  it("content size: oversized message is still inserted (not dropped)", () => {
    const bigContent = "B".repeat(70 * 1024);
    db.insertInboxMessage({ ...makeMsg("big-2"), content: bigContent, from: "BigSender2" });

    const msgs = db.getUnprocessedInboxMessages(10);
    expect(msgs.some((m) => m.id === "big-2")).toBe(true);
  });

  it("content size: notice itself is well under the size limit", () => {
    const bigContent = "C".repeat(1_000_000); // 1 MB
    db.insertInboxMessage({ ...makeMsg("huge-1"), content: bigContent, from: "HugeSender" });

    const msgs = db.getUnprocessedInboxMessages(10);
    const stored = msgs.find((m) => m.id === "huge-1");
    expect(stored).toBeDefined();
    expect(stored!.content.length).toBeLessThan(64 * 1024);
  });

  it("content size: a message exactly at the limit is stored as-is", () => {
    const exactContent = "D".repeat(64 * 1024); // exactly 64 KB
    db.insertInboxMessage({ ...makeMsg("exact-1"), content: exactContent, from: "ExactSender" });

    const msgs = db.getUnprocessedInboxMessages(10);
    const stored = msgs.find((m) => m.id === "exact-1");
    expect(stored).toBeDefined();
    expect(stored!.content).toBe(exactContent);
  });
});

// ─── Agent State ───────────────────────────────────────────────

describe("agent state", () => {
  it("getAgentState returns 'setup' by default", () => {
    expect(db.getAgentState()).toBe("setup");
  });

  it("setAgentState + getAgentState round-trip", () => {
    db.setAgentState("running");
    expect(db.getAgentState()).toBe("running");

    db.setAgentState("sleeping");
    expect(db.getAgentState()).toBe("sleeping");
  });

  it("supports all valid AgentState values", () => {
    const states = ["setup", "waking", "running", "sleeping", "low_compute", "critical", "dead"] as const;
    for (const state of states) {
      db.setAgentState(state);
      expect(db.getAgentState()).toBe(state);
    }
  });
});
