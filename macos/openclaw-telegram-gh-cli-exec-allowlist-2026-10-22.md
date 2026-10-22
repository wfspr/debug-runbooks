# macos/openclaw-telegram-gh-cli-exec-allowlist-2026-10-22.md
**Date:** 2026-10-22  

**Status:** Fixed  

**Platform:** macOS  

---

## 1. Summary

Telegram users were unable to execute GitHub CLI (`gh`) commands through OpenClaw due to missing executable allowlist entry for `gh`. The issue was resolved by adding the `gh` binary to the Gateway execution allowlist with proper agent and gateway scoping.

---

## 2. Environment

- **Operating system:** macOS 27.0.1 (arm64)  
- **Hardware:** Apple Silicon  
- **Shell:** zsh  
- **Runtime:** OpenClaw 2026.10.5 (1b58cb9)  
- **Application/tool:** GitHub CLI 2.97.0  
- **Relevant paths:** `/opt/homebrew/bin/gh`  
- **Other dependencies:** OpenClaw Gateway with Telegram integration  

---

## 3. Symptoms

- GitHub CLI commands executed successfully in native macOS Terminal (`gh --version`, `gh api user --jq .login`, `gh repo list`).  
- When OpenClaw attempted to execute GitHub CLI commands via Telegram, operations failed with approval errors.  
- Initial troubleshooting suggested unsupported `openclaw approvals` commands and incorrect JSON configurations.  

---

## 4. Root Cause

The Gateway execution policy required executable commands to be explicitly allowlisted. The `gh` binary was missing from the allowlist, causing the `exec` tool to reject GitHub CLI commands with `missing scope: operator.approvals`.  

The approval mechanism distinguishes between:
- **Authentication** (GitHub PAT login) — handled separately and successful.  
- **Executable authorization** (allowlist) — missing for `gh`, causing execution failure.  

---

## 5. What Did Not Work

1. `openclaw approvals set --security allowlist --add "gh"` — unsupported option.  
2. `openclaw approvals set --security full --ask off` — unsupported and dangerous.  
3. `openclaw approvals set --add "gh"` — unsupported option.  
4. `openclaw approvals set --file /path/to/allowlist.json` — placeholder file did not exist.  
5. JSON array `["gh"]` — rejected (approvals JSON must be an object).  
6. JSON object `{"commands":["gh"]}` — rejected (`commands` is not a valid property).  
7. Repeated `gh auth login` browser attempts — HTTP 503 errors.  
8. PAT-based GitHub CLI authentication — successful after manual execution.  
9. Terminal copy/paste issues with nonbreaking spaces — produced misleading shell errors.  

---

## 6. Final Fix

The successful command executed manually from the native macOS Terminal:

```bash
openclaw approvals allowlist add --agent main --gateway "$(command -v gh)"
```

This registered:
- **Target:** gateway  
- **Agent:** main  
- **Executable:** `/opt/homebrew/bin/gh`  
- **Scope:** any args  
- **Approval state:** stored  

Verification confirmed the executable was allowlisted:

```bash
openclaw approvals get --gateway
# Output: Already allowlisted.
```

The restrictive security defaults were preserved.

---

## 7. Commands

```bash
# Add gh to allowlist (run in native Terminal)
openclaw approvals allowlist add --agent main --gateway "$(command -v gh)"

# Verify allowlist entry
openclaw approvals get --gateway
```

---

## 8. Verification

- `gh --version` → `gh version 2.97.0 (2026-07-31)`  
- `gh api user --jq .login` → `wfspr` (authenticated as **wfspr**)  
- `gh repo list wfspr --limit 5` → Listed repositories including `debug-runbooks` (public)  

All commands executed without approval errors, confirming the fix.

---

## 9. Final Working State

- **Executable path:** `/opt/homebrew/bin/gh`  
- **Approval state:** allowlisted for agent `main` and gateway  
- **GitHub authentication:** successful as `wfspr`  
- **Telegram execution:** GitHub CLI commands now work through OpenClaw  

---

## 10. Optional Cleanup

No cleanup required; the allowlist entry is minimal and secure.

---

## 11. If This Happens Again

1. Check if the executable is allowlisted:  
   ```bash
   openclaw approvals get --gateway
   ```  
2. If missing, add it with:  
   ```bash
   openclaw approvals allowlist add --agent <agent-id> --gateway "$(command -v <executable>)"
   ```  

---

*Generated on 2026-10-22. This runbook documents a resolved incident where Telegram execution of GitHub CLI commands was blocked by missing executable allowlist entries, not authentication issues.*