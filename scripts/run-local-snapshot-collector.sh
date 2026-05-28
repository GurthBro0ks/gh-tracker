#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/slimy/.npm-global/bin:/home/slimy/.local/bin:${PATH}"

REPO_DIR="/opt/slimy/gh-tracker"
STATE_DIR="${HOME}/.local/state/gh-tracker/local-snapshot"
LOG_DIR="${STATE_DIR}/logs"
LOCKFILE="${STATE_DIR}/.collector.lock"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOGFILE="${LOG_DIR}/collector-${TIMESTAMP}.log"

mkdir -p "${STATE_DIR}" "${LOG_DIR}"

if command -v find &>/dev/null; then
  find "${LOG_DIR}" -maxdepth 1 -name 'collector-*.log' -type f -printf '%T@ %p\n' 2>/dev/null | \
    sort -rn | tail -n +49 | cut -d' ' -f2- | xargs -r rm -f 2>/dev/null || true
fi

exec 1>"${LOGFILE}"
exec 2>&1

echo "=== Local Snapshot Collector Started ==="
echo "Timestamp: ${TIMESTAMP}"
echo "Host: $(hostname)"
echo "User: $(whoami)"
echo "Repo: ${REPO_DIR}"
echo "PATH: ${PATH}"
echo ""

exec 200>"${LOCKFILE}"
if ! flock -n 200; then
  echo "Another local snapshot collector run is already in progress. Exiting."
  exit 1
fi

cd "${REPO_DIR}"

echo "--- Running pnpm collect:local ---"
pnpm collect:local

echo ""
echo "--- Running pnpm validate:snapshot ---"
pnpm validate:snapshot

echo ""
echo "--- Running pnpm aggregate:snapshots ---"
pnpm aggregate:snapshots

echo ""
echo "--- Running pnpm validate:aggregate ---"
pnpm validate:aggregate

echo ""
echo "--- Local snapshot collector completed successfully ---"
echo "Log: ${LOGFILE}"
echo "Finished: $(date -u +%Y%m%dT%H%M%SZ)"
exit 0
