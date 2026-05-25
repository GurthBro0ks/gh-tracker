#!/usr/bin/env bash
set -euo pipefail

# Ensure pnpm and other user binaries are available
export PATH="/home/slimy/.npm-global/bin:/home/slimy/.local/bin:${PATH}"

REPO_DIR="/opt/slimy/gh-tracker"
STATE_DIR="${HOME}/.local/state/gh-tracker/github-sync"
LOG_DIR="${STATE_DIR}/logs"
LOCKFILE="${STATE_DIR}/.sync.lock"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOGFILE="${LOG_DIR}/sync-${TIMESTAMP}.log"

# Ensure directories exist
mkdir -p "${STATE_DIR}" "${LOG_DIR}"

# Prune old logs (keep last 48)
if command -v find &>/dev/null; then
  find "${LOG_DIR}" -maxdepth 1 -name 'sync-*.log' -type f -printf '%T@ %p\n' 2>/dev/null | \
    sort -rn | tail -n +49 | cut -d' ' -f2- | xargs -r rm -f 2>/dev/null || true
fi

exec 1>"${LOGFILE}"
exec 2>&1

echo "=== GitHub Health Sync Started ==="
echo "Timestamp: ${TIMESTAMP}"
echo "Host: $(hostname)"
echo "User: $(whoami)"
echo "Repo: ${REPO_DIR}"
echo "PATH: ${PATH}"
echo ""

# Acquire lock to prevent concurrent syncs
exec 200>"${LOCKFILE}"
if ! flock -n 200; then
  echo "Another sync is already running. Exiting."
  exit 1
fi

cd "${REPO_DIR}"

echo "--- Running pnpm github:sync ---"
if ! pnpm github:sync; then
  echo "ERROR: github:sync failed"
  exit 2
fi

echo ""
echo "--- Running pnpm validate:github ---"
if ! pnpm validate:github; then
  echo "ERROR: validate:github failed"
  exit 3
fi

echo ""
echo "--- Sync completed successfully ---"
echo "Log: ${LOGFILE}"
echo "Finished: $(date -u +%Y%m%dT%H%M%SZ)"
exit 0
