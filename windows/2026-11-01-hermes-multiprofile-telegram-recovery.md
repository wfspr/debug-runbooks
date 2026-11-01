# Hermes multi-profile Telegram recovery after v0.22.5 update

**Date:** 2026-11-01  

**Status:** Fixed / Verified; follow-up items remain  

**Platform:** Windows

---

## 1. Summary

Hermes Agent on Windows 11 ran three profiles (`default`, `coder`, `news`) through a single scheduled-task gateway. After an interrupted update, `hermes gateway status` reported no gateway process, and Telegram and Photon credential conflicts were reported. The recovery updated Hermes to v0.22.5, gave `coder` and `news` their own Telegram bots, removed Photon credentials from them, enabled multiplexing, and disabled WhatsApp and Email. All three Telegram bots replied to a test message.

Email authentication and WhatsApp were not restored. Both are disabled.

---

## 2. Environment

- Operating system: Windows 11
- Shell: PowerShell 7.7.0-preview.5
- Runtime/application: Hermes Agent, stable channel
- Version: v0.22.2+2636.g0319e11 → v0.22.5 (commit `bf0203a794`)
- Hermes home: `C:\Users\<USER>\AppData\Local\hermes`
- Profile homes: `…\hermes\profiles\coder`, `…\hermes\profiles\news`
- Gateway service: Windows scheduled task `Hermes_Gateway`
- Relevant ports: none used by this fix
- Platforms before fix: Telegram, Photon, WhatsApp, Email (all profiles)
- Platforms after fix: Telegram (one bot per profile); Photon on `default` only; WhatsApp and Email disabled

---

## 3. Symptoms

Update conflict and interruption:

```text
✗ Another Hermes update is already running (started 1m 14s ago, process 20300).
```

```text
⚠ The previous update (2026-10-31T22:02:53.468889+00:00) was interrupted before it finished (process exited during the update (last stage: snapshot)); this update completes the work it still owed.
```

Gateway stopped after the interruption:

```text
✗ No gateway process detected
```

The scheduled task still reported `Status: Ready` and `Last Run Result: 0`.

Credential conflicts:

```text
⚠ Profiles 'default' and 'coder' both hold the same telegram credential (TELEGRAM_BOT_TOKEN) ...
⚠ Profiles 'default' and 'coder' both hold the same photon credential (PHOTON_PROJECT_ID/PHOTON_PROJECT_SECRET) ...
⚠ Profiles 'default' and 'news' both hold the same telegram credential (TELEGRAM_BOT_TOKEN) ...
⚠ Profiles 'default' and 'news' both hold the same photon credential (PHOTON_PROJECT_ID/PHOTON_PROJECT_SECRET) ...
```

Symptoms after the migration:

- Messages to the `coder` and `news` bots received no reply.
- The gateway log repeated an Email IMAP failure:

```text
[Email] IMAP connection failed: Basic authentication is disabled.
```

- The gateway log repeated WhatsApp reconnect attempts every 300 seconds.

---

## 4. Root Cause

- **Shared Telegram and Photon credentials.** One platform token can be served by only one gateway. Three profiles held the same `TELEGRAM_BOT_TOKEN`, so only one adapter claimed it and the others were parked.
- **Stopped gateway.** The interrupted update left the gateway stopped. The next update restored the scheduled task but not the process until the gateway was restarted.
- **Environment loaded at startup.** The gateway reads `.env` and `config.yaml` when it starts. Token edits had no effect until a restart.
- **Email authentication.** The Outlook/Live IMAP server rejects basic authentication. This is a provider policy, not a Hermes bug.
- **WhatsApp reconnect loop.** WhatsApp was enabled in config without a working session. The specific cause was not determined; it was disabled instead.

---

## 5. What Did Not Work

- **Relying on the migration plan as confirmation.** `hermes gateway migrate --multiplex` printed the same plan before and after the `.env` edits. The plan does not read credentials, so it did not confirm the token fix.
- **Migrating without a restart.** After the token edits, the first migration reported `Migration applied, but the default gateway has not confirmed serving: coder, news`. The bots stayed silent until the gateway was restarted.
- **Running `hermes update` while another update was active.** The second attempt was refused. The later run completed the interrupted update.

