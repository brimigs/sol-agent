/**
 * Skills Tool Definitions
 *
 * Tools for installing, listing, creating, and removing agent skills.
 */

import type { AgentTool } from "../../types.js";

export function skillsTools(): AgentTool[] {
  return [
    {
      name: "install_skill",
      description: "Install a skill from a git repo, URL, or create one.",
      category: "skills",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", description: "Source type: git, url, or self" },
          name: { type: "string", description: "Skill name" },
          url: { type: "string", description: "Git repo URL or SKILL.md URL" },
          description: { type: "string", description: "Skill description (for self)" },
          instructions: { type: "string", description: "Skill instructions (for self)" },
        },
        required: ["source", "name"],
      },
      execute: async (args, ctx) => {
        const source = args.source as string;
        const name = args.name as string;
        const skillsDir = ctx.config.skillsDir || "~/.sol-agent/skills";
        if (source === "git" || source === "url") {
          const { installSkillFromGit, installSkillFromUrl } = await import("../../skills/registry.js");
          const url = args.url as string;
          if (!url) return "URL is required for git/url source";
          const skill = source === "git"
            ? await installSkillFromGit(url, name, skillsDir, ctx.db, ctx.agentClient)
            : await installSkillFromUrl(url, name, skillsDir, ctx.db, ctx.agentClient);
          return skill ? `Skill installed: ${skill.name}` : "Failed to install skill";
        }
        if (source === "self") {
          const { createSkill } = await import("../../skills/registry.js");
          const skill = await createSkill(
            name,
            (args.description as string) || "",
            (args.instructions as string) || "",
            skillsDir,
            ctx.db,
            ctx.agentClient,
          );
          return `Self-authored skill created: ${skill.name}`;
        }
        return `Unknown source type: ${source}`;
      },
    },
    {
      name: "list_skills",
      description: "List all installed skills.",
      category: "skills",
      parameters: { type: "object", properties: {} },
      execute: async (_args, ctx) => {
        const skills = ctx.db.getSkills();
        if (skills.length === 0) return "No skills installed.";
        return skills.map((s) => `${s.name} [${s.enabled ? "active" : "disabled"}] (${s.source}): ${s.description}`).join("\n");
      },
    },
    {
      name: "create_skill",
      description: "Create a new skill by writing a SKILL.md file.",
      category: "skills",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name" },
          description: { type: "string", description: "Skill description" },
          instructions: { type: "string", description: "Markdown instructions for the skill" },
        },
        required: ["name", "description", "instructions"],
      },
      execute: async (args, ctx) => {
        const { createSkill } = await import("../../skills/registry.js");
        const skill = await createSkill(
          args.name as string,
          args.description as string,
          args.instructions as string,
          ctx.config.skillsDir || "~/.sol-agent/skills",
          ctx.db,
          ctx.agentClient,
        );
        return `Skill created: ${skill.name} at ${skill.path}`;
      },
    },
    {
      name: "remove_skill",
      description: "Remove (disable) an installed skill.",
      category: "skills",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Skill name to remove" },
          delete_files: { type: "boolean", description: "Also delete skill files" },
        },
        required: ["name"],
      },
      execute: async (args, ctx) => {
        const { removeSkill } = await import("../../skills/registry.js");
        await removeSkill(
          args.name as string,
          ctx.db,
          ctx.agentClient,
          ctx.config.skillsDir || "~/.sol-agent/skills",
          (args.delete_files as boolean) || false,
        );
        return `Skill removed: ${args.name}`;
      },
    },
  ];
}
