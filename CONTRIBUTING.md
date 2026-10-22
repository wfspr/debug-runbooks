# Contributing

Start with [AGENTS.md](AGENTS.md) and the [runbook template](templates/runbook-template.md). The Markdown in the platform folders is the source of truth for both GitHub and the website.

## Write an incident record

Record the operating system, shell, tool versions, prerequisites, observed errors, failed approaches, fix, and verification evidence. Preserve the incident date when correcting an older runbook. Label later editorial corrections separately, and distinguish recorded results from commands or recommendations that have not been tested on the original host.

Use `Partial` or a status with explicit follow-up work when functional, credential, or reboot checks remain incomplete. An open port or a successful `/models` response does not establish that an authenticated completion, message, or restart works. Do not invent missing results to fill a template section.

Name new files by platform, topic, and date. Add the runbook to both the root README and its platform README; keep dates and status wording consistent. Linux currently has no incident runbooks: add one only with supporting evidence. Use fenced blocks with a language such as `bash`, `zsh`, `powershell`, `json`, or `text`.

## Review commands and sensitive information

- State the working directory and shell. Replace machine-specific usernames, installation IDs, account IDs, and private endpoints with clearly identified placeholders unless they are essential to the diagnosis.
- Start with read-only diagnostics. Identify the exact process, service, file, or database before a mutation; preserve a recoverable backup and explain how to restore it. Scope process-manager commands to the affected app instead of all services.
- Treat JSON, TOML, YAML, and dotenv as data. A shell expands `~` in some command arguments, but Python `open('~/…')` and literal config paths do not expand it automatically. Preserve unrelated settings instead of overwriting entire files.
- Keep API keys, passwords, cookies, private keys, and authenticated URLs out of examples, logs, screenshots, and commits. Retrieve credentials through the application's supported secret source; inspect presence without printing values. Avoid shell tracing, environment dumps, and verbose authenticated HTTP requests.
- Bind workstation services to loopback when supported, then verify the actual listener address and authentication. Review service-manager snapshots and backups as potentially credential-bearing files.
- Preserve TLS, package-signature, and checksum verification. For remote installers, inspect a downloaded script and verify an authoritative release signature/checksum when available before execution. HTTPS alone does not establish the trustworthiness of installer code.

The website's redaction policy affects rendered pages only. Files excluded or marked `private` there are still public when committed to this GitHub repository. If a real credential was published, revoke or rotate it first, remove it from current content, and coordinate any history/artifact cleanup; deleting a line alone does not invalidate the credential.

## Validate locally

Use Node.js 22.18 or newer (the site pins the Node 22 line) and npm:

```bash
cd site
npm ci
npm run check:docs
npm run check:content
npm test
npm run check
npm run build
cd ..
git diff --check
git status --short
```

`check:docs` scans repository Markdown and text configuration examples in `artifacts/` for known credential formats and unclosed fences, including content excluded from website publication. It reports locations and rule names, never matched values. This pattern scan does not detect every secret or validate command behavior. Review local links and platform-specific commands manually. Tests also enforce that every runbook is indexed.

`check:content` reports derived metadata and warnings; `npm test` exercises the content pipeline and presentation; `check` runs Astro's type checks; `build` includes the output privacy scan. Review warnings instead of assuming a successful exit means every procedure is verified. Consult [deployment.md](docs/deployment.md) for optional preview/deployment checks; a local build does not deploy the site.

## Submit a pull request

Create a dedicated branch and use concise `docs:` commit messages for documentation changes. Include the problem, a per-file change summary, evidence for technical corrections, validation results, and remaining limitations. Preserve historical observations and explain removed or replaced instructions. Push the branch and open a PR against `main`; leave merging to the reviewer.
