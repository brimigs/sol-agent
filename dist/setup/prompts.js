import readline from "readline";
import chalk from "chalk";
let rl = null;
function getRL() {
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }
    return rl;
}
function ask(question) {
    return new Promise((resolve) => {
        getRL().question(question, (answer) => resolve(answer.trim()));
    });
}
export async function promptRequired(label) {
    while (true) {
        const value = await ask(chalk.white(`  → ${label}: `));
        if (value)
            return value;
        console.log(chalk.yellow("  This field is required."));
    }
}
export async function promptOptional(label) {
    return ask(chalk.white(`  → ${label}: `));
}
export async function promptMultiline(label) {
    console.log("");
    console.log(chalk.white(`  ${label}`));
    console.log(chalk.dim("  Type your prompt, then press Enter twice to finish:"));
    console.log("");
    const lines = [];
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
        }
        else {
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
 * Validates that the input is a valid base58 string (32-44 chars, base58 alphabet).
 */
export async function promptSolanaAddress(label) {
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    while (true) {
        const value = await ask(chalk.white(`  → ${label}: `));
        if (base58Regex.test(value))
            return value;
        console.log(chalk.yellow("  Invalid Solana address. Must be a base58 public key (32-44 chars)."));
    }
}
export function closePrompts() {
    if (rl) {
        rl.close();
        rl = null;
    }
}
//# sourceMappingURL=prompts.js.map