# Hermes Agent "4 commits behind" Update Warning — Stale Source-Check Cache Recovery

**Date:** 2026-09-29  
**Status:** Reported resolved; Git comparison evidence remains inconsistent
**Platform:** macOS

---

## 1. Summary

Hermes Agent CLI displayed `⚠ 4 commits behind — run hermes update to update` while local `git status -b` reported a clean, up-to-date branch. `hermes update` repeatedly timed out after 120 seconds. The recorded recovery refreshed `origin/main`, removed the installation-specific source-check cache, and restarted the CLI. The inspected cache held `behind: -1`, an unknown-count sentinel that cannot itself explain a positive count of four.

**Technical correction:** GitHub compares `BASE...HEAD` from the head's perspective. With local `e408d363393ccb72267e67bcccf4f8954b438cd9` as BASE and remote `449fae030aa6b51105db3e440610c867e6b91024` as HEAD, the recorded `ahead_by: 325, behind_by: 0, status: ahead` means the **remote** is 325 commits ahead of the local commit. It does not prove the local checkout is ahead. The later recorded equal SHAs are preserved below, but fetching alone cannot move local `HEAD`; the retained record does not establish how it reached that commit. Do not treat cache removal as a substitute for updating a checkout that is actually behind.

---

## 2. Environment

- **Operating System:** macOS (Apple Silicon, zsh)
- **Application:** Hermes Agent CLI, checkout at `/Users/wfspr/.hermes/hermes-agent`
- **Profile home:** `~/.hermes` (`HERMES_HOME=/Users/wfspr/.hermes`)
- **Installation install_id:** `9693f788c8b44a7d`
- **Branch:** `main`, tracking `origin/main` (remote `origin`, merge ref `refs/heads/main`)
- **Upstream remote:** `https://github.com/NousResearch/hermes-agent.git`
- **Git:** local `HEAD` and `origin/main` at `449fae030aa6b51105db3e440610c867e6b91024` after fetch; divergence zero
- **Shared source-check cache:** `~/.hermes/source-checks/9693f788c8b44a7d.json`
- **Cache TTL constants (from `hermes_cli/source_check.py`):** success `24 * 3600` s, failure `3600` s
- **Key source files:** `hermes_cli/banner.py` (warning renderer `_format_update_notice`, background prefetch at `274-286`), `hermes_cli/source_check.py` (`check_for_updates` at `343`, `_behind_count`, `_cached_status`, `_github_compare_behind`, constants `UPDATE_AVAILABLE_NO_COUNT = -1`)
- **Runtime note:** The banner's update result is held in-process; deleting the file-backed cache does **not** affect a currently running Hermes CLI process until that process restarts.

---

## 3. Symptoms

1. **Persistent warning banner:** `⚠ 4 commits behind — run hermes update to update` appeared on CLI startup.
2. **Conflicting git status:** `git status -b` reported `On branch main, Your branch is up to date with 'origin/main'.` with a clean working tree — inconsistent with "4 commits behind".
3. **`hermes update` timeout:** `cd /Users/wfspr/.hermes/hermes-agent && hermes update` timed out after 120 s (exit 124), no substantive updater output.
4. **Literal string not in source:** `grep -rn "4 commits behind"` in the repo returned 0 matches, confirming the number is dynamically assembled, not hardcoded.
5. **Cache inconsistency:** The shared cache at `~/.hermes/source-checks/9693f788c8b44a7d.json` contained `behind: -1` (`UPDATE_AVAILABLE_NO_COUNT`), which cannot render a positive count like `4`.

---

## 4. Root Cause

The record supports stale local-ref and cache diagnostics, but does not establish the complete cause of the positive count:

1. **Local `git status -b`** compares `HEAD` against the locally stored `origin/main` ref. On Sep 28, that local ref was stale (pointed at an older remote tip that predates ~325 upstream commits). Against the stale ref, `HEAD` appeared up to date.

