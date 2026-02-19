/**
 * Skills Registry
 *
 * Install skills from remote sources:
 * - Git repos: git clone <url> ~/.sol-agent/skills/<name>
 * - URLs: fetch a SKILL.md from any URL
 * - Self-created: the agent writes its own SKILL.md files
 */
import type { Skill, AgentDatabase, SolanaAgentClient } from "../types.js";
/**
 * Install a skill from a git repository.
 * Clones the repo into ~/.sol-agent/skills/<name>/
 */
export declare function installSkillFromGit(repoUrl: string, name: string, skillsDir: string, db: AgentDatabase, agentClient: SolanaAgentClient): Promise<Skill | null>;
/**
 * Install a skill from a URL (fetches a single SKILL.md).
 */
export declare function installSkillFromUrl(url: string, name: string, skillsDir: string, db: AgentDatabase, agentClient: SolanaAgentClient): Promise<Skill | null>;
/**
 * Create a new skill authored by the agent itself.
 */
export declare function createSkill(name: string, description: string, instructions: string, skillsDir: string, db: AgentDatabase, agentClient: SolanaAgentClient): Promise<Skill>;
/**
 * Remove a skill (disable in DB and optionally delete from disk).
 */
export declare function removeSkill(name: string, db: AgentDatabase, agentClient: SolanaAgentClient, skillsDir: string, deleteFiles?: boolean): Promise<void>;
/**
 * List all installed skills.
 */
export declare function listSkills(db: AgentDatabase): Skill[];
//# sourceMappingURL=registry.d.ts.map