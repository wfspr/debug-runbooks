# [Problem / Fix Title]

**Date:** YYYY-MM-DD  

**Status:** Fixed / Partial / Investigating  

**Platform:** macOS / Windows / Linux / Cross-platform

---

## 1. Summary

What was being attempted, what failed, and the final outcome.

---

## 2. Environment

Relevant environment details:

- Operating system:
- Hardware:
- Shell:
- Runtime:
- Application/tool:
- Version:
- Relevant paths:
- Relevant ports:
- Other dependencies:

---

## 3. Symptoms

Describe what originally went wrong.

Include exact error messages where useful.

```text
Example error
```

---

## 4. Root Cause

Explain the underlying technical cause.

Separate multiple root causes if necessary.

---

## 5. What Did Not Work

Document troubleshooting approaches that:

- failed
- addressed only symptoms
- introduced new problems
- were based on incorrect assumptions
- should not be repeated

---

## 6. Final Fix

Describe the working solution.

Explain why this fixes the underlying problem rather than only suppressing the symptom.

---

## 7. Commands

Consolidate the useful commands into the shortest clean sequence.

State the shell, working directory, prerequisites, and exact targets. Back up configuration before edits; explain rollback and any interruption. Mark historical failed or unsafe commands so readers do not mistake them for recovery steps. Use placeholders for secrets and private identifiers; do not dump environment or credential files.

```bash
# commands
```

---

## 8. Verification

Document how the fix was proven.

Separate recorded results from proposed or unrun checks. Include functional behavior, authentication, and persistence checks where relevant; a listening port alone is insufficient.

```bash
# verification commands
```

Expected result:

```text
expected output
```

---

## 9. Final Working State

Record the known-good state after the fix.

Examples:

- active executable path
- service status
- ports
- versions
- authentication state
- configuration files
- repository state

---

## 10. Optional Cleanup

Anything that can be removed or cleaned up later without affecting the working solution.

List exact cleanup targets, why they are safe to remove, and how to recover them. Do not clear diagnostic logs or delete backups before verification is complete.

---

## 11. If This Happens Again

Provide the shortest diagnostic sequence first.

```bash
# minimal diagnostics
```

Then provide the shortest recovery procedure.

