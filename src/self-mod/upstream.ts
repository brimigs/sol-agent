/**
 * Upstream Awareness
 *
 * Helpers for the agent to know its own git origin,
 * detect new upstream commits, and review diffs.
 * All git commands run locally via child_process (not sandbox API).
 */

import { execSync } from "child_process";

const REPO_ROOT = process.cwd();

function git(cmd: string): string {
  return execSync(`git ${cmd}`, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    timeout: 15_000,
  }).trim();
}

/**
 * Resolve the default branch for the given remote (e.g. "origin").
 * Tries, in order:
 *   1. `git symbolic-ref refs/remotes/<remote>/HEAD` (set after git clone or git remote set-head)
 *   2. The branch the current HEAD tracks upstream (`git rev-parse --abbrev-ref @{u}`)
 *   3. Falls back to "main", then "master" based on what refs actually exist
 */
function resolveDefaultBranch(remote: string): string {
  // 1. Symbolic ref written by git clone / git remote set-head -a
  try {
    const ref = git(`symbolic-ref refs/remotes/${remote}/HEAD`);
    // "refs/remotes/origin/main" → "main"
    return ref.replace(`refs/remotes/${remote}/`, "");
  } catch {}

  // 2. Branch the current HEAD is tracking
  try {
    const upstream = git("rev-parse --abbrev-ref @{u}");
    // "origin/main" → "main"
    return upstream.replace(`${remote}/`, "");
  } catch {}

  // 3. Check common branch names by whether the remote ref exists
  for (const candidate of ["main", "master", "develop", "trunk"]) {
    try {
      git(`rev-parse --verify refs/remotes/${remote}/${candidate}`);
      return candidate;
    } catch {}
  }

  // Last resort
  return "main";
}

/**
 * Return origin URL (credentials stripped), current branch, and HEAD info.
 */
export function getRepoInfo(): {
  originUrl: string;
  branch: string;
  headHash: string;
  headMessage: string;
} {
  const rawUrl = git("config --get remote.origin.url");
  // Strip embedded credentials (https://user:token@host/... -> https://host/...)
  const originUrl = rawUrl.replace(/\/\/[^@]+@/, "//");
  const branch = git("rev-parse --abbrev-ref HEAD");
  const headLine = git('log -1 --format="%h %s"');
  const [headHash, ...rest] = headLine.split(" ");
  return { originUrl, branch, headHash, headMessage: rest.join(" ") };
}

/**
 * Fetch origin and report how many commits we're behind.
 *
 * The network-requiring `git fetch` is isolated: if it fails (git not
 * installed, network down, no remote configured) the error is captured in
 * `fetchError` and the comparison falls back to whatever remote refs are
 * already cached locally.  The caller decides how to surface the error.
 */
export function checkUpstream(): {
  behind: number;
  commits: { hash: string; message: string }[];
  fetchError?: string;
} {
  const remote = "origin";
  const branch = resolveDefaultBranch(remote);

  let fetchError: string | undefined;
  try {
    git(`fetch ${remote} ${branch} --quiet`);
  } catch (err: any) {
    fetchError = (err.message ?? "unknown git fetch error").slice(0, 300);
  }

  // Even when fetch failed, compare against whatever remote ref is cached.
  // If the ref doesn't exist yet (no successful fetch has ever run) git log
  // will throw — treat that as zero behind.
  try {
    const log = git(`log HEAD..${remote}/${branch} --oneline`);
    if (!log) return { behind: 0, commits: [], fetchError };
    const commits = log.split("\n").map((line) => {
      const [hash, ...rest] = line.split(" ");
      return { hash, message: rest.join(" ") };
    });
    return { behind: commits.length, commits, fetchError };
  } catch {
    return { behind: 0, commits: [], fetchError };
  }
}

/**
 * Return per-commit diffs for every commit ahead of HEAD on origin/main.
 */
export function getUpstreamDiffs(): {
  hash: string;
  message: string;
  author: string;
  diff: string;
}[] {
  const remote = "origin";
  const branch = resolveDefaultBranch(remote);
  const log = git(`log HEAD..${remote}/${branch} --format="%H %an|||%s"`);
  if (!log) return [];

  return log.split("\n").map((line) => {
    const [hashAndAuthor, message] = line.split("|||");
    const parts = hashAndAuthor.split(" ");
    const hash = parts[0];
    const author = parts.slice(1).join(" ");
    let diff: string;
    try {
      diff = git(`diff ${hash}~1..${hash}`);
    } catch {
      // First commit in the range may not have a parent
      diff = git(`show ${hash} --format="" --stat`);
    }
    return { hash: hash.slice(0, 12), message, author, diff };
  });
}