2. **Banner probe and cache:** the source inspection recorded a passive update probe and an in-process result, plus a shared cache with a 24-hour success TTL. A previous positive probe could explain the banner, but no retained positive cache entry proves that sequence. The observed `-1` cannot render a numeric four.

3. **Compare direction:** for `/compare/{local}...{remote}`, `ahead_by` counts commits on the remote head relative to the local base; `behind_by` counts commits on the local base absent from the remote head. Interpret those fields in that direction before deciding the warning is stale. An identical result is `0/0`; divergence can have both counts positive.

4. **Why `behind: -1` in the inspected cache entry does not explain `4`.** `-1` is `UPDATE_AVAILABLE_NO_COUNT`, the sentinel for "probe ran, update available, but could not determine a clean count" (e.g., ancestor check inconclusive and GitHub compare unavailable). `_format_update_notice` only renders a positive count when `behind > 0`. It renders the "update available, unknown count" message for `-1`, never "4 commits behind". Therefore the visible `4` must have come from an earlier probe result that was cached (or from an in-memory result held by a prior CLI process), not from the `-1` entry.

The recorded response (`ahead_by: 325, behind_by: 0, status: ahead`) for local `e408d363...` as base and remote `449fae030...` as head means that remote target contains 325 commits missing from the local commit. It conflicts with treating the local checkout as already current; later equality needs separate operator evidence.

---

## 5. What Did Not Work

- **`git status -b` alone is insufficient.** A clean local branch and "up to date with `origin/main`" are not conclusive when `origin/main` itself may be stale. The shared source-check cache and the GitHub API probe are the authoritative sources for the update notice; local `git status` reflects only the local ref, which may lag the real upstream.
- **Searching for the literal warning text in source.** `grep -rn "4 commits behind"` returns 0 matches because the number is dynamically formatted; searching for `"commits behind"` (12 matches) and tracing `banner.py`/`source_check.py` was necessary.
- **Repeating `hermes update` while network timeouts persist.** The updater timed out multiple times (120 s each); the timeout is the symptom (stale local ref + possibly slow network to GitHub), not something the updater can fix by retrying blindly.
- **Assuming the cache's `behind: -1` was the source of `4`.** `-1` is a sentinel, not a count; a positive banner count cannot be reconstructed from it.
- **Accepting a single `git fetch --dry-run`/`git rev-list` probe.** A dry-run fetch that times out (exit 124) yields no divergence counts; a successful `git fetch origin main` that updates the local ref (and then checking `git status -b` plus a GitHub API cross-check) was required.

---

## 6. Final Fix

### Step 1 — Refresh the local upstream ref

```bash
cd /Users/wfspr/.hermes/hermes-agent
git fetch origin main
git status -b
```

Fetching refreshes the remote-tracking ref; it does not update local `HEAD` or merge changes. Inspect the resulting relationship:

```bash
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD
```

For `origin/main...HEAD`, the first count is upstream-only commits (local is behind); the second is local-only commits (local is ahead). `0 0` means identical. If behind or diverged, preserve local work and resolve the update separately before diagnosing a stale banner.

### Step 2 — Clear the stale shared source-check cache

```bash
rm ~/.hermes/source-checks/9693f788c8b44a7d.json
```

Only clear this cache after independently establishing that its result is stale. The next CLI startup re-probes and may legitimately report an update. The file path is installation-specific: `~/.hermes/source-checks/<install_id>.json`; `9693f788c8b44a7d` is the recorded incident's ID, not a universal value. Inspect and select your installation's entry before removing it.

### Step 3 — Verify the warning is gone on a cold restart

```bash
# Exit the affected interactive Hermes CLI normally, then start it again.
# Do not kill every process whose arguments contain "hermes": that may stop
# the WhatsApp gateway or other unrelated sessions.

# Then start Hermes CLI fresh and confirm the warning does not appear.
```

The in-process banner result (`_update_result` in `hermes_cli/banner.py`) is discarded when the CLI process exits; deleting the file-backed cache while a process is still running does not clear that process's in-memory result. A cold restart is required to observe the corrected notice.

