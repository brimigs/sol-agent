/**
 * Spawn (Solana)
 *
 * Spawn child automatons in new Conway sandboxes.
 * The parent creates a new sandbox, installs the runtime,
 * writes a genesis config, funds the child, and starts it.
 * The child generates its own Solana ed25519 keypair on first run.
 */

import fs from "fs";
import pathLib from "path";
import type {
  ConwayClient,
  AutomatonIdentity,
  AutomatonDatabase,
  ChildAutomaton,
  GenesisConfig,
} from "../types.js";
import { MAX_CHILDREN } from "../types.js";
import { ulid } from "ulid";

/**
 * Spawn a child automaton in a new Conway sandbox.
 */
export async function spawnChild(
  conway: ConwayClient,
  identity: AutomatonIdentity,
  db: AutomatonDatabase,
  genesis: GenesisConfig,
): Promise<ChildAutomaton> {
  // Check child limit
  const existing = db.getChildren().filter(
    (c) => c.status !== "dead",
  );
  if (existing.length >= MAX_CHILDREN) {
    throw new Error(
      `Cannot spawn: already at max children (${MAX_CHILDREN}). Kill or wait for existing children to die.`,
    );
  }

  const childId = ulid();

  // 1. Create a new sandbox for the child
  const sandbox = await conway.createSandbox({
    name: `sol-automaton-child-${genesis.name.toLowerCase().replace(/\s+/g, "-")}`,
    vcpu: 1,
    memoryMb: 512,
    diskGb: 5,
  });

  const child: ChildAutomaton = {
    id: childId,
    name: genesis.name,
    address: "", // Will be set after keygen in the child sandbox
    sandboxId: sandbox.id,
    genesisPrompt: genesis.genesisPrompt,
    creatorMessage: genesis.creatorMessage,
    fundedAmountCents: 0,
    status: "spawning",
    createdAt: new Date().toISOString(),
  };

  db.insertChild(child);

  // 2. Install Node.js and the sol-automaton runtime in the child sandbox
  await execInSandbox(conway, sandbox.id, "apt-get update -qq && apt-get install -y -qq nodejs npm git curl", 120000);

  // 3. Install the sol-automaton runtime
  await execInSandbox(
    conway,
    sandbox.id,
    "npm install -g @conway/sol-automaton@latest 2>/dev/null || true",
    60000,
  );

  // 4. Write the genesis configuration
  const genesisJson = JSON.stringify(
    {
      name: genesis.name,
      genesisPrompt: genesis.genesisPrompt,
      creatorMessage: genesis.creatorMessage,
      creatorAddress: identity.address, // Parent's Solana address (base58 pubkey)
      parentAddress: identity.address,
    },
    null,
    2,
  );

  await writeInSandbox(
    conway,
    sandbox.id,
    "/root/.sol-automaton/genesis.json",
    genesisJson,
  );

  // 4b. Propagate constitution (immutable, inherited before anything else)
  const constitutionPath = pathLib.join(
    process.env.HOME || "/root",
    ".sol-automaton",
    "constitution.md",
  );
  try {
    const constitution = fs.readFileSync(constitutionPath, "utf-8");
    await writeInSandbox(
      conway,
      sandbox.id,
      "/root/.sol-automaton/constitution.md",
      constitution,
    );
    // Make it read-only in the child
    await execInSandbox(conway, sandbox.id, "chmod 444 /root/.sol-automaton/constitution.md", 5000);
  } catch {
    // Constitution file not found locally — child will get it from the repo on build
  }

  // 5. Record the spawn
  db.insertModification({
    id: ulid(),
    timestamp: new Date().toISOString(),
    type: "child_spawn",
    description: `Spawned child: ${genesis.name} in sandbox ${sandbox.id}`,
    reversible: false,
  });

  return child;
}

/**
 * Start a child automaton after setup.
 */
export async function startChild(
  conway: ConwayClient,
  db: AutomatonDatabase,
  childId: string,
): Promise<void> {
  const child = db.getChildById(childId);
  if (!child) throw new Error(`Child ${childId} not found`);

  // Initialize wallet (generates Solana keypair), provision, and run
  await execInSandbox(
    conway,
    child.sandboxId,
    "sol-automaton --init && sol-automaton --provision && systemctl start sol-automaton 2>/dev/null || sol-automaton --run &",
    60000,
  );

  db.updateChildStatus(childId, "running");
}

/**
 * Check a child's status.
 */
export async function checkChildStatus(
  conway: ConwayClient,
  db: AutomatonDatabase,
  childId: string,
): Promise<string> {
  const child = db.getChildById(childId);
  if (!child) throw new Error(`Child ${childId} not found`);

  try {
    const result = await execInSandbox(
      conway,
      child.sandboxId,
      "sol-automaton --status 2>/dev/null || echo 'offline'",
      10000,
    );

    const output = result.stdout || "unknown";

    // Parse status from output
    if (output.includes("dead")) {
      db.updateChildStatus(childId, "dead");
    } else if (output.includes("sleeping")) {
      db.updateChildStatus(childId, "sleeping");
    } else if (output.includes("running")) {
      db.updateChildStatus(childId, "running");
    }

    return output;
  } catch {
    db.updateChildStatus(childId, "unknown");
    return "Unable to reach child sandbox";
  }
}

/**
 * Send a message to a child automaton.
 */
export async function messageChild(
  conway: ConwayClient,
  db: AutomatonDatabase,
  childId: string,
  message: string,
): Promise<void> {
  const child = db.getChildById(childId);
  if (!child) throw new Error(`Child ${childId} not found`);

  // Write message to child's message queue
  const msgJson = JSON.stringify({
    from: "parent",
    content: message,
    timestamp: new Date().toISOString(),
  });

  await writeInSandbox(
    conway,
    child.sandboxId,
    `/root/.sol-automaton/inbox/${ulid()}.json`,
    msgJson,
  );
}

// ─── Helpers ──────────────────────────────────────────────────

async function execInSandbox(
  conway: ConwayClient,
  sandboxId: string,
  command: string,
  timeout: number = 30000,
) {
  // Use the Conway API to exec in a specific sandbox
  const apiUrl = (conway as any).__apiUrl || "https://api.conway.tech";
  const apiKey = (conway as any).__apiKey || "";

  const resp = await fetch(`${apiUrl}/v1/sandboxes/${sandboxId}/exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ command, timeout }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Exec in sandbox ${sandboxId} failed: ${text}`);
  }

  return resp.json();
}

async function writeInSandbox(
  conway: ConwayClient,
  sandboxId: string,
  filePath: string,
  content: string,
) {
  const apiUrl = (conway as any).__apiUrl || "https://api.conway.tech";
  const apiKey = (conway as any).__apiKey || "";

  // Ensure parent directory exists
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  await execInSandbox(conway, sandboxId, `mkdir -p ${dir}`, 5000);

  const resp = await fetch(
    `${apiUrl}/v1/sandboxes/${sandboxId}/files/upload/json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ path: filePath, content }),
    },
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Write to sandbox ${sandboxId} failed: ${text}`);
  }
}
