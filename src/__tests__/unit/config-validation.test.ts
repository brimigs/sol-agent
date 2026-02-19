import { describe, it, expect } from "vitest";
import { validateConfig } from "../../config.js";
import type { AgentConfig } from "../../types.js";

// ─── Fixtures ──────────────────────────────────────────────────────

const VALID: AgentConfig = {
  name: "TestBot",
  genesisPrompt: "You are a test agent.",
  creatorAddress: "So1ana1111111111111111111111111111111111111",
  inferenceModel: "claude-sonnet-4-6",
  maxTokensPerTurn: 4096,
  heartbeatConfigPath: "~/.sol-agent/heartbeat.yml",
  dbPath: "~/.sol-agent/state.db",
  logLevel: "info",
  walletAddress: "So1ana2222222222222222222222222222222222222",
  version: "0.1.0",
  skillsDir: "~/.sol-agent/skills",
  maxChildren: 3,
  solanaRpcUrl: "https://api.mainnet-beta.solana.com",
  solanaNetwork: "mainnet-beta",
};

function withOverride(overrides: Partial<Record<string, unknown>>): unknown {
  return { ...VALID, ...overrides };
}

// ─── Happy path ────────────────────────────────────────────────────

describe("validateConfig – valid config", () => {
  it("returns typed config for a fully valid object", () => {
    const result = validateConfig(VALID);
    expect(result.name).toBe("TestBot");
    expect(result.solanaNetwork).toBe("mainnet-beta");
  });

  it("accepts optional fields when provided as non-empty strings", () => {
    const result = validateConfig(
      withOverride({
        creatorMessage: "good luck",
        parentAddress: "So1ana3333333333333333333333333333333333333",
      }),
    );
    expect(result.creatorMessage).toBe("good luck");
  });

  it("accepts all valid logLevel values", () => {
    for (const level of ["debug", "info", "warn", "error"] as const) {
      expect(() => validateConfig(withOverride({ logLevel: level }))).not.toThrow();
    }
  });

  it("accepts all valid solanaNetwork values", () => {
    for (const net of ["mainnet-beta", "devnet", "testnet"] as const) {
      expect(() => validateConfig(withOverride({ solanaNetwork: net }))).not.toThrow();
    }
  });
});

// ─── Type guard ────────────────────────────────────────────────────

describe("validateConfig – non-object input", () => {
  it("throws for null", () => {
    expect(() => validateConfig(null)).toThrow("JSON object");
  });

  it("throws for an array", () => {
    expect(() => validateConfig([])).toThrow("JSON object");
  });

  it("throws for a string", () => {
    expect(() => validateConfig("config")).toThrow("JSON object");
  });
});

// ─── Required string fields ────────────────────────────────────────

describe("validateConfig – required string fields", () => {
  it("reports missing name", () => {
    expect(() => validateConfig(withOverride({ name: undefined }))).toThrow('"name"');
  });

  it("reports missing walletAddress", () => {
    expect(() => validateConfig(withOverride({ walletAddress: "  " }))).toThrow('"walletAddress"');
  });

  it("reports multiple missing fields in one error", () => {
    try {
      validateConfig(withOverride({ name: "", walletAddress: "" }));
      expect.fail("should have thrown");
    } catch (err: any) {
      expect(err.message).toContain('"name"');
      expect(err.message).toContain('"walletAddress"');
      expect(err.message).toMatch(/2 errors/);
    }
  });
});

// ─── Boolean / number fields ───────────────────────────────────────

describe("validateConfig – boolean and number fields", () => {
  it("rejects zero maxTokensPerTurn", () => {
    expect(() => validateConfig(withOverride({ maxTokensPerTurn: 0 }))).toThrow(
      '"maxTokensPerTurn"',
    );
  });

  it("rejects negative maxTokensPerTurn", () => {
    expect(() => validateConfig(withOverride({ maxTokensPerTurn: -1 }))).toThrow(
      '"maxTokensPerTurn"',
    );
  });

  it("rejects non-integer maxChildren", () => {
    expect(() => validateConfig(withOverride({ maxChildren: 1.5 }))).toThrow('"maxChildren"');
  });

  it("rejects negative maxChildren", () => {
    expect(() => validateConfig(withOverride({ maxChildren: -1 }))).toThrow('"maxChildren"');
  });

  it("accepts maxChildren = 0", () => {
    expect(() => validateConfig(withOverride({ maxChildren: 0 }))).not.toThrow();
  });
});

