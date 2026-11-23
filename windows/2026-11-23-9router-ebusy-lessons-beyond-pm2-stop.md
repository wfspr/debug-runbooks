# 9Router npm `EBUSY` update: lessons beyond stopping PM2

**Date:** 2026-11-23

**Status:** Fixed / Verified; follow-up items remain

**Platform:** Windows

**Authored with:** Anthropic Claude app (cloud session linked to the Claude desktop app), Claude Opus 5.5

---

## 1. Summary

This is a lessons-only runbook. The basic recovery for a PM2-managed npm package that fails with `EBUSY` (stop the process, install, restart) is already covered in [OmniRoute npm `EBUSY` upgrade failure under PM2](2026-10-21-omniroute-npm-ebusy-pm2-update-recovery.md). The port layout comes from [PM2 Windows Dual-Router Setup](2026-08-23-pm2-windows-dual-router-setup.md).

The 9Router update from `0.5.112` to `0.5.123` failed in UniGetUI with `EBUSY`. Four things were new this time:

1. `pm2 stop all` reported every app as `stopped`, yet the very next `npm install -g` still failed with `EBUSY` on a subfolder (`9router\app`).
2. A second attempt worked after an explicit check confirmed that no `node.exe` process referencing 9Router was still running.
3. npm 12 blocked 9Router's `postinstall` script (`allowScripts`). The script was reviewed and left blocked.
4. The 9Router error log showed `EADDRINUSE` on port `20128`. That port belongs to OmniRoute, which was confirmed by process ID. 9Router itself answers on `20138`.

Final state: `9router@0.5.123` is installed, all three PM2 apps are online, and 9Router answers HTTP on `20138`.

---

## 2. Environment

- Operating system: Windows (machine "White Ghost Rig")
- Shell: PowerShell 7.7.0-preview.5
- Package manager: npm (global prefix `%APPDATA%\npm`), driven by UniGetUI (operation scope `machine`)
- Process manager: PM2, supervising `9router` (id 1), `omniroute` (id 0) and `hermes-agent` (id 2)
- Application: 9Router `0.5.112` → `0.5.123`
- Install directory: `C:\Users\<USER>\AppData\Roaming\npm\node_modules\9router`
- PM2 logs: `%USERPROFILE%\.pm2\logs\9router-error.log`, `9router-out.log`
- Ports: `20128` OmniRoute, `20138` 9Router

---

## 3. Symptoms

UniGetUI update (it runs `npm.ps1 install 9router@0.5.123 --global`):

```text
npm error code EBUSY
npm error syscall rename
npm error path C:\Users\<USER>\AppData\Roaming\npm\node_modules\9router
npm error dest C:\Users\<USER>\AppData\Roaming\npm\node_modules\.9router-peRvzMhn
npm error errno -4082
```

Manual retry, run immediately after `pm2 stop all` and `pm2 list` showed all three apps `stopped`:

```text
npm error code EBUSY
npm error syscall rename
npm error path C:\Users\<USER>\AppData\Roaming\npm\node_modules\9router\app
npm error dest C:\Users\<USER>\AppData\Roaming\npm\node_modules\.9router-peRvzMhn\app
npm error errno -4082
```

Note that the locked path moved from the package root to the `app` subfolder. npm had started moving the folder and then hit a lock deeper inside it.

After the successful install, the PM2 error log contained:

```text
⨯ Failed to start server
Error: listen EADDRINUSE: address already in use 0.0.0.0:20128
⚠️  Server exited (code=1). Restarting in 2s... (2/2)
```

---

## 4. Root Cause

