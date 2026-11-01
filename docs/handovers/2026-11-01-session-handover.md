# Session handover — debug-runbooks + Hermes setup

Date: 2026-11-01 (Asia/Brunei)
Status: continuity note for the next session. Not a runbook.

## Working preferences
- Owner: wfspr. Replies: concise, line breaks, mobile-readable, visual.
- Each command in its own code block. Ask before destructive actions.
- After every fix: offer to document it in this repo (or the debug-runbooks-time skill).
- Never print or paste secrets. Credentials live in local .env files, never in chat.

## Repo state
- Repo: wfspr/debug-runbooks, branch main.
- Site: live via Cloudflare Workers Builds on push to main; runbook pages publish automatically.
- Contract: AGENTS.md (exposure audit before and after commit/push; EDIT block for any change to a published runbook), CONTRIBUTING.md, templates/runbook-template.md (numbered sections; header records the authoring tool).
- Exposure audit: scripts/audit-exposure.sh with mode tree, staged, or range A..B. Reports rule names and locations only.
- Runbooks added 2026-11-01:
  - windows/2026-11-01-hermes-multiprofile-telegram-recovery.md
  - cross-platform/2026-11-01-post-push-exposure-audit-redaction.md

## Hermes setup (Windows 11, PowerShell 7)
- Hermes v0.22.5. Profiles: default, coder, news. One gateway serves all three (multiplex profiles enabled).
- Telegram: one bot per profile; all three verified responding.
- Photon: default profile only. WhatsApp and Email: disabled in all profiles.
- Email IMAP: fails with a Basic-authentication-disabled error on the Outlook/Live provider. Unresolved.
- Known config smell: duplicate credential keys across the profile .env files; precedence not yet verified.
- A pre-update backup zip exists under the local Hermes app-data backups folder (path uses the <USER> placeholder).

## Open decisions (for the owner)
1. Whether to rewrite git history to remove a legacy personal address. Needs explicit approval and a force push; every later commit hash changes. Specifics kept out of this public note.
2. Whether to keep or replace a contact address embedded in two site source files. Specifics kept out of this public note.
3. Commit author identity going forward: this handover's commit uses a GitHub no-reply address.

## Open engineering
- scripts/audit-exposure.sh error handling: make a failed scan surface as an error rather than a clean result. Specifics kept out of this public note.
- debug-runbooks-time skill: add the exposure-audit step and the EDIT rule. Installed as anthropic-skills:debug-runbooks-time.
- Three update stashes older than 7 days not yet reviewed.

## Next step
- Ask the owner which open decision to take first.
