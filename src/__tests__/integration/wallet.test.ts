import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const originalHome = process.env.HOME;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sol-wallet-test-"));
  process.env.HOME = tmpDir;
  vi.resetModules();
});

afterEach(() => {
  process.env.HOME = originalHome;
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});

describe("wallet", () => {
  it("walletExists() is false before creation", async () => {
    const { walletExists } = await import("../../identity/wallet.js");
    expect(walletExists()).toBe(false);
  });

  it("creates a new wallet with isNew: true", async () => {
    const { getWallet } = await import("../../identity/wallet.js");
    const { keypair, isNew } = await getWallet();

    expect(isNew).toBe(true);
    expect(keypair).toBeDefined();
    expect(keypair.publicKey.toBase58()).toBeTruthy();
    const addr = keypair.publicKey.toBase58();
    expect(addr.length).toBeGreaterThanOrEqual(32);
    expect(addr.length).toBeLessThanOrEqual(44);
  });

  it("writes wallet file with mode 0o600", async () => {
    const { getWallet } = await import("../../identity/wallet.js");
    await getWallet();

    const walletFile = path.join(tmpDir, ".sol-agent", "wallet.json");
    expect(fs.existsSync(walletFile)).toBe(true);

    const stats = fs.statSync(walletFile);
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it("wallet JSON contains secretKey array", async () => {
    const { getWallet } = await import("../../identity/wallet.js");
    await getWallet();

    const walletFile = path.join(tmpDir, ".sol-agent", "wallet.json");
    const data = JSON.parse(fs.readFileSync(walletFile, "utf-8"));
    expect(Array.isArray(data.secretKey)).toBe(true);
    expect(data.secretKey).toHaveLength(64);
    expect(data.createdAt).toBeTruthy();
  });

  it("loads existing wallet with isNew: false and same public key", async () => {
    // First: create wallet
    const { getWallet } = await import("../../identity/wallet.js");
    const { keypair: first } = await getWallet();
    const firstAddr = first.publicKey.toBase58();

    // Reset module cache but HOME still points to same tmpDir
    vi.resetModules();

    // Reload module — should find existing wallet
    const { getWallet: getWallet2 } = await import("../../identity/wallet.js");
    const { keypair: second, isNew } = await getWallet2();

    expect(isNew).toBe(false);
    expect(second.publicKey.toBase58()).toBe(firstAddr);
  });

  it("secret key round-trip preserves identity", async () => {
    const { Keypair } = await import("@solana/web3.js");
    const { getWallet } = await import("../../identity/wallet.js");
    const { keypair } = await getWallet();

    // Simulate the JSON serialization/deserialization round-trip
    const secretKeyArray = Array.from(keypair.secretKey);
    const restored = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));

    expect(restored.publicKey.toBase58()).toBe(keypair.publicKey.toBase58());
  });

  it("getWalletAddress() returns correct base58 pubkey", async () => {
    const { getWallet, getWalletAddress } = await import("../../identity/wallet.js");
    const { keypair } = await getWallet();

    const address = getWalletAddress();
    expect(address).toBe(keypair.publicKey.toBase58());
    expect(address).not.toBeNull();
  });

  it("getWalletAddress() returns null when wallet does not exist", async () => {
    const { getWalletAddress } = await import("../../identity/wallet.js");
    expect(getWalletAddress()).toBeNull();
  });

  it("walletExists() is true after creation", async () => {
    const { getWallet, walletExists } = await import("../../identity/wallet.js");
    await getWallet();
    expect(walletExists()).toBe(true);
  });

  it("creates ~/.sol-agent dir with secure permissions", async () => {
    const { getWallet } = await import("../../identity/wallet.js");
    await getWallet();

    const agentDir = path.join(tmpDir, ".sol-agent");
    expect(fs.existsSync(agentDir)).toBe(true);
    const stats = fs.statSync(agentDir);
    expect(stats.mode & 0o777).toBe(0o700);
  });
});
