import type { CanonicalRepoView } from "@/lib/dashboard-adapter";

export type CleanupPriorityBand = "critical" | "high" | "medium" | "low" | "info";

export type CleanupCommandGroup = {
  machineId: string;
  path: string;
  runLabel: string;
  commands: string[];
  context: "inspect-dirty" | "inspect-unpushed" | "verify-health";
};

export type CleanupProofCommandGroup = {
  machineId: string;
  path: string;
  runLabel: string;
  commands: string[];
  context: "capture-proof";
};

export type CleanupPlannerEntry = {
  repoId: string;
  displayName: string;
  repoClass: "standard" | "operational_queue";
  suppressNormalCleanup: boolean;
  suggestedMode: "normal" | "hold_no_push";
  safetyNote: string | null;
  priorityScore: number;
  priorityBand: CleanupPriorityBand;
  reasons: string[];
  suggestions: string[];
  recommendedActions: string[];
  affectedMachines: string[];
  affectedLocations: Array<{
    machineId: string;
    path: string;
    branch: string;
    dirty: boolean;
    unpushedCommits: number;
  }>;
  safeCommandGroups: CleanupCommandGroup[];
  proofCommandGroups: CleanupProofCommandGroup[];
};

function classifyRepo(repo: CanonicalRepoView): {
  repoClass: "standard" | "operational_queue";
  suppressNormalCleanup: boolean;
  suggestedMode: "normal" | "hold_no_push";
  safetyNote: string | null;
} {
  const isMailboxOutbox = repo.repoId === "local-mailbox_outbox"
    || repo.perLocationDetails.some((loc) => loc.path.includes("/home/slimy/nuc-comms/mailbox_outbox"));
  if (isMailboxOutbox) {
    return {
      repoClass: "operational_queue",
      suppressNormalCleanup: true,
      suggestedMode: "hold_no_push",
      safetyNote: "Operational mailbox/outbox transport. Hold/no-push unless explicitly draining queue.",
    };
  }

  return {
    repoClass: "standard",
    suppressNormalCleanup: false,
    suggestedMode: "normal",
    safetyNote: null,
  };
}

function buildProofCommands(machineId: string, path: string, inspectCommands: string[]): string[] {
  const safeRepo = path.split("/").filter(Boolean).pop() ?? "repo";
  return [
    `PROOF_DIR=/tmp/gh_tracker_maintenance_proof_${safeRepo}_$(date -u +%Y%m%dT%H%M%SZ)`,
    'mkdir -p "$PROOF_DIR"',
    `printf '%s\n' '${machineId}:${path}' > "$PROOF_DIR"/location.txt`,
    `printf '%s\n' 'manual-proof-only' > "$PROOF_DIR"/mode.txt`,
    ...inspectCommands.map((cmd, idx) => `${cmd} > "$PROOF_DIR"/step_${String(idx + 1).padStart(2, "0")}.txt`),
    'ls -la "$PROOF_DIR"',
  ];
}

function machineRemotePrefix(machineId: string): string | null {
  if (machineId === "nuc1") return "ssh nuc1";
  if (machineId === "nuc2") return "ssh nuc2";
  if (machineId === "laptop") return null;
  return "SSH alias unknown";
}

function bandFromScore(score: number): CleanupPriorityBand {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  if (score >= 10) return "low";
  return "info";
}

