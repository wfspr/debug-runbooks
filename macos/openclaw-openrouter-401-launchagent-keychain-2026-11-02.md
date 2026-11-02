# OpenClaw "Couldn't sign in to the AI service" (OpenRouter 401) under a LaunchAgent

**Date:** 2026-11-02
**Status:** Fixed / Verified (TUI and Telegram); plaintext-credential cleanup partial
**Platform:** macOS
**Authored with:** Claude Sonnet 5.5 (Medium), reviewed by owner

---

## 1. Summary

OpenClaw chat in the TUI and Telegram failed with `Couldn't sign in to the AI service. Sign in again under Models in the Control UI or run openclaw configure.` after the OpenRouter key was replaced. Several independent causes stacked: the gateway (a LaunchAgent) does not read `~/.zshrc`, so it kept an old key; the CLI and the gateway looked at different key stores; the OpenRouter balance was negative; a Telegram session held a stale per-chat model; and the main agent's `model` object had no `fallbacks` key. After fixing all five, both TUI and Telegram replied through `openrouter/free`. The OpenRouter key was then migrated to a SecretRef.

> **Quick fix:** Put the key in the Keychain, make sure the OpenRouter balance is positive, `launchctl unsetenv OPENROUTER_API_KEY`, restart the gateway with `launchctl kickstart -k`, then send `/new` and `/model openrouter/free` in the affected Telegram chat.

---

## 2. Environment

- Operating system: macOS on Apple Silicon
- Shell: zsh
- Application/tool: OpenClaw `2026.10.5`
- Gateway: macOS LaunchAgent `gui/<UID>/ai.openclaw.gateway`, started at login (no open Terminal tab)
- Control UI: `http://127.0.0.1:18789/`
- Channels: TUI and a Telegram bot
- Provider: OpenRouter, free router `openrouter/free`
- Relevant paths: `~/.openclaw/openclaw.json`, `~/.zshrc`, macOS Keychain item `openrouter-api-key`
- Other dependencies: macOS `security` and `launchctl`

---

## 3. Symptoms

```text
run error: Couldn't sign in to the AI service. Sign in again under Models in the Control UI or run `openclaw configure`.
```

- `models status` showed the saved profile as the expired key even after the key was renewed ("still used my expired key as per `env:`").
- Gateway logs showed the `openrouter` provider returning `status=401`.
- A direct `curl` to the OpenRouter models endpoint with the new key returned 200, so the key itself was valid.
- After the first fix the TUI replied but Telegram still returned the same error.

---

## 4. Root Cause

1. **LaunchAgent environment isolation.** The gateway runs under launchd and never reads `~/.zshrc`. The `export OPENROUTER_API_KEY="$(security find-generic-password ...)"` line only affects interactive shells. The gateway kept whatever key was in launchd's environment or its own config.
2. **CLI vs gateway state mismatch.** `openclaw` CLI commands and the running gateway resolved the key from different places, so the CLI showed a valid key while the gateway sent the old one (401).
3. **Negative OpenRouter balance.** The account was about US$0.68 below zero, which blocks requests even with a valid key. The balance was topped up to about US$19.9.
4. **Stale Telegram session model.** The chat kept a per-session model override that survived the key change. `/new` and `/model openrouter/free` reset it.
5. **Agent model object clobbered the fallbacks.** `agents.entries.main.model` was an object with only `primary` and no `fallbacks` key, so at runtime it replaced `agents.defaults.model.fallbacks` and left the agent with none (reported by `openclaw doctor`).

`openrouter/free` is a router: the underlying model changes per request (Telegram showed Nemotron by NVIDIA), so the reply model name is not stable.

---

## 5. What Did Not Work

- Re-running the sign-in/OAuth flow and `openclaw configure` alone: the gateway still used the old key.
- Editing the `~/.zshrc` line: it only changes new interactive shells, not the LaunchAgent.
- `launchctl setenv OPENROUTER_API_KEY ""`: this sets an **empty** value rather than removing the variable and made the failure worse. Use `unsetenv` instead. **Do not repeat.**
- `openclaw config set agents.entries.main.model.primary openrouter/free` returned `No change`; it did not address the missing fallbacks.
- Chasing HTTP status codes in the TUI: the TUI does not display them. Use the Control UI or gateway logs instead.
- A manual gateway start was assumed at one point; the gateway is a LaunchAgent and should be restarted through `launchctl`.

