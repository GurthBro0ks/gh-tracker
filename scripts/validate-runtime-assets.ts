const BASE_URL = process.env.GH_TRACKER_BASE_URL ?? "http://127.0.0.1:5055";
const CSS_STYLE_TOKENS = ["--bg-main", ".neon-panel", "--neon-edge", "radial-gradient", "font-family:var(--font-share-tech-mono)"];

function normalizeStaticPath(raw: string): string {
  return raw.replace(/\\+$/g, "").replace(/^\/+/, "");
}

async function main() {
  const loginResponse = await fetch(`${BASE_URL}/login`, {
    redirect: "follow",
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
  });
  if (!loginResponse.ok) {
    throw new Error(`login probe failed: ${loginResponse.status}`);
  }

  const html = await loginResponse.text();
  const matches = html.match(/_next\/static\/[^"\s<)]+\.(?:css|js)/g) ?? [];
  const staticPaths = Array.from(new Set(matches.map(normalizeStaticPath)));
  if (staticPaths.length === 0) {
    throw new Error("no _next/static assets found on /login");
  }

  const cssAssets = staticPaths.filter((value) => value.endsWith(".css"));
  if (cssAssets.length === 0) {
    throw new Error("no css assets referenced on /login");
  }

  let failures = 0;
  let cssTokenHits = 0;
  for (const assetPath of staticPaths) {
    const response = await fetch(`${BASE_URL}/${assetPath}`, {
      method: "GET",
      redirect: "follow",
      headers: {
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
    });
    if (response.status < 200 || response.status >= 400) {
      failures += 1;
      console.error(`asset_fail=${assetPath} status=${response.status}`);
      continue;
    }

    const body = await response.text();
    if (body.length === 0) {
      failures += 1;
      console.error(`asset_empty=${assetPath}`);
      continue;
    }

    if (assetPath.endsWith(".css")) {
      if (CSS_STYLE_TOKENS.some((token) => body.includes(token))) {
        cssTokenHits += 1;
      }
    }
  }

  if (cssTokenHits === 0) {
    failures += 1;
    console.error("css_token_match=0");
  }

  if (failures > 0) {
    throw new Error(`runtime asset validation failed for ${failures} asset(s)`);
  }

  console.log(`runtime_assets_valid=1`);
  console.log(`runtime_assets_count=${staticPaths.length}`);
  console.log(`runtime_css_assets=${cssAssets.length}`);
  console.log(`runtime_css_token_matches=${cssTokenHits}`);
}

void main().catch((error) => {
  console.error("runtime_assets_valid=0");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
