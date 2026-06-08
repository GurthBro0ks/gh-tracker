import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";

const getSession = vi.fn();
const requireOwner = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSession, requireOwner }));

const repoRoot = process.cwd();

describe("Habitat /ops fixture-only page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    requireOwner.mockReturnValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
  });

  it("renders the fixture-only /ops page and required cards", async () => {
    const { default: HabitatOpsPage } = await import("../../app/ops/page");
    const html = renderToStaticMarkup(await HabitatOpsPage());

    expect(html).toContain("Habitat /ops");
    expect(html).toContain("READ ONLY");
    expect(html).toContain("DRY RUN ONLY");
    expect(html).toContain("NO LIVE MUTATION");
    expect(html).toContain("FIXTURE ONLY");
    expect(html).toContain("Notification Status");
    expect(html).toContain("Schedule Inventory");
    expect(html).toContain("Schedule Dry-Run");
    expect(html).toContain("Tmux Inventory");
    expect(html).toContain("Workspace Dry-Run");
    expect(html).toContain("Reports");
    expect(html).toContain("Backend adapter not connected.");
    expect(html).toContain("Shell execution is not present in this route.");
  });

  it("keeps the route fixture-only and free of action buttons or forms", () => {
    const pageSource = readFileSync(join(repoRoot, "src/app/ops/page.tsx"), "utf8");

    expect(pageSource).toContain("Fixture-only operator surface");
    expect(pageSource).not.toContain("<form");
    expect(pageSource).not.toContain("<button");
    expect(pageSource).not.toContain("type=\"button\"");
    expect(pageSource).not.toContain("type=\"submit\"");
    expect(pageSource).not.toContain("Enable</button>");
    expect(pageSource).not.toContain("Disable</button>");
    expect(pageSource).not.toContain("Run Once</button>");
    expect(pageSource).not.toContain("Restart</button>");
    expect(pageSource).not.toContain("Kill</button>");
    expect(pageSource).not.toContain("Create</button>");
    expect(pageSource).not.toContain("Reuse</button>");
    expect(pageSource).not.toContain("Launch</button>");
    expect(pageSource).not.toContain("Send</button>");
    expect(pageSource).not.toContain("Delete</button>");
    expect(pageSource).not.toContain("Apply</button>");
  });

  it("introduces no shell execution imports or live runtime hooks", () => {
    const pageSource = readFileSync(join(repoRoot, "src/app/ops/page.tsx"), "utf8");
    const fixtureSource = readFileSync(join(repoRoot, "src/lib/harness-ops-fixtures.ts"), "utf8");

    for (const source of [pageSource, fixtureSource]) {
      expect(source).not.toContain("child_process");
      expect(source).not.toContain("exec(");
      expect(source).not.toContain("spawn(");
      expect(source).not.toContain("shelljs");
      expect(source).not.toContain("execa");
      expect(source).not.toContain("ops/harness-ops");
      expect(source).not.toContain("fetch(\"/api/ops");
      expect(source).not.toContain("fetch('/api/ops");
    }
  });
});