- **`EBUSY`:** Windows will not rename a folder while a process holds open files inside it. PM2 runs 9Router, so the folder is locked whenever it runs.
- **The lock that survived `pm2 stop all`:** **not determined.** PM2 reported every app stopped. The install ran about one second later and still hit a lock in `9router\app`. Three minutes later a `node.exe` scan found no 9Router process and the install succeeded. The most likely explanation is a child process (9Router starts a tray runtime) that was still shutting down, or a short-lived handle from another program. Neither was confirmed.
- **`EADDRINUSE` on `20128`:** port `20128` is held by OmniRoute (PID 23768 runs `omniroute\dist\server-ws.mjs`, and its parent is PM2's `omniroute` process). At some point a 9Router start tried to bind `20128` and crashed. The PM2 log is cumulative, so it was not established which run produced those lines. The current 9Router run serves on `20138`.

---

## 5. What Did Not Work

- Retrying in UniGetUI while PM2 was running: `EBUSY`, as in the earlier runbook.
- **`pm2 stop all` followed immediately by `npm install -g`.** `pm2 list` showing `stopped` was not enough proof that the folder was free. This is the main new lesson.
- Checking for leftover processes *after* `pm2 start all`. That check found PID 14896, which was simply the freshly restarted 9Router. The check only means something while PM2's apps are stopped.

Historical sequence (failed; do not copy):

```powershell
pm2 stop all
pm2 list
npm install -g 9router@0.5.123   # EBUSY on 9router\app
```

---

## 6. Final Fix

Stop 9Router, confirm that no `node.exe` process references 9Router, and only then install. The check takes the place of trusting `pm2 list`. It also adds a few seconds, which gives any lingering child process time to exit.

On 2026-11-23 the recorded run used `pm2 stop all` / `pm2 start all`, which also stopped OmniRoute and Hermes. The commands below are scoped to `9router` only, as CONTRIBUTING.md requires. That scoped form was **not** run on this date. Keep the process check: it is what made the install succeed.

The npm-blocked `postinstall` script (`hooks/postinstall.js`) was read and left blocked. It only pre-warms the SQLite and tray runtimes into `~/.9router/runtime`, it treats failure as non-fatal, and its own comment says the CLI fetches whatever is missing at runtime. The helper files it calls (`sqliteRuntime.js`, `trayRuntime.js`) were **not** reviewed.

---

## 7. Commands

PowerShell 7, any working directory, normal (non-elevated) user shell.

Stop only 9Router and look for leftover 9Router processes (scoped form, not run on 2026-11-23):

```powershell
pm2 stop 9router
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '9router' } | Format-List ProcessId, CommandLine
```

If that lists anything, stop the listed process, then check again:

```powershell
Stop-Process -Id <PID> -Force
```

When the check prints nothing, install and confirm the version:

```powershell
npm install -g 9router@<VERSION>
npm list -g 9router
```

Start 9Router again:

```powershell
pm2 start 9router
```

Do not run `pm2 start all` while 9Router should stay stopped. On an earlier update, starting all apps brought 9Router back and recreated the lock.

Review the blocked `postinstall` script before deciding whether to allow it:

```powershell
Get-Content "$env:APPDATA\npm\node_modules\9router\hooks\postinstall.js"
```

Only if a reviewed script is needed, allow it for this one install (not used on 2026-11-23):

```powershell
pm2 stop 9router
npm install -g 9router@<VERSION> --allow-scripts=9router
pm2 start 9router
```

Identify who owns each router port:

```powershell
Get-NetTCPConnection -LocalPort 20128,20138 -State Listen | Select LocalPort, OwningProcess, @{n='Name';e={(Get-Process -Id $_.OwningProcess).Name}}
Get-CimInstance Win32_Process -Filter "ProcessId=<PID>" | Format-List ProcessId, ParentProcessId, CommandLine
pm2 pid 9router
pm2 pid omniroute
```

---

## 8. Verification

Recorded results on 2026-11-23:

```powershell
npm install -g 9router@0.5.123
```

```text
changed 11 packages in 7s
npm warn install-scripts   9router@0.5.123 (postinstall: node hooks/postinstall.js)
```

```powershell
npm list -g 9router
```

```text
`-- 9router@0.5.123
```

`pm2 start all` (the recorded, unscoped command) → `9router`, `hermes-agent` and `omniroute` all `online`. The newest `9router-out.log` entry reads `🚀 9router v0.5.123` and `Server: http://localhost:20138`.

Port ownership:

```text
LocalPort OwningProcess Name
--------- ------------- ----
    20128         23768 node
```

PID 23768 runs `omniroute\dist\server-ws.mjs` with parent 23148, which matches `pm2 pid omniroute`. `pm2 pid 9router` returned 27828.

HTTP check:

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:20138
```

```text
307
```

A `307` is a redirect, normally to the dashboard, which shows the 9Router server is answering.

Not verified:

- `Get-NetTCPConnection` did not list a listener on `20138` even though `curl` got an answer there. This was not explained.
- No routed model request was sent through 9Router after the update, and the dashboard was not opened.
- It was not established when the `EADDRINUSE` log lines were written.

---

## 9. Final Working State

- `9router@0.5.123` installed globally; `postinstall` intentionally left blocked
- PM2: `9router` (pid 27828), `omniroute` (pid 23148) and `hermes-agent` all `online`
- `20128` → OmniRoute (`server-ws.mjs`, PID 23768)
- `20138` → 9Router, HTTP `307`
- UniGetUI may stop listing 9Router after a manual npm install. This was seen after earlier updates as well.

---

## 10. Optional Cleanup

- Clearing the 9Router logs: on 2026-11-23 at 23:22 `pm2 flush 9router` was run **without an archive** (output: `Logs flushed` for `9router-out.log` and `9router-error.log`). The record of when the `EADDRINUSE` on `20128` happened is therefore gone. If the error comes back, the fresh logs will date it. Next time, defer the flush until the follow-ups are verified, because `pm2 flush 9router` empties the application's whole current logs, not just the old lines. Archive both logs first:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dest = "$env:USERPROFILE\.pm2\logs\archive-$stamp"
New-Item -ItemType Directory -Path $dest | Out-Null
Copy-Item "$env:USERPROFILE\.pm2\logs\9router-out.log", "$env:USERPROFILE\.pm2\logs\9router-error.log" -Destination $dest
Get-ChildItem $dest
```

Only after both copies are listed and verification is complete:

```powershell
pm2 flush 9router
```

To recover, open the archived files in `$dest`. Treat the archive as potentially sensitive, as PM2 logs can include request details.

- Follow-ups still open:
  - Review `hooks/sqliteRuntime.js` and `hooks/trayRuntime.js` before ever allowing the `postinstall` script.
  - Pin the 9Router port to `20138` in its config, so no start can try OmniRoute's `20128`.
  - The previous 9Router version logged a `0.0.0.0` bind, which is reachable on the tailnet at `<TAILSCALE_IP>:20138`. If remote access isn't needed, bind it to `127.0.0.1`.
  - Send one routed model request to confirm 9Router works end to end, not just that it answers HTTP.

---

## 11. If This Happens Again

Minimal diagnostics:

```powershell
pm2 describe 9router
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '9router' } | Format-List ProcessId, CommandLine
```

Shortest recovery (scoped to 9Router; the scoped stop and start were not run on 2026-11-23, the recorded run used `all`):

```powershell
pm2 stop 9router
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '9router' } | Format-List ProcessId, CommandLine
npm install -g 9router@<VERSION>
npm list -g 9router
pm2 start 9router
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:20138
```

Run the install only after the process check prints nothing. If the scoped stop does not free the folder, fall back to the recorded `pm2 stop all` / `pm2 start all`, which also interrupts OmniRoute and Hermes. If `EBUSY` persists with no process listed, close any terminal, Explorer or editor window open inside `node_modules\9router`, then retry.
