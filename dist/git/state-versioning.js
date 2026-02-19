/**
 * State Versioning
 *
 * Version control the agent's own state files (~/.sol-agent/).
 * Every self-modification triggers a git commit with a descriptive message.
 * The agent's entire identity history is version-controlled and replayable.
 */
import { gitInit, gitCommit, gitStatus, gitLog } from "./tools.js";
const AGENT_DIR = "~/.sol-agent";
function resolveHome(p) {
    const home = process.env.HOME || "/root";
    if (p.startsWith("~")) {
        return `${home}${p.slice(1)}`;
    }
    return p;
}
/**
 * Initialize git repo for the agent's state directory.
 * Creates .gitignore to exclude sensitive files.
 */
export async function initStateRepo(agentClient) {
    const dir = resolveHome(AGENT_DIR);
    // Check if already initialized
    const checkResult = await agentClient.exec(`test -d ${dir}/.git && echo "exists" || echo "nope"`, 5000);
    if (checkResult.stdout.trim() === "exists") {
        return;
    }
    // Initialize
    await gitInit(agentClient, dir);
    // Create .gitignore for sensitive files
    const gitignore = `# Sensitive files - never commit
wallet.json
config.json
state.db
state.db-wal
state.db-shm
logs/
*.log
*.err
`;
    await agentClient.writeFile(`${dir}/.gitignore`, gitignore);
    // Configure git user
    await agentClient.exec(`cd ${dir} && git config user.name "Agent" && git config user.email "agent@localhost"`, 5000);
    // Initial commit
    await gitCommit(agentClient, dir, "genesis: agent state repository initialized");
}
/**
 * Commit a state change with a descriptive message.
 * Called after any self-modification.
 */
export async function commitStateChange(agentClient, description, category = "state") {
    const dir = resolveHome(AGENT_DIR);
    // Check if there are changes
    const status = await gitStatus(agentClient, dir);
    if (status.clean) {
        return "No changes to commit";
    }
    const message = `${category}: ${description}`;
    const result = await gitCommit(agentClient, dir, message);
    return result;
}
/**
 * Commit after a SOUL.md update.
 */
export async function commitSoulUpdate(agentClient, description) {
    return commitStateChange(agentClient, description, "soul");
}
/**
 * Commit after a skill installation or removal.
 */
export async function commitSkillChange(agentClient, skillName, action) {
    return commitStateChange(agentClient, `${action} skill: ${skillName}`, "skill");
}
/**
 * Commit after heartbeat config change.
 */
export async function commitHeartbeatChange(agentClient, description) {
    return commitStateChange(agentClient, description, "heartbeat");
}
/**
 * Commit after config change.
 */
export async function commitConfigChange(agentClient, description) {
    return commitStateChange(agentClient, description, "config");
}
/**
 * Get the state repo history.
 */
export async function getStateHistory(agentClient, limit = 20) {
    const dir = resolveHome(AGENT_DIR);
    return gitLog(agentClient, dir, limit);
}
//# sourceMappingURL=state-versioning.js.map