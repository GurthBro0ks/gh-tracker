import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getSession = vi.fn();
const requireOwner = vi.fn();
const readAlertPreferences = vi.fn();
const writeAlertPreferences = vi.fn();

vi.mock("@/lib/auth/session", () => ({ getSession, requireOwner }));
vi.mock("@/lib/alert-preferences", () => ({
  readAlertPreferences,
  writeAlertPreferences,
  makeDefaultPreferences: () => ({
    dismissedAlertIds: [],
    snoozedUntilByAlertId: {},
    updatedAt: 0,
  }),
}));

describe("GET /api/alerts/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    getSession.mockResolvedValue(null);
    requireOwner.mockImplementation(() => { throw new Error("unauthorized"); });
    const { GET } = await import("../preferences/route");
    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 for non-owner session", async () => {
    getSession.mockResolvedValue({ sub: "u1", email: "user@test.com", role: "member", iat: 0, exp: 9999999999 });
    requireOwner.mockImplementation(() => { throw new Error("unauthorized"); });
    const { GET } = await import("../preferences/route");
    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns current preferences for authenticated owner", async () => {
    getSession.mockResolvedValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    requireOwner.mockReturnValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    readAlertPreferences.mockResolvedValue({
      dismissedAlertIds: ["alert_abc"],
      snoozedUntilByAlertId: {},
      updatedAt: 1000,
    });
    const { GET } = await import("../preferences/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.dismissedAlertIds).toEqual(["alert_abc"]);
    expect(body.updatedAt).toBe(1000);
  });

  it("returns safe defaults when no preferences stored", async () => {
    getSession.mockResolvedValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    requireOwner.mockReturnValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    readAlertPreferences.mockResolvedValue({
      dismissedAlertIds: [],
      snoozedUntilByAlertId: {},
      updatedAt: 0,
    });
    const { GET } = await import("../preferences/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.dismissedAlertIds).toEqual([]);
    expect(body.updatedAt).toBe(0);
  });
});

describe("POST /api/alerts/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readAlertPreferences.mockResolvedValue({
      dismissedAlertIds: [],
      snoozedUntilByAlertId: {},
      updatedAt: 0,
    });
  });

  it("returns 401 without session", async () => {
    getSession.mockResolvedValue(null);
    requireOwner.mockImplementation(() => { throw new Error("unauthorized"); });
    const { POST } = await import("../preferences/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/alerts/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismissedAlertIds: ["alert_test"] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 401 for non-owner session", async () => {
    getSession.mockResolvedValue({ sub: "u1", email: "user@test.com", role: "member", iat: 0, exp: 9999999999 });
    requireOwner.mockImplementation(() => { throw new Error("unauthorized"); });
    const { POST } = await import("../preferences/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/alerts/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismissedAlertIds: ["alert_test"] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("persists dismissed alert IDs for owner", async () => {
    getSession.mockResolvedValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    requireOwner.mockReturnValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    readAlertPreferences.mockResolvedValue({ dismissedAlertIds: [], snoozedUntilByAlertId: {}, updatedAt: 0 });
    writeAlertPreferences.mockResolvedValue(undefined);
    const { POST } = await import("../preferences/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/alerts/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismissedAlertIds: ["alert_test_id"] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.dismissedAlertIds).toContain("alert_test_id");
    expect(writeAlertPreferences).toHaveBeenCalledTimes(1);
  });

  it("persists snoozed alert timestamps for owner", async () => {
    getSession.mockResolvedValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    requireOwner.mockReturnValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    readAlertPreferences.mockResolvedValue({ dismissedAlertIds: [], snoozedUntilByAlertId: {}, updatedAt: 0 });
    writeAlertPreferences.mockResolvedValue(undefined);
    const { POST } = await import("../preferences/route");
    const snoozeUntil = Date.now() + 3600000;
    const request = new NextRequest("http://127.0.0.1:5055/api/alerts/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dismissedAlertIds: [],
        snoozedUntilByAlertId: { "alert_snoozed": snoozeUntil },
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.snoozedUntilByAlertId["alert_snoozed"]).toBe(snoozeUntil);
  });

  it("filters non-string dismissed IDs", async () => {
    getSession.mockResolvedValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    requireOwner.mockReturnValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    readAlertPreferences.mockResolvedValue({ dismissedAlertIds: [], snoozedUntilByAlertId: {}, updatedAt: 0 });
    writeAlertPreferences.mockResolvedValue(undefined);
    const { POST } = await import("../preferences/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/alerts/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismissedAlertIds: ["valid_id", 123, null, true] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.dismissedAlertIds).toEqual(["valid_id"]);
  });

  it("returns 400 for invalid JSON body", async () => {
    getSession.mockResolvedValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    requireOwner.mockReturnValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    const { POST } = await import("../preferences/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/alerts/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("preserves existing snoozed state when not in body", async () => {
    getSession.mockResolvedValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    requireOwner.mockReturnValue({ sub: "u1", email: "owner@test.com", role: "owner", iat: 0, exp: 9999999999 });
    readAlertPreferences.mockResolvedValue({
      dismissedAlertIds: [],
      snoozedUntilByAlertId: { "existing_snooze": 99999 },
      updatedAt: 100,
    });
    writeAlertPreferences.mockResolvedValue(undefined);
    const { POST } = await import("../preferences/route");
    const request = new NextRequest("http://127.0.0.1:5055/api/alerts/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dismissedAlertIds: ["new_dismiss"] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.dismissedAlertIds).toContain("new_dismiss");
    expect(body.dismissedAlertIds).not.toContain("existing_snooze");
  });
});
