const BASE_URL = process.env.GH_TRACKER_BASE_URL ?? "http://127.0.0.1:5055";

function normalizeStaticPath(raw: string): string {
  return raw.replace(/\\+$/g, "").replace(/^\/+/, "");
}

async function main() {
  const loginResponse = await fetch(`${BASE_URL}/login`, { redirect: "follow" });
  if (!loginResponse.ok) {
    throw new Error(`login probe failed: ${loginResponse.status}`);
  }

  const html = await loginResponse.text();
  const matches = html.match(/_next\/static\/[^"\s<)]+/g) ?? [];
  const staticPaths = Array.from(new Set(matches.map(normalizeStaticPath)));
  if (staticPaths.length === 0) {
    throw new Error("no _next/static assets found on /login");
  }

  const cssAssets = staticPaths.filter((value) => value.endsWith(".css"));
  if (cssAssets.length === 0) {
    throw new Error("no css assets referenced on /login");
  }

  let failures = 0;
  for (const assetPath of staticPaths) {
    const response = await fetch(`${BASE_URL}/${assetPath}`, { method: "HEAD", redirect: "follow" });
    if (response.status < 200 || response.status >= 400) {
      failures += 1;
      console.error(`asset_fail=${assetPath} status=${response.status}`);
    }
  }

  if (failures > 0) {
    throw new Error(`runtime asset validation failed for ${failures} asset(s)`);
  }

  console.log(`runtime_assets_valid=1`);
  console.log(`runtime_assets_count=${staticPaths.length}`);
  console.log(`runtime_css_assets=${cssAssets.length}`);
}

void main().catch((error) => {
  console.error("runtime_assets_valid=0");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