export function buildCleanupPlanner(canonicalRepos: CanonicalRepoView[]): CleanupPlannerEntry[] {
  const entries = canonicalRepos.map((repo) => {
    const classification = classifyRepo(repo);
    let priorityScore = 0;
    const reasons: string[] = [];
    const suggestions: string[] = [];
    const recommended = new Set<string>();

    const dirtyLocations = repo.perLocationDetails.filter((loc) => loc.dirty);
    const isDirty = repo.dirtyState === "dirty" || repo.dirtyState === "mixed";
    const hasUnpushed = repo.unpushedTotal > 0;

    if (isDirty && hasUnpushed) {
      priorityScore += 50;
      reasons.push("Dirty working tree with unpushed commits");
      recommended.add("Review and commit or stash local changes");
      recommended.add("Push local commits after review");
    }
    if (repo.unpushedTotal > 10) {
      priorityScore += 35;
      reasons.push(`Large unpushed backlog (${repo.unpushedTotal})`);
      recommended.add("Push local commits after review");
    } else if (hasUnpushed) {
      priorityScore += 25;
      reasons.push(`Unpushed commits present (${repo.unpushedTotal})`);
      recommended.add("Push local commits after review");
    }
    if (dirtyLocations.length > 1) {
      priorityScore += 25;
      reasons.push("Dirty state spans multiple locations");
      recommended.add("Review and commit or stash local changes");
    }
    if (repo.dirtyState === "mixed") {
      priorityScore += 20;
      reasons.push("Mixed state across machines");
    }
    if (repo.dirtyState === "dirty") {
      priorityScore += 15;
      reasons.push("Dirty working tree");
      recommended.add("Review and commit or stash local changes");
    }

    const github = repo.github;
    if ((github?.pullRequests.open ?? 0) > 0) {
      priorityScore += 15;
      reasons.push(`Open pull requests (${github?.pullRequests.open})`);
      recommended.add("Triage PRs/issues");
    }
    if ((github?.issues.open ?? 0) > 0) {
      priorityScore += 10;
      reasons.push(`Open issues (${github?.issues.open})`);
      recommended.add("Triage PRs/issues");
    }
    if (github?.ci.status === "none") {
      priorityScore += 10;
      suggestions.push("CI not configured yet");
      recommended.add("Configure CI");
    }
    if (github?.latestRelease.status === "none") {
      priorityScore += 10;
      suggestions.push("Release tagging not configured yet");
      recommended.add("Plan release");
    }
    if (repo.combinedCommits < 3) {
      priorityScore += 5;
      reasons.push("Maintenance momentum is low");
      recommended.add("Schedule maintenance block");
    }

    if (reasons.length === 0) {
      reasons.push("No immediate cleanup pressure detected");
      recommended.add("Monitor repository health");
    }

    if (classification.repoClass === "operational_queue") {
      reasons.unshift("Operational queue repo");
      suggestions.unshift("Mailbox transport: hold/no-push unless explicitly draining queue");
      recommended.clear();
      recommended.add("Inspect queue state and proof pack");
      recommended.add("Hold push unless explicit drain request");
      priorityScore = Math.min(priorityScore, 5);
    }

    const safeCommandGroups = repo.perLocationDetails.map((loc) => {
      const remote = machineRemotePrefix(loc.machineId);
      const baseCmds = remote ? [remote] : [];
      let commands: string[];
      let context: CleanupCommandGroup["context"];

      if (loc.dirty) {
        context = "inspect-dirty";
        commands = [
          ...baseCmds,
          `cd ${loc.path}`,
          "git status --branch --short",
          "git diff --stat",
          "git log --oneline -5",
          "git branch --show-current",
        ];
      } else if (loc.unpushedCommits > 0) {
        context = "inspect-unpushed";
        commands = [
          ...baseCmds,
          `cd ${loc.path}`,
          "git status --branch --short",
          `git log --oneline @{u}..HEAD`,
          "git diff --stat @{u}..HEAD",
          "git branch --show-current",
        ];
      } else {
        context = "verify-health";
        commands = [
          ...baseCmds,
          `cd ${loc.path}`,
          "git status --branch --short",
          "git log --oneline -3",
          "git remote -v",
        ];
      }

      return {
        machineId: loc.machineId,
        path: loc.path,
        runLabel: loc.machineId === "laptop" ? "Run on laptop" : "Run on machine",
        commands,
        context,
      };
    });

    const proofCommandGroups = safeCommandGroups.map((group) => ({
      machineId: group.machineId,
      path: group.path,
      runLabel: group.runLabel,
      context: "capture-proof" as const,
      commands: buildProofCommands(group.machineId, group.path, group.commands),
    }));

    return {
      repoId: repo.repoId,
      displayName: repo.displayName,
      repoClass: classification.repoClass,
      suppressNormalCleanup: classification.suppressNormalCleanup,
      suggestedMode: classification.suggestedMode,
      safetyNote: classification.safetyNote,
      priorityScore,
      priorityBand: bandFromScore(priorityScore),
      reasons,
      suggestions,
      recommendedActions: Array.from(recommended),
      affectedMachines: repo.machines,
      affectedLocations: repo.perLocationDetails.map((loc) => ({
        machineId: loc.machineId,
        path: loc.path,
        branch: loc.branch,
        dirty: loc.dirty,
        unpushedCommits: loc.unpushedCommits,
      })),
      safeCommandGroups,
      proofCommandGroups,
    };
  });

  return entries.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (b.affectedLocations.length !== a.affectedLocations.length) return b.affectedLocations.length - a.affectedLocations.length;
    return a.repoId.localeCompare(b.repoId);
  });
}
