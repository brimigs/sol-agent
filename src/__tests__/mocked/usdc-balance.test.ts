import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Hoisted mock state ────────────────────────────────────────

const mockGetTokenAccountBalance = vi.hoisted(() => vi.fn());
const mockGetBalance = vi.hoisted(() => vi.fn());
const mockGetAccountInfo = vi.hoisted(() => vi.fn());

// ─── Module mocks ──────────────────────────────────────────────

vi.mock("@solana/web3.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solana/web3.js")>();
  return {
    ...actual,
    Connection: vi.fn().mockImplementation(() => ({
      getTokenAccountBalance: mockGetTokenAccountBalance,
      getAccountInfo: mockGetAccountInfo,
      getBalance: mockGetBalance,
    })),
  };
});

// ─── Tests ─────────────────────────────────────────────────────

import { getRpcUrl, getUsdcBalance, getSolBalance, USDC_DECIMALS } from "../../solana/usdc.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRpcUrl – pure function, no mocks", () => {
  it("mainnet-beta → correct URL", () => {
    expect(getRpcUrl("mainnet-beta")).toBe("https://api.mainnet-beta.solana.com");
  });

  it("devnet → correct URL", () => {
    expect(getRpcUrl("devnet")).toBe("https://api.devnet.solana.com");
  });

  it("testnet → correct URL", () => {
    expect(getRpcUrl("testnet")).toBe("https://api.testnet.solana.com");
  });

  it("unknown network → falls back to mainnet URL", () => {
    expect(getRpcUrl("localnet")).toBe("https://api.mainnet-beta.solana.com");
  });

  it("customRpcUrl overrides default", () => {
    const custom = "https://my-custom-rpc.example.com";
    expect(getRpcUrl("devnet", custom)).toBe(custom);
    expect(getRpcUrl("mainnet-beta", custom)).toBe(custom);
  });
});

describe("USDC_DECIMALS", () => {
  it("is 6", () => {
    expect(USDC_DECIMALS).toBe(6);
  });
});

describe("getUsdcBalance – mocked Connection", () => {
  // Use the devnet USDC mint address (needed for a valid network key in USDC_MINTS)
  const WALLET_ADDRESS = "11111111111111111111111111111111";

  it("returns correct balance from token account", async () => {
    mockGetAccountInfo.mockResolvedValueOnce({ data: "mock-account" }); // ATA exists
    mockGetTokenAccountBalance.mockResolvedValueOnce({
      value: { uiAmount: 5.25 },
    });

    const balance = await getUsdcBalance(WALLET_ADDRESS, "devnet");
    expect(balance).toBe(5.25);
  });

  it("returns 0 when ATA does not exist (getAccountInfo returns null)", async () => {
    // null is the spec-defined response for a missing account on every RPC provider
    mockGetAccountInfo.mockResolvedValueOnce(null);

    const balance = await getUsdcBalance(WALLET_ADDRESS, "devnet");
    expect(balance).toBe(0);
    // getTokenAccountBalance must NOT be called — no account to query
    expect(mockGetTokenAccountBalance).not.toHaveBeenCalled();
  });

  it("returns 0 for unsupported network (no USDC mint)", async () => {
    // "localnet" has no USDC mint entry → returns 0 without even calling Connection
    const balance = await getUsdcBalance(WALLET_ADDRESS, "localnet");
    expect(balance).toBe(0);
  });

  it("handles null uiAmount gracefully", async () => {
    mockGetAccountInfo.mockResolvedValueOnce({ data: "mock-account" }); // ATA exists
    mockGetTokenAccountBalance.mockResolvedValueOnce({
      value: { uiAmount: null },
    });

    const balance = await getUsdcBalance(WALLET_ADDRESS, "devnet");
    expect(balance).toBe(0);
  });

  it("uses mainnet-beta by default", async () => {
    mockGetAccountInfo.mockResolvedValueOnce({ data: "mock-account" }); // ATA exists
    mockGetTokenAccountBalance.mockResolvedValueOnce({
      value: { uiAmount: 10.0 },
    });

    const balance = await getUsdcBalance(WALLET_ADDRESS);
    expect(balance).toBe(10.0);
  });
});

describe("getSolBalance – mocked Connection", () => {
  const WALLET_ADDRESS = "11111111111111111111111111111111";
  const LAMPORTS_PER_SOL = 1_000_000_000;

  it("returns correct SOL balance in SOL (not lamports)", async () => {
    mockGetBalance.mockResolvedValueOnce(2 * LAMPORTS_PER_SOL);

    const balance = await getSolBalance(WALLET_ADDRESS, "devnet");
    expect(balance).toBe(2.0);
  });

  it("returns 0.5 SOL for 500_000_000 lamports", async () => {
    mockGetBalance.mockResolvedValueOnce(500_000_000);

    const balance = await getSolBalance(WALLET_ADDRESS, "mainnet-beta");
    expect(balance).toBe(0.5);
  });

  it("returns 0 on error", async () => {
    mockGetBalance.mockRejectedValueOnce(new Error("RPC error"));

    const balance = await getSolBalance(WALLET_ADDRESS, "devnet");
    expect(balance).toBe(0);
  });

  it("returns 0 for empty wallet (0 lamports)", async () => {
    mockGetBalance.mockResolvedValueOnce(0);

    const balance = await getSolBalance(WALLET_ADDRESS, "devnet");
    expect(balance).toBe(0);
  });
});