### Step 4 — Optional: confirm with a GitHub API cross-check

If the local `origin/main` ref is suspected to be stale again, cross-check against the real upstream without relying on the local ref:

```bash
cd /Users/wfspr/.hermes/hermes-agent
LOCAL=$(git rev-parse HEAD)
# Real upstream tip via GitHub API (bypasses stale local ref)
REMOTE=$(curl -s -H "Accept: application/vnd.github+json" \
  -H "User-Agent: hermes-probe" \
  "https://api.github.com/repos/NousResearch/hermes-agent/commits/main" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")
echo "local:  $LOCAL"
echo "remote: $REMOTE"
if [ "$LOCAL" != "$REMOTE" ]; then
  DIFF=$(curl -s -H "Accept: application/vnd.github+json" \
    -H "User-Agent: hermes-probe" \
    "https://api.github.com/repos/NousResearch/hermes-agent/compare/$LOCAL...$REMOTE" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"ahead_by={d['ahead_by']}, behind_by={d['behind_by']}, status={d['status']}\")")
  echo "compare: $DIFF"
fi
```

---

## 7. Commands

### Diagnostics

```bash
# Branch + tracking
cd /Users/wfspr/.hermes/hermes-agent
git status -b
git config --get branch.main.remote
git config --get branch.main.merge

# Local divergence vs locally stored origin/main
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD

# Shared source-check cache (installation-specific)
ls -la ~/.hermes/source-checks/
python3 -c 'import json,pathlib; p=pathlib.Path.home()/".hermes/source-checks/9693f788c8b44a7d.json"; d=json.loads(p.read_text()); print(json.dumps({k:d[k] for k in ("behind","updateAvailable","targetSha","currentSha","ts","fetchedAt") if k in d}, indent=2))'
# Look for: "behind" (the count the banner renders), "updateAvailable",
# "targetSha", "currentSha", "ts" (cache timestamp), "fetchedAt"

# Banner + checker source locations (read-only inspection)
grep -n "_format_update_notice\|check_for_updates\|UPDATE_AVAILABLE_NO_COUNT\|_UPDATE_CHECK_CACHE_SECONDS" \
  /Users/wfspr/.hermes/hermes-agent/hermes_cli/banner.py \
  /Users/wfspr/.hermes/hermes-agent/hermes_cli/source_check.py
```

### Recovery

```bash
cd /Users/wfspr/.hermes/hermes-agent

# 1. Refresh local upstream ref
git fetch origin main
git status -b

# 2. Inspect divergence; stop cache-only recovery if genuinely behind/diverged
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD

# 3. Clear stale shared cache (installation-specific install_id)
rm ~/.hermes/source-checks/9693f788c8b44a7d.json

# 4. Cold restart of CLI to discard in-process result and re-probe
# Exit only the affected interactive CLI normally; leave gateways running.
# Then start Hermes CLI fresh
```

### Optional GitHub cross-check (when local ref is suspected stale)

```bash
cd /Users/wfspr/.hermes/hermes-agent
LOCAL=$(git rev-parse HEAD)
REMOTE=$(curl -s -H "Accept: application/vnd.github+json" \
  -H "User-Agent: hermes-probe" \
  "https://api.github.com/repos/NousResearch/hermes-agent/commits/main" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")
echo "local:  $LOCAL"
echo "remote: $REMOTE"
if [ "$LOCAL" != "$REMOTE" ]; then
  curl -s -H "Accept: application/vnd.github+json" \
    -H "User-Agent: hermes-probe" \
    "https://api.github.com/repos/NousResearch/hermes-agent/compare/$LOCAL...$REMOTE" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"ahead_by={d['ahead_by']}, behind_by={d['behind_by']}, status={d['status']}\")"
fi
```

---

## 8. Verification

After recovery, confirm all of the following:

