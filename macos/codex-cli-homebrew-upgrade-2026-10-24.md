# Codex CLI Homebrew Cask Upgrade — 0.160.0 to 0.164.0

**Date:** 2026-10-24

**Status:** Fixed / Verified

**Platform:** macOS

---

## 1. Summary

Routine maintenance upgraded the Homebrew-installed Codex CLI from 0.160.0 to 0.164.0. Homebrew completed the cask upgrade successfully, and both the installed cask version and the CLI version reported 0.164.0 afterward. No failure was observed.

---

## 2. Environment

- **Operating system:** macOS 27.0.1 (build 26A434)
- **Hardware:** Apple Silicon (`arm64`)
- **Shell:** zsh 5.9
- **Package manager:** Homebrew 7.0.10
- **Application/tool:** Codex CLI, installed as the Homebrew `codex` cask
- **Version before upgrade:** 0.160.0
- **Version after upgrade:** 0.164.0
- **Executable path:** `/opt/homebrew/bin/codex`

---

## 3. Symptoms

There was no error or unexpected behavior. The installed Codex CLI was at 0.160.0 before the requested upgrade.

---

## 4. Root Cause

Not applicable. This was a routine version upgrade, not an incident.

---

## 5. What Did Not Work

No troubleshooting attempts were needed.

---

## 6. Final Fix

Upgraded the existing Homebrew cask with `brew upgrade --cask codex`. Homebrew replaced the 0.160.0 installation with 0.164.0 and completed successfully.

---

## 7. Commands

Run these commands in zsh to record the installed version, upgrade the cask, and verify the result:

```bash
brew list --cask --versions codex
codex --version
brew upgrade --cask codex
brew list --cask --versions codex
codex --version
```

---

## 8. Verification

Before the upgrade:

```text
brew list --cask --versions codex
codex 0.160.0

codex --version
codex-cli 0.160.0
```

Homebrew reported `0.160.0 -> 0.164.0` and `codex was successfully upgraded!`.

After the upgrade:

```text
brew list --cask --versions codex
codex 0.164.0

codex --version
codex-cli 0.164.0
```

---

## 9. Final Working State

- Homebrew cask `codex`: 0.164.0
- CLI: `codex-cli 0.164.0`
- Executable: `/opt/homebrew/bin/codex`

---

## 10. Optional Cleanup

Homebrew removed the cached 0.160.0 archive during its normal cleanup. No additional cleanup was needed.

---

## 11. If This Happens Again

Check the current cask and CLI versions, upgrade through Homebrew, then verify both again:

```bash
brew list --cask --versions codex
codex --version
brew upgrade --cask codex
brew list --cask --versions codex
codex --version
```

---

## Assistance

- **AI:** GPT-6 Luna (Codex) — recorded the completed upgrade and verified output
- **CLI:** Homebrew, Codex CLI, and GitHub CLI
- **Human operator:** initiated the upgrade request
