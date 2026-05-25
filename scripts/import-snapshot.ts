import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { snapshotEnvelopeSchema } from "../src/lib/snapshot-schema";

const MACHINES_DIR = path.join(process.cwd(), "data", "snapshots", "machines");
const INBOX_DIR = path.join(process.cwd(), "data", "inbox");

const CREDENTIAL_IN_URL = /(https?:\/\/)[^\/@\s]+@/i;
const UNSAFE_QUERY_VALUE = /([?&][^=]{1,40}=)(?!<redacted>)[^&\s]+/i;
const PATH_TRAVERSAL = /\.\.|\\|\0/;

function toTimestamp(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function redactRemote(remote: string): string {
  return remote
    .replace(/(https?:\/\/)([^\/@\s]+)@/gi, "$1<redacted>@")
    .replace(/([?&][^=]{1,40}=)[^&\s]+/g, "$1<redacted>");
}

function normalizeMachineId(raw: string): string {
  const lowered = raw.toLowerCase().trim();
  if (lowered === "slimy-nuc1" || lowered === "nuc1") return "nuc1";
  if (lowered === "slimy-nuc2" || lowered === "nuc2") return "nuc2";
  if (lowered.includes("laptop")) return "laptop";
  return lowered.replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

async function main() {
  const args = process.argv.slice(2);
  const inputPath = args.find((arg) => !arg.startsWith("--"));

  if (!inputPath) {
    process.stderr.write("Usage: pnpm import:snapshot -- <path-to-snapshot-json>\n");
    process.exit(1);
  }

  const resolvedPath = path.resolve(inputPath);
  const cwd = process.cwd();

  // Reject path traversal
  if (PATH_TRAVERSAL.test(inputPath)) {
    throw new Error("path traversal detected in input path");
  }

  // Only allow reading from cwd tree or inbox
  if (!resolvedPath.startsWith(cwd) && !resolvedPath.startsWith(INBOX_DIR)) {
    throw new Error("input path must be within project directory or inbox");
  }

  let raw = "";
  try {
    raw = await readFile(resolvedPath, "utf8");
  } catch {
    throw new Error(`cannot read snapshot file: ${resolvedPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("malformed JSON in snapshot file");
  }

  const snapshot = snapshotEnvelopeSchema.parse(parsed);

  if (!snapshot.machine?.id) {
    throw new Error("snapshot missing machine.id");
  }

  const machineId = normalizeMachineId(snapshot.machine.id);

  for (const location of snapshot.repoLocations) {
    if (CREDENTIAL_IN_URL.test(location.remoteUrlRedacted)) {
      throw new Error(`credential segment not redacted: ${location.id}`);
    }
    if (UNSAFE_QUERY_VALUE.test(location.remoteUrlRedacted)) {
      throw new Error(`unredacted secret-like token in remote: ${location.id}`);
    }
    // Auto-redact if needed
    location.remoteUrlRedacted = redactRemote(location.remoteUrlRedacted);
  }

  const machineDir = path.join(MACHINES_DIR, machineId);
  const historyDir = path.join(machineDir, "history");
  await mkdir(historyDir, { recursive: true });

  const ts = toTimestamp(snapshot.createdAt);
  const latestPath = path.join(machineDir, "latest.json");
  const historyPath = path.join(historyDir, `${ts}.json`);

  await writeFile(latestPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeFile(historyPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  process.stdout.write(`machine=${machineId}\n`);
  process.stdout.write(`latest=${latestPath}\n`);
  process.stdout.write(`history=${historyPath}\n`);
  process.stdout.write(`repo_locations=${snapshot.repoLocations.length}\n`);
}

main().catch((error) => {
  process.stderr.write(`${(error as Error).stack || (error as Error).message}\n`);
  process.exit(1);
});
