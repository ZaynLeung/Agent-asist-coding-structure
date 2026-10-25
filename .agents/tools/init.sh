#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SCRIPT_DIR/utils.sh"

ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"

cd "$ROOT_DIR"

dirs="
.agents
.agents/rules
.agents/skills
.agents/tools
.agents/agents
.agents/memories
.agents/prompts
.agents/templates
.agents/snippets
.agents/tasks
"

for d in $dirs; do
  ensure_dir "$d"
done

files="
.agents/AGENTS.md
.agents/rules/style.md
.agents/rules/best-practices.md
.agents/rules/coding-style.md
.agents/rules/general-rules.md
.agents/memories/lessons-learned.md
.agents/memories/project-context.md
.agents/memories/decisions.md
.agents/skills/code-review/SKILL.md
.agents/agents/coder/agent.md
.agents/tools/run-tests.sh
.agents/tools/init.sh
.agents/tools/sync.sh
.agents/tools/utils.sh
.agents/prompts/common-prompts.md
.agents/prompts/refactor-prompts.md
.agents/prompts/review-prompts.md
.agents/templates/bugfix-template.md
.agents/templates/feature-template.md
.agents/snippets/code-snippets.md
.agents/snippets/command-snippets.md
.agents/tasks/todo.md
.agents/tasks/in-progress.md
.agents/tasks/done.md
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