---

## 6. Final Fix

1. Store the renewed key in the Keychain (updating in place).
2. Top up OpenRouter so the balance is positive.
3. Remove the stale/empty launchd variable and restart the gateway so it re-reads its configuration.
4. Add explicit `fallbacks` to the main agent's model object (or set `"fallbacks": []` to disable on purpose).
5. In the affected Telegram chat send `/new`, then `/model openrouter/free`.
6. Optional hardening: migrate `models.providers.openrouter.apiKey` to a SecretRef so the key is no longer plaintext in `openclaw.json`.

This fixes the causes rather than the symptom: the gateway now reads one authoritative key source, the account can spend, and no session pins an old model.

---

## 7. Commands

Shell: zsh, any directory. Prerequisite: the new key is on the clipboard or in a password manager (never paste it into logs or this repo).

```bash
# 1. Update the Keychain item in place (prompts for the value; -w with no argument asks)
security add-generic-password -U -a "$USER" -s "openrouter-api-key" -w

# 2. Clear any stale launchd value (unsetenv, NOT setenv "")
launchctl unsetenv OPENROUTER_API_KEY

# 3. Back up the config before editing
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak

# 4. Restart only the OpenClaw gateway
launchctl kickstart -k "gui/$(id -u)/ai.openclaw.gateway"

# 5. Check config health (shows the missing-fallbacks warning if present)
openclaw doctor --non-interactive
```

In the affected Telegram chat:

```text
/new
/model openrouter/free
```

Optional SecretRef migration (one-way; keep the backup):

```bash
openclaw secrets configure   # guided wizard; select models.providers.openrouter.apiKey
openclaw secrets audit
```

---

## 8. Verification

Recorded results:

- TUI replied on `openrouter/free`.
- Telegram replied from the free router (Nemotron by NVIDIA in that response).
- `openclaw doctor` no longer reported a credential problem for OpenRouter.
- `openclaw secrets audit` plaintext findings dropped from 25 to 23 after migrating the OpenRouter key.

Not verified: behaviour after a full reboot, and the SecretRef after a Keychain rotation.

```bash
launchctl print "gui/$(id -u)/ai.openclaw.gateway" | head -20
openclaw models status
openclaw secrets audit
```

Expected result: the gateway is `running`; `models status` shows the OpenRouter profile as valid; no 401 lines for `openrouter` in the gateway log after the restart.

---

## 9. Final Working State

- Gateway: LaunchAgent running, restarted via `launchctl kickstart -k`
- Provider/model: OpenRouter, `openrouter/free`
- Key source: Keychain item `openrouter-api-key`; `models.providers.openrouter.apiKey` is a SecretRef
- Account: positive OpenRouter balance
- Channels: TUI and Telegram both answering
- Backups: a pre-migration copy of `openclaw.json` exists for rollback, and a full OpenClaw backup was moved to a private folder with `chmod 600` (it contains plaintext credentials; do not publish or share it)

---

## 10. Optional Cleanup

- About 23 plaintext credential findings remain: other provider keys in `openclaw.json` and the shared auth-profile store (12 entries), which this OpenClaw version cannot migrate to SecretRefs. Revisit after an upgrade.
- A separate stale OpenAI embeddings key causes memory sync 401s; rotate or remove it.
- `openclaw doctor` also reported unrelated items (missing session titles, retained updater runtimes, an old backup). Run `openclaw doctor --fix` only after reviewing them.
- Do not delete the backups until the above is resolved.

---

## 11. If This Happens Again

Minimal diagnostics:

```bash
launchctl getenv OPENROUTER_API_KEY | wc -c    # length only; never print the value
openclaw models status
openclaw doctor --non-interactive
```

Also check the OpenRouter account balance and the gateway log for `status=401`.

Recovery: update the Keychain item, `launchctl unsetenv OPENROUTER_API_KEY`, `launchctl kickstart -k "gui/$(id -u)/ai.openclaw.gateway"`, then `/new` and `/model openrouter/free` in any chat that kept an old model.

Rollback: restore `~/.openclaw/openclaw.json` from the backup made in step 3 (or the pre-migration copy), then restart the gateway. SecretRef migration is one-way, so restoring that copy is the only way back to plaintext.
