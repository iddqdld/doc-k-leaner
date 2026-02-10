#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/data/postgres-backups"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
OUTPUT_FILE="${BACKUP_DIR}/dockcleaner_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

docker compose exec -T postgres pg_dump \
  -U dockcleaner \
  -d dockcleaner \
  -F c \
  -f "/tmp/db.dump"

docker compose cp postgres:/tmp/db.dump "${OUTPUT_FILE}"
docker compose exec -T postgres rm -f /tmp/db.dump

echo "Backup created: ${OUTPUT_FILE}"
