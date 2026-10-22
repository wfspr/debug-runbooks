# Documentation and command-safety review

Review date: 2026-10-21. Baseline: `0056f1a` on `wfspr/debug-runbooks`.

During the review, `main` advanced to `5a3902a`, adding the Codex/Ollama restoration runbook. That commit was merged into this branch and retained in full; final validation includes the resulting 49-runbook collection. The file summary below describes this PR's 28 changed files relative to the updated base.

## Scope and evidence

The review covered repository structure, contributor/agent guidance, all 49 runbooks' discovery/index metadata and high-risk command patterns, platform indexes, the template, example configuration artifacts, and the website's content/privacy pipeline. Detailed procedure corrections focused on permissions, PM2, Hermes/Git cache diagnostics, Vercel eligibility probes, Composio installation, launcher upgrades, and launchd process ownership.

This was a source/documentation review in a Linux cloud environment with Node.js 24.19.0. It did not rerun incidents on the original macOS or Windows machines, exercise paid/provider APIs, rotate remote credentials, or deploy the website. Historical observations, dates, filenames, and routes remain intact. Unsupported conclusions are qualified rather than promoted to new verification results.

## Findings and changes

| Finding | Improvement |
| --- | --- |
| Global `Bash` and file-operation grants were described as appropriate merely because a machine was personal. Recovery overwrote the complete settings file. | Retained the historical grants with a risk warning; replaced the destructive recovery with a targeted, backed-up edit and JSON validation; filtered config inspection avoids dumping unrelated secrets. |
| PM2 recovery deleted all apps and suggested flushing all logs. An unquoted string could split a dotenv path containing spaces. Startup registration was conflated with unattended boot. | Scoped commands to `9router,omniroute`, guarded existing ecosystem files, used an argument array, preserved logs, and separated registration, login persistence, authentication, and actual socket binding checks. |
| The Hermes runbook reversed GitHub compare direction and implied a fetch moved local HEAD. It concatenated multiple cache JSON files and broadly killed Hermes processes. | Corrected BASE/HEAD and local divergence semantics, marked the recorded equal-SHA sequence as unreconciled, selected one cache file/field set, and limited restart guidance to the affected CLI. |
| Vercel `429`, `400`, and `404` responses were treated as proof of free or paid eligibility. A Python path did not expand `~`; a Keychain verification printed the key. | Preserved historical model counts as provisional, documented inconclusive results and billing context, used `Path.home()`, and checked key presence without showing values. |
| The initial localhost audit lacked a status and overstated the absence of credential risk. | Added a partial status, linked later findings, and separated session observations from credential-rotation and reboot claims. |
| Legacy launchd recipes killed any matching proxy process, even after topology changed. | Removed broad kills from the October recovery and marked August respawn commands as historical for the older topology. |
| Install/upgrade recipes deleted existing directories or piped a changing remote installer directly into Bash. | Guarded existing virtual environments, used a fresh launcher extraction directory, and retained the original remote-install command as history with download/review/verification prerequisites. |
| No contributor guide or automated PR validation existed; the template contained literal `</> Bash` labels. Three runbooks were missing from the master index; Linux's index was empty. | Added contribution guidance, CI, raw-source checks, an index-coverage regression test, a cleaned template, missing index entries, and an explicit empty-category note. |
| Website source/commit links and the deployment guide referenced the older repository owner. | Centralized links now target `wfspr/debug-runbooks`; historical incident remote strings remain unchanged as evidence. |

The existing website detector scans published runbooks and output, but publication exclusions and render-time redactions do not protect public GitHub source files. The new raw-source guard runs independently of website publication policy over root Markdown, platform documentation, `docs/`, `templates/`, and text configuration artifacts. It reports only file locations and rule names. Its known-format patterns are not a comprehensive secret detector; generic passwords, arbitrary tokens, personal details, binary artifacts, and dependency source are outside that guarantee.

## Validation

- Baseline: 102 tests passed before edits.
- Updated suite: 109 tests passed, including raw-source scope, secret-safe diagnostics, fence balance, symlink rejection, all-runbook indexing, and repository-link coverage.
- `npm run check:docs`: no known-format credential matches or unclosed fences in 64 scoped current source files.
- `npm run check:content`: all 49 runbooks remain published and are now indexed; status wording is recognized.
- `npm run check`: no type errors, warnings, or hints.
- `npm run build`: 54 pages built with `SITE_URL` unset; the output scan passed across 58 text assets.
- A second build with the production `SITE_URL` also passed: 54 pages and 60 scanned text assets, including sitemap output.
- Isolated snippet checks: 25 Bash blocks passed `bash -n`; permission JSON examples parsed; the PM2 ecosystem JavaScript parsed and preserved a Windows dotenv path with spaces as one argument; Node loaded a synthetic dotenv file with spaces in its filename; an isolated Git fixture confirmed upstream-only versus local-only divergence counts.
- `git diff --check`: passed.
- Local file-link check: 117 relative Markdown/HTML file links resolve; fragments and remote URLs were not checked.
- A known-format credential scan of available historical documentation diffs found no matches. This does not establish the absence of arbitrary credentials, binary evidence, or history no longer present locally.