---

## 6. Final Fix

1. Create one Telegram bot per profile with BotFather. `default` keeps its existing token. `coder` and `news` each get a new token.
2. In the `coder` and `news` `.env` files:
   - Set `TELEGRAM_BOT_TOKEN` to the new bot's token.
   - Remove `PHOTON_PROJECT_ID` and `PHOTON_PROJECT_SECRET`.
3. In each profile's `config.yaml`, set `enabled: false` under `whatsapp:` and `email:`. In each `.env`, set `WHATSAPP_ENABLED=false`.
4. Run `hermes gateway migrate --multiplex`. This sets `gateway.multiplex_profiles: true` in the `default` config.
5. Restart the gateway with `hermes gateway restart`. This reloads the `.env` and config changes.
6. Re-run the migration. It should report that the gateway is already serving `default`, `coder`, and `news`.

Each token now has exactly one owner, and the single `default` gateway serves all three profiles.

---

## 7. Commands

Shell: PowerShell, any working directory. Run the update before the config changes. Back up before editing: the update created a pre-update backup at `C:\Users\<USER>\AppData\Local\hermes\backups\pre-update-2026-11-01-062707.zip` (242.4 MB). Restore with `hermes import <path-to-zip>`.

Locate the profile env files (names and paths only; do not print values):

```powershell
Get-ChildItem "$env:LOCALAPPDATA\hermes" -Recurse -Filter .env -ErrorAction SilentlyContinue | Select-Object FullName
```

Locate the WhatsApp blocks in each config:

```powershell
Select-String -Path "$env:LOCALAPPDATA\hermes\config.yaml","$env:LOCALAPPDATA\hermes\profiles\*\config.yaml" -Pattern "^whatsapp:" -Context 0,4
```

Apply the update, the migration, and the restart:

```powershell
hermes update
```

```powershell
hermes gateway migrate --multiplex
```

```powershell
hermes gateway restart
```

```powershell
hermes gateway migrate --multiplex
```

---

## 8. Verification

Gateway state:

```powershell
hermes gateway status
```

Expected result:

```text
✓ Scheduled Task registered: Hermes_Gateway
  Status: Ready
✓ Gateway process running (PID: <PID>)
```

No `⚠` credential-conflict lines should appear.

Migration state:

```powershell
hermes gateway migrate --multiplex
```

Expected result:

```text
✓ The default gateway is already multiplexing (serving default, coder, news).
```

Functional check (recorded): a message sent to each of the three Telegram bots received a reply from that bot.

Not verified: Email send and receive, and WhatsApp.

---

## 9. Final Working State

- Hermes Agent: v0.22.5 (`bf0203a794`), stable channel
- Gateway: one process serving `default`, `coder`, and `news`
- Scheduled task `Hermes_Gateway`: Ready
- `gateway.multiplex_profiles: true` in the `default` config
- Telegram: one bot per profile, all three replying
- Photon: `default` only
- WhatsApp: disabled in all three profiles
- Email: disabled in all three profiles

---

## 10. Optional Cleanup

- **Duplicate keys in each `.env`.** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS`, and `TELEGRAM_HOME_CHANNEL` each appear twice. The loader's precedence was not checked. Confirm which line takes effect before removing either copy.
- **Stale update stashes.** The updater listed three `hermes-update-autostash-*` entries older than 7 days. Review each with `git stash show -p <entry>` before applying or dropping it.
- **Pre-update backup.** Keep the backup zip until the setup has run stably for a while.

---

## 11. If This Happens Again

Shortest diagnostic sequence:

```powershell
hermes gateway status
```

```powershell
hermes logs | Select-String telegram
```

Shortest recovery sequence:

```powershell
hermes gateway migrate --multiplex
```

```powershell
hermes gateway restart
```

If a conflict warning remains, give each profile its own bot token and remove the shared credential from the profile that should not own it, as in section 6.
