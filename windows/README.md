# Windows runbooks

The [root README](../README.md#windows) contains the complete dated Windows index.

## OmniRoute update recovery

| Date | Runbook | Status |
| --- | --- | --- |
| 2026-10-21 | [Codex desktop and Ollama restoration recovered native OpenAI models](2026-10-21-codex-desktop-ollama-restore-openai-catalog.md) | Fixed / Verified; follow-up items remain |
| 2026-10-21 | [OmniRoute npm `EBUSY` upgrade failure under PM2](2026-10-21-omniroute-npm-ebusy-pm2-update-recovery.md) | Fixed / Verified; follow-up items remain |

The Codex/Ollama runbook documents an unsupported legacy profile during desktop migration, model-catalog troubleshooting that did not resolve the Ollama-only selector, successful `ollama launch codex-app --restore` recovery after closing both desktop apps, and a separate missing-description warning for a subagent. Service health, request routing, MCP, and custom subagent execution remain unverified.

The 2026-10-21 runbook covers the OmniRoute 3.8.49 to 3.8.52 global npm upgrade that failed on Windows 11 with `EBUSY` / `errno -4082` because npm could not rename the install directory while OmniRoute was still running as a PM2-managed process. It records the failed elevation retry, the reason a Windows file lock survives elevation, the stop-install-restart-save recovery, the read-only npm configuration, package origin, install-script, secret-exposure and least-privilege audit, and the open follow-up items: unreproduced peer-dependency warnings, unidentified blocked install scripts, a malformed `allow-scripts` allowlist, untested provider request functionality, plaintext credentials and `0.0.0.0` dashboard bindings.

## PM2 dual-router setup

| Date | Runbook | Status |
| --- | --- | --- |
| 2026-08-23 | [PM2 Windows Dual-Router Setup (OmniRoute + 9Router Port Mapping & Daemonization)](2026-08-23-pm2-windows-dual-router-setup.md) | Fixed |
| 2026-08-23 | [Windows Multi-CLI Free-Tier Model Setup (OmniRoute + OpenClaw + Hermes)](2026-08-23-windows-multi-cli-free-model-setup.md) | Fixed |
| 2026-08-23 | [Windows Multi-Provider Kimi/DeepSeek Setup (PWA + OpenCode + Pi + OpenClaude + Kimi Code)](2026-08-23-windows-multi-provider-kimi-deepseek-setup.md) | Fixed |

The 2026-08-23 PM2 runbook configures OmniRoute on port 20128 and 9Router on port 20138 as detached PM2 services on Windows, including the ecosystem file, the `--env-file` credential injection, console suppression and boot-time registration. The 2026-10-21 runbook above builds on that topology: it is the same OmniRoute install, supervised by the same PM2 daemon, that produced the `EBUSY` lock during the npm upgrade.
