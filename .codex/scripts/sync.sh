#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/utils.sh"

ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"

TARGET_DIR="${1:-}"
if [ -z "$TARGET_DIR" ]; then
  die "usage: bash .codex/scripts/sync.sh <target_dir>"
fi

cd "$ROOT_DIR"

ensure_dir "$TARGET_DIR"

items="
.codex
README.md
AGENTS.md
.config.toml
CHANGELOG.md
.gitignore
"

if require_cmd rsync; then
  for it in $items; do
    if [ -e "$it" ]; then
      rsync -a "$it" "$TARGET_DIR/"
    fi
  done
  log_ok "synced via rsync to: $TARGET_DIR"
else
  for it in $items; do
    if [ -e "$it" ]; then
      cp -R "$it" "$TARGET_DIR/"
    fi
  done
  log_ok "synced via cp to: $TARGET_DIR"
fi
