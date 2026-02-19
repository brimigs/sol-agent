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

  it("writes an atomic backup (wallet.json.bak) alongside the primary", async () => {
    const { getWallet } = await import("../../identity/wallet.js");
    await getWallet();

    const bak = path.join(tmpDir, ".sol-agent", "wallet.json.bak");
    expect(fs.existsSync(bak)).toBe(true);
    const stats = fs.statSync(bak);
    expect(stats.mode & 0o777).toBe(0o600);
  });
});

describe("wallet – corruption resilience", () => {
  const agentSubdir = ".sol-agent";

  function walletFile() {
    return path.join(tmpDir, agentSubdir, "wallet.json");
  }
  function bakFile() {
    return path.join(tmpDir, agentSubdir, "wallet.json.bak");
  }

  async function createGoodWallet() {
    const { getWallet } = await import("../../identity/wallet.js");
    const { keypair } = await getWallet();
    return keypair.publicKey.toBase58();
  }

  it("recovers from corrupt primary using backup", async () => {
    const originalAddress = await createGoodWallet();

    // Corrupt the primary file
    fs.writeFileSync(walletFile(), "{corrupted json!!!", "utf-8");

    vi.resetModules();
    const { getWallet: getWallet2 } = await import("../../identity/wallet.js");
    const { keypair, isNew } = await getWallet2();

    expect(isNew).toBe(false);
    expect(keypair.publicKey.toBase58()).toBe(originalAddress);
    // Primary should be restored
    expect(fs.existsSync(walletFile())).toBe(true);
  });

  it("recovers from missing primary using backup", async () => {
    const originalAddress = await createGoodWallet();

    fs.rmSync(walletFile());

    vi.resetModules();
    const { getWallet: getWallet2 } = await import("../../identity/wallet.js");
    const { keypair, isNew } = await getWallet2();

    expect(isNew).toBe(false);
    expect(keypair.publicKey.toBase58()).toBe(originalAddress);
  });

  it("recovers from wrong-length secretKey in primary", async () => {
    const originalAddress = await createGoodWallet();

    // Write a valid JSON but with a truncated key
    const bad = { secretKey: [1, 2, 3], createdAt: new Date().toISOString() };
    fs.writeFileSync(walletFile(), JSON.stringify(bad), "utf-8");

    vi.resetModules();
    const { getWallet: getWallet2 } = await import("../../identity/wallet.js");
    const { keypair } = await getWallet2();
    expect(keypair.publicKey.toBase58()).toBe(originalAddress);
  });

  it("throws a clear error when both primary and backup are corrupt", async () => {
    await createGoodWallet();

    fs.writeFileSync(walletFile(), "not json", "utf-8");
    fs.writeFileSync(bakFile(), "also not json", "utf-8");

    vi.resetModules();
    const { getWallet: getWallet2 } = await import("../../identity/wallet.js");
    await expect(getWallet2()).rejects.toThrow(/corrupt.*backup.*also/is);
  });

  it("throws a clear error when primary is corrupt and no backup exists", async () => {
    await createGoodWallet();

    fs.writeFileSync(walletFile(), "not json", "utf-8");
    fs.rmSync(bakFile());

    vi.resetModules();
    const { getWallet: getWallet2 } = await import("../../identity/wallet.js");
    await expect(getWallet2()).rejects.toThrow(/corrupt or unreadable/i);
  });

  it("walletExists() returns true when only the backup exists", async () => {
    await createGoodWallet();
    fs.rmSync(walletFile());

    vi.resetModules();
    const { walletExists } = await import("../../identity/wallet.js");
    expect(walletExists()).toBe(true);
  });
});
