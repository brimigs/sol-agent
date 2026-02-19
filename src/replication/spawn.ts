/**
 * Spawn (Solana)
 *
 * Spawn child agents in new Docker containers.
 * The parent creates a new container, installs the runtime,
 * writes a genesis config, funds the child, and starts it.
 * The child generates its own Solana ed25519 keypair on first run.
 */

import fs from "fs";
import pathLib from "path";
import type {
  SolanaAgentClient,
  AgentIdentity,
  AgentDatabase,
  ChildAgent,
  GenesisConfig,
} from "../types.js";
import { MAX_CHILDREN } from "../types.js";
import { ulid } from "ulid";

/**
 * Spawn a child agent in a new Docker container.
 */
export async function spawnChild(
  agentClient: SolanaAgentClient,
  identity: AgentIdentity,
  db: AgentDatabase,
  genesis: GenesisConfig,
): Promise<ChildAgent> {
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
  const sandbox = await agentClient.createSandbox({
    name: `sol-agent-child-${genesis.name.toLowerCase().replace(/\s+/g, "-")}`,
    vcpu: 1,
    memoryMb: 512,
    diskGb: 5,
  });

  const child: ChildAgent = {
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

  // 2. Install Node.js and the sol-agent runtime in the child sandbox
  await agentClient.execInSandbox(sandbox.id, "apt-get update -qq && apt-get install -y -qq nodejs npm git curl", 120000);

  // 3. Install the sol-agent runtime
  await agentClient.execInSandbox(
    sandbox.id,
    "npm install -g @sol-agent/runtime@latest 2>/dev/null || true",
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

  await writeInChildSandbox(
    agentClient,
    sandbox.id,
    "/root/.sol-agent/genesis.json",
    genesisJson,
  );

  // 4b. Propagate constitution (immutable, inherited before anything else)
  const constitutionPath = pathLib.join(
    process.env.HOME || "/root",
    ".sol-agent",
    "constitution.md",
  );
  try {
    const constitution = fs.readFileSync(constitutionPath, "utf-8");
    await writeInChildSandbox(
      agentClient,
      sandbox.id,
      "/root/.sol-agent/constitution.md",
      constitution,
    );
    // Make it read-only in the child
    await agentClient.execInSandbox(sandbox.id, "chmod 444 /root/.sol-agent/constitution.md", 5000);
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
 * Start a child agent after setup.
 */
export async function startChild(
  agentClient: SolanaAgentClient,
  db: AgentDatabase,
  childId: string,
): Promise<void> {
  const child = db.getChildById(childId);
  if (!child) throw new Error(`Child ${childId} not found`);

  // Initialize wallet (generates Solana keypair on first run)
  const initResult = await agentClient.execInSandbox(
    child.sandboxId,
    "sol-agent --init",
    30_000,
  );
  if (initResult.exitCode !== 0) {
    throw new Error(
      `Child ${childId} wallet init failed: ${initResult.stderr}`,
    );
  }

  // Start the agent in the background using nohup so it survives the
  // docker exec session ending. Logs go to /var/log/sol-agent.log.
  await agentClient.execInSandbox(
    child.sandboxId,
    "nohup sol-agent --run > /var/log/sol-agent.log 2>&1 &",
    10_000,
  );

  // Give the process a moment to start, then verify it's alive
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const check = await agentClient.execInSandbox(
    child.sandboxId,
    "pgrep -f 'sol-agent --run' > /dev/null && echo running || echo not-running",
    10_000,
  );

  if (!check.stdout.trim().includes("running")) {
    // Capture any startup error from the log
    const logTail = await agentClient.execInSandbox(
      child.sandboxId,
      "tail -20 /var/log/sol-agent.log 2>/dev/null || echo '(no log)'",
      5_000,
    );
    throw new Error(
      `Child ${childId} process did not start.\nLog:\n${logTail.stdout}`,
    );
  }

  db.updateChildStatus(childId, "running");
}

/**
 * Check a child's status.
 */
export async function checkChildStatus(
  agentClient: SolanaAgentClient,
  db: AgentDatabase,
  childId: string,
): Promise<string> {
  const child = db.getChildById(childId);
  if (!child) throw new Error(`Child ${childId} not found`);

  try {
    const result = await agentClient.execInSandbox(
      child.sandboxId,
      "sol-agent --status 2>/dev/null || echo 'offline'",
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
 * Send a message to a child agent.
 */
export async function messageChild(
  agentClient: SolanaAgentClient,
  db: AgentDatabase,
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

  await writeInChildSandbox(
    agentClient,
    child.sandboxId,
    `/root/.sol-agent/inbox/${ulid()}.json`,
    msgJson,
  );
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Wrap a string in single quotes for safe POSIX shell interpolation.
 * Any embedded single quotes are escaped as '\''.
 * This neutralises all shell metacharacters (;, &&, |, $, `, etc.).
 */
function shellQuote(str: string): string {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Write a file to a child sandbox, creating the parent directory first.
 * Validates the path and shell-quotes the directory to prevent injection.
 */
async function writeInChildSandbox(
  agentClient: SolanaAgentClient,
  sandboxId: string,
  filePath: string,
  content: string,
): Promise<void> {
  if (!filePath.startsWith("/")) {
    throw new Error(`writeInChildSandbox: filePath must be absolute, got: ${filePath}`);
  }
  if (filePath.includes("..")) {
    throw new Error(`writeInChildSandbox: filePath must not contain '..', got: ${filePath}`);
  }
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  await agentClient.execInSandbox(sandboxId, `mkdir -p ${shellQuote(dir)}`, 5000);
  await agentClient.writeFileToSandbox(sandboxId, filePath, content);
}
