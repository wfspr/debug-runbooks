# Post-push exposure audit and redaction with an EDIT record

**Date:** 2026-11-01  

**Status:** Fixed / Verified; follow-up items remain  

**Platform:** Cross-platform  

**Authored with:** Claude Code, Claude Haiku 5.5 (the session switched to Claude Opus 5.5 for part of the work and back to Claude Haiku 5.5)

---

## 1. Summary

After the Hermes runbook was pushed, an exposure audit of the tracked tree and recent commits found no API keys, bot tokens, passwords, or private keys. It did find a personal Gmail address published in a Resend runbook. The address was replaced with a placeholder, and an `*EDIT*` block records the change. The address still exists in older commits, which were not rewritten. An Outlook address on the public About page was left in place because it is a deliberate contact link.

---

## 2. Environment

- Repository: `wfspr/debug-runbooks`, branch `main`, deployed by Cloudflare Workers Builds
- Working copy: shallow clone in a Linux workspace, cloned with `GIT_LFS_SKIP_SMUDGE=1`
- Shell: bash
- Tools: `git grep`, `git log -p`, `python3` for edits, `gh api` for check runs
- Audit script: `scripts/audit-exposure.sh` (added in this change set)
- Git version: not recorded

---

## 3. Symptoms

The audit matched a personal email address in three places of one runbook: the Recipient line, a JSON example, and a sentence confirming delivery.

Errors seen while building the audit and the edits:

```text
grep: unrecognized option '-----BEGIN [A-Z ]*PRIVATE KEY'
scripts/audit-exposure.sh: line 45: [: : integer expression expected
```

```text
/bin/bash: eval: line 84: unexpected EOF while looking for matching `"'
```

```text
AssertionError
```

```text
macos/hermes-resend-plugin-integration-2026-09-30.md:7: trailing whitespace.
```

A later run printed `CLEAN  no rule matched (range)` even though a grep error had occurred earlier in the same run. Treat that output as untrustworthy until the script is fixed (see section 10).

---

## 4. Root Cause

- **No redaction step before publication.** Runbooks were written from real sessions, and contact details were copied in verbatim, including recipient addresses in examples.
- **Grep option parsing.** Patterns beginning with `-` were read by `grep` as options. The private-key rule failed on each run, and the script treated the failed count as zero.
- **Fail-open counting.** The script used `grep -c ... || true`, so a grep error became a count of zero and the rule was silently skipped.
- **Loose secret rule.** The first assigned-secret rule matched ordinary prose such as "token sync" and "skill.code_safety".
- **Trailing spaces for line breaks.** Markdown line breaks written as two trailing spaces trip `git diff --check`.

---

## 5. What Did Not Work

- **Loose assigned-secret pattern.** It matched prose. Requiring `=` or `:` directly before the value removed the false positives.
- **Pattern starting with `-`.** Passing it to `grep -E` without `-e` produced an error, not a match. Use `grep -E -e "<pattern>"`.
- **One shell command for several edits.** A stray quote made bash refuse the whole command, but the Python edits had already run. The rerun then failed its own assertion because the file was already edited. Check the file state before any rerun, and split edits from the commit.
- **Piping the audit into `head` or `tail`.** The exit code shown was that of the pipe, so `exit=0` appeared while the script printed `FOUND`. Capture the output first, then check the status, or use `${PIPESTATUS[0]}`.
- **Two trailing spaces in an EDIT block.** `git diff --check` failed. Put each field on its own paragraph separated by a blank line.
- **Foreground `sleep`.** The shell blocked it. A scheduled re-check in the session worked instead.
- **`gh repo clone`.** The session returned HTTP 403 for GraphQL. `git clone` with `GIT_LFS_SKIP_SMUDGE=1` worked.

---

## 6. Final Fix

1. Replace the personal address in the current content with `<RECIPIENT_EMAIL>`, and add an `*EDIT*` block directly under the header of the affected runbook.
2. Add two rules to `AGENTS.md`: audit before and after each commit and push, and record every change to a published runbook in an `*EDIT*` block.
3. Add `scripts/audit-exposure.sh`, which prints rule names, counts, and file locations, never matched values.
4. Commit, push, and confirm that the remote head matches the local head.

Rewriting history was not done. It changes every later commit hash and requires the owner's explicit approval.

---

## 7. Commands

Shell: bash, from the repository root.

Locate personal email addresses without printing the full local part:

```bash
git grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" -- . | sed -E 's/^([^:]+:[0-9]+):([A-Za-z0-9._%+-]{1,2})[A-Za-z0-9._%+-]*@/\1:\2****@/'
```

Run the tree audit and capture its status without a pipe:

```bash
scripts/audit-exposure.sh tree > audit.txt; echo "exit=$?"
```

Check whitespace before committing:

```bash
git diff --check
```

Commit with the attribution lines the session requires, then fetch, rebase, and push:

```bash
git fetch origin main && git rebase origin/main && git push origin main
```

Confirm the remote head:

```bash
git ls-remote origin main
```

Check the Cloudflare build for the commit:

```bash
gh api repos/wfspr/debug-runbooks/commits/<SHA>/check-runs --jq '.check_runs[] | "\(.name) | \(.status) | \(.conclusion)"'
```

---

## 8. Verification

Recorded results:

- After the edit, the grep for the Gmail address returned `0` matches in the current tree.
- The EDIT block appears exactly once in the affected runbook, and `AGENTS.md` contains the editing rule once.
- `git diff --check` passed after the EDIT block was reformatted.
- `git ls-remote origin main` returned the same head as the local branch after the push.
- Cloudflare build checks for the earlier commits in this sequence completed with `success`.

Remaining audit hits, reviewed and accepted:

- `onboarding@resend.dev`: Resend's public test sender, not a personal address.
- `const token = process.env.OPENCLAW_GATEWAY_TOKEN;`: a variable name, not a value.
- The Outlook address on the About page and in the deployment check script: a deliberate public contact link.

Expected result of the tree audit after the fix:

```text
MATCH  email-address  lines=<N>
         file: site/scripts/verify-deployment.ts
         file: site/src/pages/about.astro
