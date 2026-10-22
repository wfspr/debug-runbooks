# Claude Code Permissions Setup (Global)

**Date:** 2026-08-22

**Status:** Fixed

**Platform:** macOS

---

## 1. Summary

Configured global Claude Code permissions in `~/.openclaude/settings.json` to allow common development commands without prompting. Added allow rules for npm, git, all bash commands, and file operations (Read/Edit/Write/Glob/Grep).

> [!WARNING]
> This records the incident's broad allowlist, not a recommended default. `Bash` grants arbitrary shell execution, and unrestricted Read/Edit/Write permits access to sensitive files reachable by the process. A personal machine still has credentials and valuable data. Prefer project-scoped, narrowly selected permissions with approvals for mutations; confirm syntax against the installed OpenClaude version. The observed absence of prompts verifies convenience, not isolation or least privilege.

---

## 2. Environment

- **Operating system:** macOS (Apple Silicon, Darwin 25.6.0)
- **Hardware:** MacBook (Silver MBN / MacBook Neo)
- **Shell:** zsh (with Powerlevel10k)
- **Application/tool:** OpenClaude CLI
- **Relevant paths:**
  - `~/.openclaude/settings.json` — global Claude Code config
- **AI agent used:** OpenClaude (auto/best-free model)

---

## 3. Symptoms

- Every npm, git, and bash command required permission prompts
- File operations (Read/Edit/Write/Glob/Grep) required permission prompts
- This slowed down development workflows significantly

---

## 4. Root Cause

Default OpenClaude permissions require explicit approval for each tool use. No global allow rules were configured.

---

## 5. What Did Not Work

- Trying to use `--dangerously-skip-permissions` flag (not preferred for security)
- Adding permissions per-project instead of globally

---

## 6. Final Fix

### Updated `~/.openclaude/settings.json`

Added a `permissions.allow` array with the following rules:

```json
{
"permissions": {
  "allow": [
    "Bash(npm:*)",
    "Bash(git:*)",
    "Bash",
    "Read",
    "Edit",
    "Write",
    "Glob",
    "Grep"
  ]
}
}
```

### Explanation of rules

| Rule | Purpose |
|------|---------|
| `Bash(npm:*)` | Allows all npm commands without prompting |
| `Bash(git:*)` | Allows all git commands without prompting |
| `Bash` | Allows any shell command without prompting |
| `Read` | Allows file reading without prompting |
| `Edit` | Allows file editing without prompting |
| `Write` | Allows file writing without prompting |
| `Glob` | Allows file pattern matching without prompting |
| `Grep` | Allows content searching without prompting |

---

## 7. Commands

### View current permissions

```bash
jq '{permissions: .permissions}' ~/.openclaude/settings.json
```

### Test permissions work

```bash
# Should not prompt
npm --version
git status
ls -la
```

---

## 8. Verification

```bash
jq '{permissions: .permissions}' ~/.openclaude/settings.json
```

**Expected result:**
The original file contained the following settings; the filtered command above prints only `permissions`. Do not dump the full file into logs: its `env` or other fields may contain credentials.

```json
{
  "env": {},
  "model": "auto/best-free",
  "effortLevel": "high",
  "permissions": {
    "allow": [
      "Bash(npm:*)",
      "Bash(git:*)",
      "Bash",
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep"
    ]
  }
}
```

```bash
npm --version
```

**Expected result:** Returns version without permission prompt.

```bash
git status
```

**Expected result:** Returns git status without permission prompt.

---

## 9. Final Working State

| Setting | Value |
|---------|-------|
| Config file | `~/.openclaude/settings.json` |
| Permissions scope | Global (all projects) |
| Allow rules | 8 rules covering npm, git, bash, file ops |
| Model | `auto/best-free` |
| Effort level | `high` |

---

## 10. Optional Cleanup

Review and remove redundant or unused grants. The original unscoped `Bash` makes the npm/git rules redundant; retain only the permissions the current project needs. Record a backup and restore path before editing.

---

## 11. If This Happens Again

### Minimal diagnostics

```bash
cat ~/.openclaude/settings.json | jq '.permissions'
```

### Configuration-preserving recovery

1. Inspect only the permissions object with the command above. Make a private backup of the existing settings file; restrict the backup to its owner because it may contain credentials.
2. Use the installed CLI's permission editor, or edit just `permissions.allow` in the existing JSON. Prefer a project-scoped file when the CLI supports it. Preserve `env`, provider definitions, model selection, and every unrelated field.
3. Validate the JSON without printing its contents:

   ```bash
   jq empty ~/.openclaude/settings.json
   ```

4. Start a fresh CLI session and check the intended command's approval behavior. Restore the backup if the CLI fails to load it. Do not restore the historical global allowlist automatically.

The former whole-file heredoc replacement was removed because it truncated existing settings and could erase credentials and unrelated configuration. The historical rule set remains above for reference.

### Security note

Use the minimum permissions needed on personal, shared, and production machines. These controls govern what an agent can execute; they do not make untrusted repository instructions safe to follow.
