#!/usr/bin/env sh

set -eu

if [ "${TERM:-}" = "dumb" ]; then
  _C_RESET=""
  _C_RED=""
  _C_YELLOW=""
  _C_GREEN=""
  _C_BLUE=""
else
  _C_RESET="$(printf '\033[0m')"
  _C_RED="$(printf '\033[31m')"
  _C_YELLOW="$(printf '\033[33m')"
  _C_GREEN="$(printf '\033[32m')"
  _C_BLUE="$(printf '\033[34m')"
fi

log_info() { printf '%sINFO%s %s\n' "$_C_BLUE" "$_C_RESET" "$*"; }
log_ok() { printf '%sOK%s %s\n' "$_C_GREEN" "$_C_RESET" "$*"; }
log_warn() { printf '%sWARN%s %s\n' "$_C_YELLOW" "$_C_RESET" "$*"; }
log_err() { printf '%sERR%s %s\n' "$_C_RED" "$_C_RESET" "$*"; }

die() { log_err "$*"; exit 1; }

ensure_dir() {
  d="$1"
  if [ -d "$d" ]; then
    return 0
  fi
  mkdir -p "$d"
}

ensure_file() {
  f="$1"
  if [ -f "$f" ]; then
    return 0
  fi
  ensure_dir "$(dirname "$f")"
  : >"$f"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1
}