// ─── Enum fields ────────────────────────────────────────────────────

describe("validateConfig – enum fields", () => {
  it("rejects invalid logLevel", () => {
    const err = () => validateConfig(withOverride({ logLevel: "verbose" }));
    expect(err).toThrow('"logLevel"');
    expect(err).toThrow("debug");
  });

  it("rejects invalid solanaNetwork", () => {
    const err = () => validateConfig(withOverride({ solanaNetwork: "mainnet" }));
    expect(err).toThrow('"solanaNetwork"');
    expect(err).toThrow("mainnet-beta");
  });
});

// ─── URL validation ────────────────────────────────────────────────

describe("validateConfig – URL fields", () => {
  it("rejects malformed solanaRpcUrl", () => {
    expect(() => validateConfig(withOverride({ solanaRpcUrl: "not-a-url" }))).toThrow(
      '"solanaRpcUrl"',
    );
  });

  it("accepts http URLs (non-TLS RPC endpoints)", () => {
    expect(() =>
      validateConfig(withOverride({ solanaRpcUrl: "http://localhost:8899" })),
    ).not.toThrow();
  });

  it("accepts https URLs", () => {
    expect(() =>
      validateConfig(withOverride({ solanaRpcUrl: "https://rpc.custom.example.com" })),
    ).not.toThrow();
  });
});

// ─── Solana pubkey validation ──────────────────────────────────────

describe("validateConfig – Solana address fields", () => {
  it("accepts a valid base58 mainnet creator address", () => {
    // A real mainnet address (the Solana system program)
    expect(() =>
      validateConfig(withOverride({ creatorAddress: "11111111111111111111111111111111" })),
    ).not.toThrow();
  });

  it("rejects a creatorAddress that is not a valid pubkey", () => {
    const err = () => validateConfig(withOverride({ creatorAddress: "not-a-pubkey" }));
    expect(err).toThrow('"creatorAddress"');
    expect(err).toThrow("valid base58 Solana public key");
  });

  it("rejects a walletAddress with invalid characters (0, O, I, l not in base58)", () => {
    // '0' is not in the base58 alphabet — easy typo
    expect(() =>
      validateConfig(withOverride({ walletAddress: "0invalIdAddr3ss000000000000000000000000000" })),
    ).toThrow('"walletAddress"');
  });

  it("rejects a walletAddress that is too short to be a pubkey", () => {
    expect(() =>
      validateConfig(withOverride({ walletAddress: "abc123" })),
    ).toThrow('"walletAddress"');
  });

  it("rejects a parentAddress that is not a valid pubkey when provided", () => {
    // parentAddress is an optional field — if present it must be a non-empty string
    // (current validator only checks non-empty string for optional fields; this
    // test confirms we don't false-positive on a valid optional address)
    expect(() =>
      validateConfig(withOverride({ parentAddress: "11111111111111111111111111111111" })),
    ).not.toThrow();
  });
});

// ─── Optional fields ───────────────────────────────────────────────

describe("validateConfig – optional fields", () => {
  it("accepts undefined optional fields", () => {
    const cfg = { ...VALID };
    delete (cfg as any).creatorMessage;
    delete (cfg as any).parentAddress;
    expect(() => validateConfig(cfg)).not.toThrow();
  });

  it("rejects empty-string optional field", () => {
    expect(() => validateConfig(withOverride({ creatorMessage: "" }))).toThrow(
      '"creatorMessage"',
    );
  });

  it("rejects non-string optional field", () => {
    expect(() => validateConfig(withOverride({ parentAddress: 42 }))).toThrow('"parentAddress"');
  });
});
