#!/usr/bin/env bash
# Exposure audit for debug-runbooks. Reports rule names and locations only,
# never the matched values. Exit 1 when any rule matches.
#
# Usage:
#   scripts/audit-exposure.sh tree             # tracked files at HEAD
#   scripts/audit-exposure.sh staged           # staged changes before commit
#   scripts/audit-exposure.sh range <A..B>     # added lines in a commit range
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 2
mode="${1:-tree}"
range="${2:-}"

rules=(
  "telegram-bot-token|[0-9]{8,10}:[A-Za-z0-9_-]{30,}"
  "model-api-key|sk-(or-)?[A-Za-z0-9_-]{16,}"
  "aws-access-key|AKIA[0-9A-Z]{16}"
  "github-token|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}"
  "slack-token|xox[baprs]-[A-Za-z0-9-]{10,}"
  "google-api-key|AIza[0-9A-Za-z_-]{30,}"
  "private-key-block|-----BEGIN [A-Z ]*PRIVATE KEY"
  "assigned-secret|(password|passwd|secret|token|api[_-]?key)[\"']?[ ]?[:=][ ]?[\"']?[A-Za-z0-9/_+.-]{12,}"
  "email-address|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}"
  "phone-number|\+[0-9]{8,}"
)

added_lines() {
  case "$mode" in
    staged) git diff --cached -U0 ;;
    range)  git log -p --no-merges "$range" -- . ;;
    *)      git grep -nIE "" -- . ':!site/package-lock.json' ;;
  esac
}

hits=0
if [ "$mode" = "tree" ]; then
  input="$(added_lines)"
else
  input="$(added_lines | grep -E '^\+' | grep -vE '^\+\+\+')"
fi

for rule in "${rules[@]}"; do
  name="${rule%%|*}"; pattern="${rule#*|}"
  count=$(printf '%s\n' "$input" | grep -cE -e "$pattern" || true)
  if [ "$count" -gt 0 ]; then
    hits=$((hits+1))
    echo "MATCH  $name  lines=$count"
    if [ "$mode" = "tree" ]; then
      git grep -lIE -e "$pattern" -- . ':!site/package-lock.json' | sed 's/^/         file: /'
    fi
  fi
done

if [ "$hits" -eq 0 ]; then echo "CLEAN  no rule matched ($mode)"; exit 0; fi
echo "FOUND  $hits rule(s) matched. Values are not printed; inspect the locations."
exit 1