```bash
cd /Users/wfspr/.hermes/hermes-agent

# 1. Local refs aligned, zero divergence
git status -b
# Expected: "On branch main", "up to date with 'origin/main'", clean tree
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD
# Expected: "0 0"

# 2. Shared cache absent (or re-fetched with current data)
ls ~/.hermes/source-checks/9693f788c8b44a7d.json 2>&1
# Expected: file not found (or, if Hermes has already re-probed, a fresh entry
# with "behind" = 0 and a recent "ts"/"fetchedAt")

# 3. CLI cold-start warning absent
# Kill any running CLI process, then start Hermes CLI fresh.
# Expected: no "⚠ N commits behind" banner. An "Up to date" notice or no notice is acceptable.
```

A GitHub API cross-check using `/compare/{local}...{remote}` must be interpreted as remote HEAD relative to local BASE. Only `ahead_by: 0, behind_by: 0, status: identical` establishes equality; a positive `ahead_by` means upstream commits are missing locally. The historical no-warning/equal-SHA assertions below have not been reverified on the original host during this documentation review.

---

## 9. Final Working State

| Item | Known-good value |
|------|------------------|
| Checkout | `/Users/wfspr/.hermes/hermes-agent` on `main` |
| Tracking | `origin/main` via remote `origin` |
| Local HEAD ≈ origin/main | Same SHA; divergence `0 0` |
| Shared source-check cache | Absent (or fresh, re-probed against current upstream) |
| CLI warning banner | No "N commits behind" warning on cold start |
| GitHub upstream relationship | Recorded `ahead_by: 325` meant remote ahead; reconciliation with later equal SHAs remains undocumented |
| Upstream repo | `https://github.com/NousResearch/hermes-agent.git` |

---

## 10. Optional Cleanup

- **Stale source-check cache entries:** Compare the selected entry's commit IDs and timestamp with a fresh upstream check before deciding it is stale. A newly written cache file is not by itself proof of a correct result. Leave entries alone when their counts match the actual relationship.
- **Old autostash entries:** `git stash list` should be checked before any clean-up; only entries that are confirmed stale/redundant (e.g., an update autostash with no local changes to preserve) should be dropped. Do not drop stashes that may hold local work.
- **In-process CLI:** If the warning persists after the file-backed cache is removed, the running CLI process is holding a stale in-memory `_update_result`; a cold restart (kill + fresh start) is required.

---

## 11. If This Happens Again

### Shortest diagnostic sequence

```bash
cd /Users/wfspr/.hermes/hermes-agent

# 1. Does local git agree with itself?
git status -b
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD

# 2. Is the shared cache serving a stale count?
ls ~/.hermes/source-checks/
python3 -c 'import json,pathlib; p=pathlib.Path.home()/".hermes/source-checks/9693f788c8b44a7d.json"; d=json.loads(p.read_text()); print(json.dumps({k:d[k] for k in ("behind","updateAvailable","ts","fetchedAt") if k in d}, indent=2))'

# 3. Cross-check against the real upstream (bypasses stale local ref)
LOCAL=$(git rev-parse HEAD)
REMOTE=$(curl -s -H "Accept: application/vnd.github+json" \
  -H "User-Agent: hermes-probe" \
  "https://api.github.com/repos/NousResearch/hermes-agent/commits/main" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")
echo "local:  $LOCAL"
echo "remote: $REMOTE"
if [ "$LOCAL" != "$REMOTE" ]; then
  curl -s -H "Accept: application/vnd.github+json" \
    -H "User-Agent: hermes-probe" \
    "https://api.github.com/repos/NousResearch/hermes-agent/compare/$LOCAL...$REMOTE" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"ahead_by={d['ahead_by']}, behind_by={d['behind_by']}, status={d['status']}\")"
fi

# 4. Is a CLI process holding a stale in-memory result?
pgrep -fl hermes   # if a CLI process is running, its in-memory result may be stale
```

### Shortest recovery procedure

