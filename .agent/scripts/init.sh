#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/utils.sh"

ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"

cd "$ROOT_DIR"

dirs="
.codex
.codex/rules
.codex/prompts
.codex/templates
.codex/snippets
.codex/tasks
.codex/memory
.codex/scripts
"

for d in $dirs; do
  ensure_dir "$d"
done

files="
README.md
AGENTS.md
.gitignore
.config.toml
CHANGELOG.md
.codex/rules/best-practices.md
.codex/rules/coding-style.md
.codex/rules/general-rules.md
.codex/prompts/common-prompts.md
.codex/prompts/refactor-prompts.md
.codex/prompts/review-prompts.md
.codex/templates/bugfix-template.md
.codex/templates/feature-template.md
.codex/snippets/code-snippets.md
.codex/snippets/command-snippets.md
.codex/tasks/done.md
.codex/tasks/in-progress.md
.codex/tasks/todo.md
.codex/memory/decisions.md
.codex/memory/lessons-learned.md
.codex/memory/project-context.md
.codex/scripts/init.sh
.codex/scripts/sync.sh
.codex/scripts/utils.sh
"

created=0
for f in $files; do
  if [ -f "$f" ]; then
    log_warn "exists: $f"
  else
    ensure_file "$f"
    log_ok "created: $f"
    created=$((created + 1))
  fi
done

log_info "done. created_files=$created"