FOUND  2 rule(s) matched. Values are not printed; inspect the locations.
```

The `N` count reflects the reviewed Outlook and public test-sender hits and may change as the repository changes.

---

## 9. Final Working State

- Current content: no personal Gmail address; the Resend runbook carries `<RECIPIENT_EMAIL>` and its EDIT record.
- Git history: the Gmail address still appears in earlier commits. It has not been removed.
- About page: the Outlook contact link is kept intentionally.
- `AGENTS.md`: contains the audit checklist and the EDIT rule.
- `scripts/audit-exposure.sh`: available for tree, staged, and range audits.

---

## 10. Optional Cleanup

- Remove the scratch file `audit.txt` after reviewing it. It contains rule names and file paths only.
- Commit author addresses are public. Consider a GitHub no-reply address for future commits. Changing it does not alter past commits.
- Open follow-up: make `scripts/audit-exposure.sh` fail closed. Check each `grep` exit status, and treat exit status 2 as an error rather than a zero count.
- Open decision: rewrite history to remove the Gmail address from earlier commits. This requires explicit owner approval and a force push.

---

## 11. If This Happens Again

Shortest diagnostic sequence:

```bash
scripts/audit-exposure.sh tree > audit.txt; echo "exit=$?"
```

```bash
git grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" -- .
```

Shortest recovery sequence:

1. Replace each personal value with a placeholder such as `<RECIPIENT_EMAIL>`.
2. Add an `*EDIT*` block under the header with the date, what changed, and who changed it.
3. Run `git diff --check`, then commit and push.
4. Confirm the remote head with `git ls-remote origin main`.
5. Decide separately whether history must be rewritten. That needs the owner's approval.
