#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: ./scripts/db_restore.sh /absolute/or/relative/path/to/dumpfile"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INPUT_PATH="$1"

if [[ ! -f "${INPUT_PATH}" ]]; then
  echo "Dump file not found: ${INPUT_PATH}"
  exit 1
fi

docker compose cp "${INPUT_PATH}" postgres:/tmp/db.dump
docker compose exec -T postgres pg_restore \
  -U dockcleaner \
  -d dockcleaner \
  --clean \
  --if-exists \
  /tmp/db.dump
docker compose exec -T postgres rm -f /tmp/db.dump

echo "Restore completed from: ${INPUT_PATH}"
