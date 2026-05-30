import { NextRequest, NextResponse } from "next/server";
import { getSession, requireOwner } from "@/lib/auth/session";
import {
  readAlertPreferences,
  writeAlertPreferences,
} from "@/lib/alert-preferences";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  try {
    requireOwner(session);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const prefs = await readAlertPreferences();
  return NextResponse.json(prefs);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  try {
    requireOwner(session);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const current = await readAlertPreferences();

    const dismissedAlertIds = Array.isArray(body.dismissedAlertIds)
      ? body.dismissedAlertIds.filter((id: unknown) => typeof id === "string")
      : current.dismissedAlertIds;

    const snoozedUntilByAlertId: Record<string, number> = {};
    if (typeof body.snoozedUntilByAlertId === "object" && body.snoozedUntilByAlertId !== null) {
      for (const [key, value] of Object.entries(body.snoozedUntilByAlertId)) {
        if (typeof value === "number") {
          snoozedUntilByAlertId[key] = value;
        }
      }
    } else {
      Object.assign(snoozedUntilByAlertId, current.snoozedUntilByAlertId);
    }

    const updated: typeof current = {
      dismissedAlertIds,
      snoozedUntilByAlertId,
      updatedAt: Date.now(),
    };

    await writeAlertPreferences(updated);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
}