```bash
cd /Users/wfspr/.hermes/hermes-agent

# 1. Refresh local upstream ref
git fetch origin main
git status -b   # inspect; fetch does not imply equality
git rev-list --left-right --count origin/main...HEAD
# Continue cache-only recovery only after confirming the warning is stale.

# 2. Clear the stale shared cache for this installation
rm ~/.hermes/source-checks/9693f788c8b44a7d.json

# 3. Cold restart CLI to discard in-process result
# Exit only the affected interactive CLI normally; leave gateways running.
# Then start Hermes CLI fresh and confirm the warning is gone.
```

If the warning persists after a genuine cold restart, inspect a fresh probe rather than attributing it to the old process's memory. For `/compare/{local}...{remote}`, `ahead_by > 0` indicates local missing upstream commits. Preserve local changes and inspect divergence before using the supported updater or a reviewed fast-forward; do not reset or blindly pull over local work.

### Key distinction to remember

- `git status -b` "up to date with `origin/main`" + clean tree is **not** conclusive on its own, because `origin/main` may be stale.
- The authoritative update notice comes from `check_for_updates` (file-backed cache or GitHub API probe), rendered by `_format_update_notice` in `banner.py`.
- The shared cache (`~/.hermes/source-checks/<install_id>.json`) can serve a stale positive count within its 24-hour success TTL; `-1` (`UPDATE_AVAILABLE_NO_COUNT`) is a sentinel for "update available, unknown count" and does **not** produce a positive banner count.
- A stale cache or an old in-process probe can explain a stale count, but the observed sentinel does not prove either sequence. Refresh refs, interpret divergence, and invalidate only the selected stale entry before restarting the affected CLI.

---

## 12. Lessons Learned & Prevention

1. **Do not trust `git status -b` alone for update verification.** Always cross-check the authoritative source-check result (cached or GitHub API probe) and, when the local ref is suspect, cross-check the real upstream via the GitHub compare API.
2. **Record state before updating.** Before running `hermes update`, record `git rev-parse HEAD`, `git status`, `git stash list`, and local/upstream divergence. After updating, verify the same items plus that the WhatsApp protection code and the bridge regression tests still pass.
3. **Treat a `hermes update` timeout as a diagnostic signal, not a reason to retry blindly.** A timeout alone does not identify its cause. Inspect the updater and network failures, refresh refs if possible, and cross-check divergence before invalidating a cache or retrying an update.
4. **Clear the stale shared cache when the warning is confirmed stale.** The file path is `~/.hermes/source-checks/<install_id>.json` (here `9693f788c8b44a7d.json`). A cold CLI restart is required after removal because the in-process banner holds its own result until the process exits.
5. **Distinguish `-1` from a positive count.** `-1` (`UPDATE_AVAILABLE_NO_COUNT`) is a sentinel for "update available, unknown count"; it does **not** produce a positive banner count like "4 commits behind". A positive banner count must come from a cached or in-memory probe that returned a positive count.
6. **Prefer the GitHub compare API when the local ref is suspect.** `https://api.github.com/repos/NousResearch/hermes-agent/compare/{local}…{remote}` returns `ahead_by`, `behind_by`, and `status` against the real upstream without relying on the local `origin/main` ref.
7. **Keep the source-check cache TTL in mind.** Success results are cached for 24 hours (`_UPDATE_CHECK_CACHE_SECONDS = 24 * 3600`); a stale positive count can persist within that window. Failure results are cached for 1 hour. Deleting the cache forces a fresh probe on next startup.

---

## 13. Credits

- **Incident identification:** WfSpr
- **Root cause investigation & recovery:** Hermes Agent (CLI diagnostics, source tracing, GitHub API cross-check)
- **Verification:** `git fetch origin main`, `git status -b`, GitHub compare API cross-check, shared cache inspection
- **Documentation:** Hermes Agent runbook authoring

---

*Runbook created 2026-09-30 from the verified Sep 29–30 troubleshooting session. Repository: `https://github.com/wfspr/debug-runbooks.git`, branch `main`.*
