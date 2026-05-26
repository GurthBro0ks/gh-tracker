/**
 * GH Tracker Auth Bridge
 * Validates credentials against Slimy monorepo auth API.
 * No password storage. No DB access. Pure server-to-server API call.
 */

export interface SlimyUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface SlimyLoginResponse {
  success: boolean;
  user?: SlimyUser;
  error?: string;
}

const SLIMY_BASE_URL = process.env.SLIMY_AUTH_BASE_URL || "https://slimyai.xyz";

export async function verifySlimyCredentials(
  email: string,
  password: string
): Promise<{ ok: true; user: SlimyUser } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(`${SLIMY_BASE_URL}/api/session/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data: SlimyLoginResponse = await res.json();

    if (!res.ok || !data.success) {
      return { ok: false, error: data.error || "Authentication failed", status: res.status };
    }

    if (!data.user) {
      return { ok: false, error: "Invalid response from auth server", status: 500 };
    }

    return { ok: true, user: data.user };
  } catch (error) {
    console.error("[AuthBridge] Slimy login request failed:", error);
    return { ok: false, error: "Auth service unavailable", status: 503 };
  }
}
