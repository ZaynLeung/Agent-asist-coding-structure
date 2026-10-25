#!/usr/bin/env sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[run-tests] root=$ROOT_DIR"

ran=0

if [ -f "package.json" ]; then
  if command -v npm >/dev/null 2>&1; then
    echo "[run-tests] detected node project"
    npm test
    ran=$((ran + 1))
  else
    echo "[run-tests] npm not found; skip node tests"
  fi
fi

if command -v pytest >/dev/null 2>&1; then
  if [ -d "tests" ] || find . -maxdepth 3 -name "test_*.py" -o -name "*_test.py" | grep -q .; then
    echo "[run-tests] detected python tests"
    pytest -q
    ran=$((ran + 1))
  fi
fi

if [ "$ran" -eq 0 ]; then
  echo "[run-tests] no tests executed (no recognized test runner/project files)"
fi
