# Repository Guidelines

## Project Structure & Module Organization

This repository contains verified debugging runbooks plus a static website (`site/`) that publishes them.

- `macos/`, `windows/`, `linux/`, and `cross-platform/` contain platform-specific runbooks.
- Each platform directory has a `README.md` index; `README.md` is the master index.
- `templates/runbook-template.md` defines the required runbook structure.
- Keep supporting snippets inside the relevant runbook; there is no separate assets directory.

## Build, Test, and Development Commands

The runbooks themselves have no build step. Useful checks are:

```bash
git diff --check   # Detect whitespace errors
git status --short # Review modified and untracked files
```

Preview Markdown in your editor or on GitHub before submitting.

## Coding Style & Naming Conventions

- Follow the numbered sections in `templates/runbook-template.md`; preserve them for new runbooks.
- Use Markdown headings, tables, and fenced code blocks. Label code blocks with `bash`, `text`, or the appropriate language.
- Name files by platform, topic, and date, for example `macos/kimi-recovery-2026-08-25.md` or `windows/2026-08-23-pm2-setup.md`.
- Keep titles concise and outcome-oriented. Use sentence case for headings.
- Keep commands copyable, but include only those needed for diagnosis, repair, or verification.
- Follow [CONTRIBUTING.md](CONTRIBUTING.md) for safe command scope, credential handling, evidence limits, and the complete validation sequence.

## Testing Guidelines

Every runbook must describe work that was actually performed and verified. Include:

- The relevant environment, versions, paths, and ports.
- What failed and why.
- Approaches that did not work.
- The final fix and the exact verification commands or results.

Record expected output where it clarifies success. Do not invent results or add speculative fixes.

## Commit & Pull Request Guidelines

History uses concise `docs:` commit messages, such as `docs: add macOS recovery runbook`. Continue this format.

Pull requests should:

- Describe the failure, fix, and verification evidence.
- Link related runbooks or issues.
- Include before/after behavior where useful.
- Update the platform `README.md` and root `README.md` when adding or changing an indexed runbook.

## Security & Configuration Tips

Do not commit credentials, API tokens, private URLs, or unredacted authentication material. Prefer placeholders such as `<API_KEY>` and explain where secrets should be stored. Include machine-specific paths only when they are necessary to reproduce or recover the issue.

## Website (`site/`)

The Astro site reads runbooks directly from the platform folders; runbook Markdown remains the source of truth and must stay readable on GitHub. Do not add frontmatter or edit runbooks for the website's sake.

```bash
cd site
npm ci
npm run check:docs     # raw Markdown/artifact secrets and unclosed fences, even if unpublished
npm run check:content  # derived metadata per runbook, with sources and warnings
npm test               # vitest: pipeline, privacy, activity, brand/contrast guards
npm run check          # astro check (types)
npm run build          # activity data + static build + output secret/path scan
```

- Publishing rules (exclusions, redactions, per-runbook overrides with a reason) live in `site/content-policy.yaml`.
- Colours come only from `site/src/styles/tokens.css`; see `docs/brand/brand-guidelines.md`.
- Deployment (Cloudflare Workers static assets) is documented in `docs/deployment.md`.
- New runbook status wording must be recognised by `site/src/lib/status.ts`; `npm test` fails otherwise.

## Post-commit and post-push exposure audit

Run this every time a commit is made or pushed, and report the result to the user. Do not treat a clean script run as proof on its own: review every hit.

Before commit:

```bash
git diff --check
scripts/audit-exposure.sh staged
git diff --cached --stat
```

Check the staged diff by hand for API keys, bot tokens, passwords, OAuth or session tokens, private keys, cookies, email addresses, phone numbers, chat or account IDs, and full home-directory usernames. Replace each value with a placeholder such as `<TELEGRAM_BOT_TOKEN>`, `<USER>`, or `<EMAIL>`.

After commit, before push:

```bash
scripts/audit-exposure.sh range origin/main..HEAD
git log -1 --format='author: %ae%ncommitter: %ce'
```

Check that the author and committer addresses are intended. Each commit's author email is public on GitHub, and changing it later rewrites history.

After push:

```bash
git fetch origin main
git rev-parse HEAD origin/main
scripts/audit-exposure.sh tree
```

The local and remote heads must match. The tree scan must report no new hits compared with the previous run.

Interpreting results:

- The script prints rule names, counts, and file paths. It never prints matched values. Open each location and judge it.
- Prose can match loose rules (for example "token sync"). Record such hits as reviewed, not as clean.
- `email-address` hits on published content are not automatically errors, but they are exposure. Report them and let the owner decide whether to redact.
- A real credential found in any commit is a stop condition: do not push further, tell the user, and do not delete the line alone. Rotate or revoke the credential first. Rewriting history needs the owner's approval.

Report to the user in one short block: commit hash, scan results per rule, and anything found and left unchanged.

## Editing a published runbook

Any change to a runbook that already exists in the repo must leave a visible record. Add an `*EDIT*` block directly under the header block (after the Platform line), using this form:

```text
*EDIT*
Date: - YYYY-MM-DD
Edited what: - What changed, and why (for example, "redacted an email address after an exposure audit")
Edited by: - Who made the change (name, or the AI model and the fact it was at the owner's request)
```

Keep earlier EDIT blocks. Do not silently change a published runbook, including redactions. Rewriting git history to remove a value needs the owner's explicit approval; even then, keep the EDIT block so readers can see that the content was changed after an audit.
