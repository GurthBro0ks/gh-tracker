import type {
  PetAnimationState,
  PetCareAction,
  PetMood,
  PetSpecies,
  PetStage,
  RepoCareAction,
  RepoHealth,
  RepoHealthBucket,
  RepoPet,
} from "@/lib/contracts";

export type RepoSignal = {
  machineId: string;
  dirty: boolean;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  aheadCount: number;
  behindCount: number;
  commitsToday: number;
  commitsLast7Days: number;
  commitsLast30Days: number;
};

type RepoSeedInput = {
  repoId: string;
  owner: string;
  name: string;
  canonicalRemote: string;
  primaryLanguage: string | null;
};

const SPECIES: PetSpecies[] = [
  "Cyber Snail",
  "Repo Slime",
  "Circuit Moth",
  "Pixel Crab",
  "Data Frog",
  "Terminal Bat",
  "Gear Turtle",
  "Market Mantis",
  "Arcade Golem",
  "Paper Owl",
];

function hashStable(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function bucketFromScore(score: number): RepoHealthBucket {
  if (score >= 90) return "legendary";
  if (score >= 75) return "healthy";
  if (score >= 55) return "needs_care";
  if (score >= 35) return "stressed";
  return "sick";
}

export function deriveRepoHealth(location: RepoSignal): RepoHealth {
  const localPenalty = (location.dirty ? 18 : 0) + location.stagedCount * 2 + location.unstagedCount * 2 + location.untrackedCount;
  const localScore = clamp(100 - localPenalty);
  const syncPenalty = location.aheadCount * 7 + location.behindCount * 8;
  const syncScore = clamp(100 - syncPenalty);
  const momentumRaw = location.commitsLast30Days <= 0 ? 20 : (location.commitsLast7Days / Math.max(1, location.commitsLast30Days)) * 100;
  const activityScore = clamp(momentumRaw + Math.min(location.commitsToday * 6, 20));

  const score = clamp(localScore * 0.4 + syncScore * 0.35 + activityScore * 0.25);
  const attentionReasons: RepoHealth["attentionReasons"] = [];
  const careActions: RepoCareAction[] = [];

  if (location.dirty) {
    attentionReasons.push("dirty_worktree");
    careActions.push("commit_or_stash_changes");
  }
  if (location.aheadCount > 0) {
    attentionReasons.push("unpushed_commits");
    careActions.push("push_local_commits");
  }
  if (location.behindCount > 0) {
    attentionReasons.push("behind_remote");
    careActions.push("pull_and_rebase");
  }
  if (location.commitsLast7Days < 2) {
    attentionReasons.push("low_activity");
    careActions.push("schedule_maintenance");
  }

  attentionReasons.push("release_unknown", "ci_unknown", "pr_pressure_unknown", "issue_pressure_unknown");
  careActions.push("review_release_plan", "set_up_ci_sync", "triage_prs", "triage_issues");

  return {
    score,
    bucket: bucketFromScore(score),
    release: {
      freshnessDays: null,
      commitsSinceRelease: null,
      status: "not_synced",
    },
    sync: {
      score: syncScore,
      aheadCount: location.aheadCount,
      behindCount: location.behindCount,
      githubSyncConfigured: false,
    },
    local: {
      score: localScore,
      dirty: location.dirty,
      stagedCount: location.stagedCount,
      unstagedCount: location.unstagedCount,
      untrackedCount: location.untrackedCount,
    },
    activity: {
      score: activityScore,
      commitsToday: location.commitsToday,
      commitsLast7Days: location.commitsLast7Days,
      commitsLast30Days: location.commitsLast30Days,
    },
    ci: {
      status: "not_synced",
      lastRunAt: null,
    },
    prPressure: null,
    issuePressure: null,
    attentionReasons: Array.from(new Set(attentionReasons)),
    careActions: Array.from(new Set(careActions)),
  };
}

export type PetEvolutionStage = Exclude<PetStage, "unknown">;

export type PetEvolutionInput = {
  commitsTotal: number;
  recentActivity: number;
  healthScore: number;
  githubSynced: boolean;
};

export function calculatePetMaturityScore(input: PetEvolutionInput) {
  const commitsTotal = Math.max(0, Math.floor(input.commitsTotal));
  const recentActivity = Math.max(0, Math.floor(input.recentActivity));
  const activeRepoBonus = commitsTotal > 0 || recentActivity > 0;
  const healthBonus = activeRepoBonus ? Math.floor(Math.max(0, input.healthScore) / 25) : 0;
  const githubBonus = activeRepoBonus && input.githubSynced ? 2 : 0;
  return commitsTotal + recentActivity * 2 + healthBonus + githubBonus;
}

export function petStageFromMaturityScore(score: number): PetEvolutionStage {
  if (score >= 61) return "adult";
  if (score >= 16) return "juvenile";
  if (score >= 3) return "hatchling";
  return "egg";
}

function stageFromSignals(location: RepoSignal, health: RepoHealth): PetEvolutionStage {
  const maturityScore = calculatePetMaturityScore({
    commitsTotal: location.commitsLast30Days,
    recentActivity: location.commitsToday + location.commitsLast7Days,
    healthScore: health.score,
    githubSynced: health.sync.githubSyncConfigured,
  });
  return petStageFromMaturityScore(maturityScore);
}

function moodFromHealth(health: RepoHealth): PetMood {
  if (health.bucket === "legendary") return "legendary";
  if (health.score >= 75) return health.activity.score > 65 ? "happy" : "focused";
  if (health.score >= 55) return "curious";
  if (health.score >= 35) return "stressed";
  return "sick";
}

function animationFromMood(mood: PetMood, stage: PetStage): PetAnimationState {
  if (stage === "egg") return "wobble";
  if (stage === "hatchling") return "hatch";
  if (mood === "legendary") return "evolve";
  if (mood === "happy") return "happy";
  if (mood === "stressed") return "stressed";
  if (mood === "sick") return "sick";
  if (mood === "sleepy") return "sleep";
  return "idle";
}

function petCareFromRepoActions(actions: RepoCareAction[]): PetCareAction[] {
  const mapped: PetCareAction[] = [];
  for (const action of actions) {
    if (action === "commit_or_stash_changes") mapped.push("code_cleanup");
    if (action === "push_local_commits" || action === "pull_and_rebase") mapped.push("sync_repo");
    if (action === "review_release_plan") mapped.push("ship_release");
    if (action === "triage_prs" || action === "triage_issues") mapped.push("reduce_backlog");
    if (action === "set_up_ci_sync") mapped.push("stabilize_ci");
    if (action === "schedule_maintenance") mapped.push("rest_cycle");
  }
  return Array.from(new Set(mapped));
}

export function generateRepoPet(seed: RepoSeedInput, location: RepoSignal, health: RepoHealth): RepoPet {
  const stableSeed = `${seed.owner}/${seed.name}|${seed.canonicalRemote}|${seed.repoId}|${seed.primaryLanguage ?? "unknown"}`;
  const seedHash = hashStable(stableSeed);
  const languageBias = seed.primaryLanguage ? hashStable(seed.primaryLanguage) : 0;
  const species = SPECIES[(seedHash + languageBias) % SPECIES.length];
  const stage = stageFromSignals(location, health);
  const mood = moodFromHealth(health);
  const animationState = animationFromMood(mood, stage);

  const maturity = clamp(location.commitsLast30Days * 4);
  const trust = clamp(health.sync.score * 0.6 + health.local.score * 0.4);
  const focus = clamp(health.activity.score * 0.7 + health.sync.score * 0.3);

  return {
    id: `${seed.repoId}-pet`,
    repoId: seed.repoId,
    petName: `${species} ${seed.name}`,
    species,
    stage,
    mood,
    animationState,
    stats: {
      energy: clamp(health.activity.score),
      cleanliness: clamp(health.local.score),
      focus,
      trust,
      maturity,
      glow: clamp((health.score + trust) / 2),
    },
    evolution: {
      currentStage: stage,
      nextStage: stage === "adult" ? null : stage === "juvenile" ? "adult" : stage === "hatchling" ? "juvenile" : "hatchling",
      progressPct: clamp((maturity + trust) / 2),
    },
    careActions: petCareFromRepoActions(health.careActions),
  };
}