These syntax/fixture checks do not validate the original services, PM2's Windows startup integration, current provider eligibility, or the contents of a changing remote installer. The CI workflow uses the Node 22 line declared in `.nvmrc`; GitHub-hosted execution occurs after the PR is opened.

## File-by-file summary

| File | Change |
| --- | --- |
| `.github/workflows/validate.yml` | Adds read-only PR/main validation with full history, frozen npm installation, source/content checks, tests, type checks, build, and whitespace checks. |
| `AGENTS.md` | Links contributor safety guidance and includes the raw-source validation command. |
| `CONTRIBUTING.md` | Documents evidence standards, safe command scope, backups/rollback, credential handling, validation, and branch/PR conventions. |
| `README.md` | Links contribution/review guidance, restores three missing runbook entries, and aligns corrected summaries/statuses. |
| `cross-platform/README.md` | Describes the safer launcher extraction and Bash command-cache correction. |
| `cross-platform/universal-ai-cli-gateway-launcher-2026-09-04.md` | Replaces deletion/reused extraction with a fresh directory and a fail-fast subshell; uses `hash -r`. |
| `docs/deployment.md` | Corrects the repository owner and documents raw-source versus rendered-output privacy checks. |
| `docs/documentation-review.md` | Records findings, validation scope, limitations, and every changed file. |
| `linux/README.md` | Explains the intentionally empty Linux category and links contribution guidance. |
| `macos/9router-v0.5.95-launchagent-policy-guard-port-hijack-2026-10-03.md` | Removes broad proxy kills, requires exact-owner inspection and a free port, and flags potentially sensitive plist output. |
| `macos/README.md` | Adds missing/corrected entries and links later topology, credential, installer, and accuracy notes. |
| `macos/claude-code-permissions-setup-2026-08-22.md` | Warns about broad historical permissions, provides valid JSON, filters inspection, and replaces whole-file recovery with a targeted edit. |
| `macos/hermes-composio-github-session-2026-08-07.md` | Preserves existing virtual environments and separates historical remote execution from reviewed installer reuse. |
| `macos/hermes-update-stale-warning-2026-09-29.md` | Corrects Git counts/ref semantics, qualifies inconsistent evidence, narrows cache diagnostics, and removes broad CLI/gateway kills. |
| `macos/localhost-hardening-20260906.md` | Adds a partial status and later references; corrects credential certainty and narrows process inspection. |
| `macos/omniroute-asymmetric-combo-timeouts-2026-08-29.md` | Identifies the retained handover-style text and points to the subsequent matcher-hardening procedure. |
| `macos/opencode-vercel-ai-gateway-setup-2026-08-22.md` | Makes model labels provisional, corrects HTTP/billing inference and Python home expansion, and avoids Keychain-value output. |
| `macos/stage-f0d-launchd-gateway-optimization-2026-08-28.md` | Flags historical broad process kills and the later service-ownership change. |
| `site/package.json` | Adds `check:docs`; dependencies and lockfile are unchanged. |
| `site/scripts/check-docs.ts` | Adds the raw-source validation entry point and a failing exit status for findings. |
| `site/src/lib/documentation.ts` | Implements scoped source discovery and credential/fence diagnostics independently of publication exclusions; refuses symlinked documentation. |
| `site/src/lib/paths.ts` | Points generated GitHub source/commit links at `wfspr/debug-runbooks`. |
| `site/tests/documentation.test.ts` | Tests synthetic credentials, value-free diagnostics, nested/unclosed fences, scope exclusions, repository sources, and symlink rejection. |
| `site/tests/prepare.test.ts` | Updates the relative-link regression assertion to the current repository. |
| `site/tests/repository.test.ts` | Requires every published runbook to appear in the master README. |
| `templates/runbook-template.md` | Uses language-labelled fences and adds prerequisites, mutation scope, rollback, and evidence-limit prompts. |
| `windows/2026-08-23-pm2-windows-dual-router-setup.md` | Narrows PM2 operations, preserves configuration/logs, handles spaced dotenv paths, and clarifies binding, credentials, and startup verification. |
| `windows/README.md` | Aligns the PM2 summary with the updated safety and persistence guidance. |

## Outstanding work

1. Reconcile the Hermes incident's local/remote SHAs against retained operator evidence. The original numerical banner cause and transition to equal SHAs cannot be proved from the record alone.
2. Revalidate Vercel labels with the current account, billing limits, catalog, and successful completions; do not regenerate the historical counts without evidence.
3. Verify supported loopback configuration and user-login persistence on the Windows host. Historical wildcard bindings remain an explicitly open risk; this review did not change remote services.
4. Validate legacy shell/service commands on their documented OS/tool versions. Installer/SDK version pins and an authoritative Composio installer digest were not retained in the original incident.
5. Keep the timeout handover's intentional heading examples in code blocks. The content pipeline still warns about those two lines; fences are balanced, and the retained wording is now explicitly explained.
6. Usernames, local paths, installation identifiers, and historical contact/configuration details still exist in public raw sources. Review them case by case before importing further evidence. Website redaction alone does not remove repository/history exposure; rotate any credential discovered later before coordinating removal.
