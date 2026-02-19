import readline from "readline";
import chalk from "chalk";
import { PublicKey } from "@solana/web3.js";

let rl: readline.Interface | null = null;

function getRL(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    getRL().question(question, (answer) => resolve(answer.trim()));
  });
}

export async function promptRequired(label: string): Promise<string> {
  while (true) {
    const value = await ask(chalk.white(`  → ${label}: `));
    if (value) return value;
    console.log(chalk.yellow("  This field is required."));
  }
}

export async function promptOptional(label: string): Promise<string> {
  return ask(chalk.white(`  → ${label}: `));
}

export async function promptMultiline(label: string): Promise<string> {
  console.log("");
  console.log(chalk.white(`  ${label}`));
  console.log(chalk.dim("  Type your prompt, then press Enter twice to finish:"));
  console.log("");

  const lines: string[] = [];
  let lastWasEmpty = false;

  while (true) {
    const line = await ask("  ");
    if (line === "" && lastWasEmpty && lines.length > 0) {
      // Remove the trailing empty line we added
      lines.pop();
      break;
    }
    if (line === "" && lines.length > 0) {
      lastWasEmpty = true;
      lines.push("");
    } else {
      lastWasEmpty = false;
      lines.push(line);
    }
  }

  const result = lines.join("\n").trim();
  if (!result) {
    console.log(chalk.yellow("  Genesis prompt is required. Try again."));
    return promptMultiline(label);
  }
  return result;
}

/**
 * Prompt for a Solana base58 public key address.
 * Uses PublicKey from @solana/web3.js to fully decode and validate the input —
 * this rejects any string that isn't valid base58 or doesn't decode to exactly
 * 32 bytes, catching typos that a regex length check would silently accept.
 */
export async function promptSolanaAddress(label: string): Promise<string> {
  while (true) {
    const value = await ask(chalk.white(`  → ${label}: `));
    try {
      new PublicKey(value);
      return value;
    } catch {
      console.log(
        chalk.yellow(
          `  Invalid Solana address. Expected a base58-encoded ed25519 public key (32 bytes). ` +
            `Got ${value.length} chars — check for typos.`,
        ),
      );
    }
  }
}

export function closePrompts(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}
