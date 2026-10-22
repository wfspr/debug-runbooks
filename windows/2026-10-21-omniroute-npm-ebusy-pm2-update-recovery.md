# OmniRoute npm `EBUSY` upgrade failure under PM2 (Windows 11)

**Date:** 2026-10-21

**Status:** Fixed / Verified; follow-up items remain

**Platform:** Windows

---

### Summary
---

A global npm upgrade of OmniRoute from `3.8.49` to `3.8.52` failed on Windows 11 with `EBUSY` (`errno -4082`): npm could not rename the existing OmniRoute installation directory because the application was still running as a PM2-managed process and held open handles to files inside that directory. Re-running the identical command from an elevated Administrator shell returned the same error, because a Windows file lock is enforced by the kernel and is not released by elevation. Stopping the PM2-managed OmniRoute process before running npm freed the directory, the upgrade then completed, and the service was restarted and the process list re-saved. The upgrade is verified: npm reports `omniroute@3.8.52`, PM2 reports OmniRoute and 9Router online, and the v3.8.52 dashboard answers on `127.0.0.1:20128` with the previously configured provider topology still visible. End-to-end provider request functionality was not exercised, and several npm install-time observations remain open; they are listed under *Known limitations and outstanding follow-up* and are **not** resolved by this runbook.

---

### Environment
---

* **Machine:** White Ghost Rig
* **Operating system:** Windows 11 Pro
* **Shell:** PowerShell 7.7.0-preview.5
* **Package manager:** npm, installed and updated through UniGetUI
* **Process manager:** PM2
* **Application:** OmniRoute (model gateway and router)
* **Companion service:** 9Router — present, online, and untouched by this incident
* **OmniRoute version:** `3.8.49` → `3.8.52`
* **Relevant port:** `20128` (OmniRoute). 9Router listens on `20138`.
* **Global npm prefix:** `%APPDATA%\npm` (`npm root -g` → `C:\Users\USERNAME\AppData\Roaming\npm\node_modules`)
* **OmniRoute install directory:** `%APPDATA%\npm\node_modules\omniroute`
* **Application config directory:** `%USERPROFILE%\.omniroute\` (holds `.env`)
* **PM2 state directory:** `%USERPROFILE%\.pm2\` (holds `dump.pm2`)
* **PM2 process model:** the PM2 daemon supervises one child process per application; OmniRoute runs as a child of that daemon

Versions observed during the read-only audit on 2026-10-21, not during the failing install:

* `npm` 12.2.0
* `node` v24.20.0
* `pm2` 7.0.4
* `omniroute` 3.8.52 (global), `9router` 0.5.104 (global)

`omniroute@3.8.52` declares `engines: node >=22.22.2 <23 || >=24.0.0 <27`, so the observed Node.js v24.20.0 falls inside the supported range.

---

### Symptoms
---

The upgrade aborted inside npm's install phase, while npm was moving the previous copy of the package aside. npm reported a filesystem-level busy error rather than a network, registry, or permission error:

```text
npm error code EBUSY
npm error errno -4082
```

* The failing operation was the rename of the OmniRoute installation directory under the global npm prefix. npm retires the existing package directory before extracting the replacement tarball, and that rename was the step that failed.
* The error was reproducible: the first attempt and the Administrator retry returned the same `EBUSY` / `-4082`.
* The running service was not damaged by the failed update. OmniRoute kept serving on `20128` from the old `3.8.49` install until it was deliberately stopped.
* The registry side of the update was healthy. The failure occurred after the manifest and tarball had been resolved, and the audit confirmed that `https://registry.npmjs.org/` serves `omniroute@3.8.52` normally.

The verbatim npm error block could not be reproduced here. npm keeps only a small number of debug logs in `%LOCALAPPDATA%\npm-cache\_logs` (the `logs-max` default is 10), and the log for the original failing install had already been rotated out by the time the audit was run. The error code, the errno and the failing operation are recorded as observed at the time; the surrounding npm output lines are not.

---

### Timeline
---

Clock times were not recorded during the incident. The order of operations is what matters here.

| # | Date | Step | Outcome |
|---|------|------|---------|
| 1 | 2026-10-20 | `npm install -g omniroute@3.8.52` attempted | Failed with `EBUSY` / `errno -4082`; npm could not rename the OmniRoute install directory. |
| 2 | 2026-10-20 | Same command retried from an elevated Administrator shell | Identical `EBUSY` / `-4082`. Elevation does not clear a Windows file lock. |
| 3 | 2026-10-20 | Investigation of what holds the directory open | OmniRoute identified as running under PM2, with a PM2-managed child server process. |
| 4 | 2026-10-20 | `pm2 stop omniroute` | Managed process stopped; handles on the install directory released. |
| 5 | 2026-10-20 to 2026-10-21 | `npm install -g omniroute@3.8.52` re-run | Completed. npm reported `omniroute@3.8.52`. Install-time warnings recorded (peer dependencies, blocked install scripts). |
| 6 | 2026-10-21 | `pm2 restart omniroute --update-env` | Service restarted against the new install. |
| 7 | 2026-10-21 | `pm2 save` | PM2 process list persisted. |
| 8 | 2026-10-21 | Verification | `omniroute@3.8.52` reported by npm; OmniRoute and 9Router online in PM2; dashboard reachable on `127.0.0.1:20128`; provider topology visible. |
| 9 | 2026-10-21 | Read-only security audit (this runbook) | npm configuration hygiene, package origin, install-script surface, secret exposure and least-privilege posture reviewed. No system state was changed. |

---

### Evidence
---

Everything in this section was read on 2026-10-21 in a read-only pass. Facts reported from the incident itself are labelled as such and are not presented as audited state.

**Installed package and running services**

```text
npm root -g                        → C:\Users\USERNAME\AppData\Roaming\npm\node_modules
npm ls -g omniroute --depth=0      → omniroute@3.8.52
pm2 list                           → omniroute  3.8.52   online
                                     9router    0.5.104  online
```

**Native code loaded from inside the install directory.** `omniroute@3.8.52` depends on native addons and prebuilt binaries that are mapped into the running process. A mapped file cannot be renamed while the image is loaded.

| Package | Version | Lifecycle script declared by the package |
|---|---|---|
| `omniroute` | 3.8.52 | `postinstall`: `node scripts/build/postinstall.mjs`; `prepare`: husky init via `node -e "..."` |
| `esbuild` | 0.28.2 | `postinstall`: `node install.js` |
| `onnxruntime-node` | 1.30.0 | `postinstall`: `node ./script/install` |
| `keytar` | 7.9.0 | `install`: `prebuild-install \|\| npm run build` |
| `@parcel/watcher` | 2.6.0 | `install`: `node scripts/build-from-source.js` |
| `protobufjs` | 7.6.6 | `postinstall`: `node scripts/postinstall` |
| `better-sqlite3` | 13.0.3 | none declared; ships a prebuilt binary |
| `@swc/core` | 1.16.18 | none declared; ships N-API prebuilds |
| `sharp` | 0.35.5 | none declared; ships prebuilds |
| `marked-terminal` | 7.3.0 | none declared |
| `react` | 19.2.8 | none declared |

**Package origin and integrity** (`npm view omniroute@3.8.52`):

```text
name          omniroute
version       3.8.52
license       MIT
repository    git+https://github.com/diegosouzapw/OmniRoute.git
homepage      https://omniroute.online
maintainers   1 (the identity is published in the registry metadata and is not reproduced here)
dist.tarball  https://registry.npmjs.org/omniroute/-/omniroute-3.8.52.tgz
dist.integrity sha512-R+GUs3vDWpX36n+oOwjRSJN/7dGoXC3ehSV7mSz41nZM4mFhUo2+YepYzXMk5Hf6sIwCKRpGBaPMDVR8xbvwew==
dist.shasum   c7ab9067400b865dcffcaaa7b000ae18d4fd73b2
signatures    2 (npm registry)
attestations  SLSA v1
```

The `dist.integrity` value above is a public Subresource Integrity hash of a public tarball, not a credential. Published version history around the incident: `3.8.49` (2026-07-30), `3.8.50` (2026-08-28), `3.8.51` (2026-09-30), `3.8.52` (2026-10-19).

**npm install-script policy in force at audit time** (`npm config list`):

```text
registry        = https://registry.npmjs.org/
prefix          = C:\Users\USERNAME\AppData\Roaming\npm
cache           = C:\Users\USERNAME\AppData\Local\npm-cache
userconfig      = C:\Users\USERNAME\.npmrc
globalconfig    = C:\Users\USERNAME\AppData\Roaming\npm\etc\npmrc   (file not present on disk)
ignore-scripts  = false
allow-scripts   = ["omniroute keytar onnxruntime-node @parcel/watcher @swc/core protobufjs esbuild"]
strict-allow-scripts = false
dangerously-allow-all-scripts = false
strict-ssl      = true
audit           = true
```

npm reports the effect of that configuration on every install, verbatim:

```text
npm warn install-scripts .npmrc: ignoring unparseable entry "omniroute keytar onnxruntime-node @parcel/watcher @swc/core protobufjs esbuild"
npm warn install-scripts 1 package had install scripts blocked because they are not covered by allowScripts:
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
```

(The package named in the blocked count depends on which project is being installed. The lines above were captured from an unrelated `npm ci` of this repository's own site, but the "ignoring unparseable entry" warning is emitted for the same user npmrc in every project.)

**Network exposure** (`Get-NetTCPConnection -LocalPort 20128,20138 -State Listen`):

```text
LocalAddress LocalPort State  OwningProcess
------------ --------- ------  --------------
0.0.0.0       20128     Listen <omniroute pid>
0.0.0.0       20138     Listen <9router pid>
```

**What could not be recovered.** The npm debug log for the original failing install was rotated out of `%LOCALAPPDATA%\npm-cache\_logs` before the audit, so the verbatim `EBUSY` block and the exact peer-dependency warning text are not available. The per-package list of install scripts that npm blocked during *that* install was not captured either. What the audit did establish is the mechanism that blocked them, reproduced above: the `allow-scripts` entry is unparseable, npm ignores it, and therefore no package is covered by the allowlist and every install script is blocked. The count of seven blocked scripts matches the seven package names that the malformed entry was intended to allow.

---

### Root Cause
---

npm installs a global package by **retiring** the existing copy first. It renames `node_modules\<package>` out of the way, then extracts the new tarball into that path. The rename is the step that failed.

On Windows, a file that is open in another process cannot be renamed or deleted when that open handle does not permit it, and a file that is mapped as a loaded image — a `.node` native addon or a `.dll` — cannot be renamed at all while the image is loaded. Node.js keeps the whole dependency tree of the running server mapped for the lifetime of the process.

OmniRoute was running as a PM2-managed child process whose module resolution root was `%APPDATA%\npm\node_modules\omniroute`. Because the global npm prefix is shared, the entire dependency tree — `better-sqlite3`, `keytar`, `onnxruntime-node`, `sharp`, `@swc/core`, `esbuild` — lived inside the same directory tree that npm needed to rename. The running server was therefore holding the exact directory npm had to move.

The error class follows directly from that:

| Condition on Windows | What the filesystem returns | What npm reports |
|---|---|---|
| Target file open, or mapped as a loaded image, in another process | sharing violation on `rename` | `EBUSY`, `errno -4082` |
| Caller lacks rights on the directory | access denied | `EPERM` / `EACCES` |

`EBUSY` is a *lock* error, not a *permission* error, and that distinction explains the second failed attempt. Re-running the command in an elevated Administrator shell changed the caller's access token, not the sharing state of handles already held by another process, so the lock survived.

**Contributing conditions.** Two issues found during the audit made the situation worse without causing it, and they are recorded as open findings rather than as part of the fix:

* OmniRoute and 9Router bind `0.0.0.0` rather than loopback, so both dashboards are reachable from the local network.
* The shell used for the audit was itself running elevated, which means any install script executed during an update would run with administrator rights.

---

### Why stopping PM2-managed applications prevents the lock
---

`pm2 stop <app>` does more than pause a service: it terminates the managed child process. Termination is what matters for the lock.

1. **Termination unmaps every image.** When the OmniRoute child process exits, the Windows loader releases the section objects backing `better_sqlite3.node`, `keytar.node`, the `onnxruntime-node` binaries and the `sharp`/libvips shared libraries. An unmapped file can be renamed; a mapped file cannot.
2. **Termination closes every handle.** File handles owned by the process are released at exit, including the handle on the `node_modules` directory itself, the current-working-directory handle, and any open log or database file inside the install tree.
3. **The PM2 daemon does not hold the package directory.** The daemon supervises processes; it does not load code from inside `node_modules\omniroute`, so it never holds a handle on the package tree. Stopping the application is therefore sufficient. The daemon was not stopped, and did not need to be.
4. **Only the package directory has to be free.** npm renames the *package* directory, not the whole global `node_modules`. Stopping the one PM2 application whose install tree lives inside that directory is enough. 9Router kept running throughout the upgrade and was unaffected.

The general rule that follows: **any `npm -g` update of a package that is currently executing out of the global `node_modules` must be preceded by stopping every process that is executing it.** PM2 makes this easy to audit, because `pm2 list` names every managed process and `pm2 jlist` exposes each process's working directory and command line.

The mirror image of the same rule: the service must be restarted *after* the install, not before, or it keeps running the old code from a directory that no longer exists. `pm2 restart <app> --update-env` re-executes the new entry point, and `pm2 save` persists the process list so the supervisor restores the same set of applications after a reboot.

---

### What Did Not Work
---

* **Retrying the identical npm command as Administrator.** The same `EBUSY` / `-4082` came back. Windows sharing violations are enforced by the kernel for every caller; an elevated token does not release another process's handles and does not grant rename rights over a mapped image.
* **Treating the failure as a permissions problem.** `EBUSY` is not `EPERM`. Adjusting ACLs, ownership or the npm cache directory would not have released the lock, and the first attempt already ran in a session that owned the global prefix.
* **`npm install --allow-scripts <list>` with a space-separated argument.** The argument could not be parsed by npm and the command failed without changing anything. npm 12.2.0 does support the flag — `npm install --help` lists `--allow-scripts <package-list>`, `--strict-allow-scripts` and `--dangerously-allow-all-scripts` — so the failure was in the shape of the argument, not in the flag itself. The accepted separator is a comma; a space-delimited list is rejected as unparseable, which is the same defect as in the npmrc entry below.
* **`npm config set allow-scripts=<space-separated list>`.** The command completed without an immediate error, but its effect was not verified at the time, and the value it wrote was wrong. The read-only audit in this runbook established what it actually did: the key was written to the user npmrc as one space-delimited string, which npm then reports as an unparseable entry and ignores. The value was not changed by this runbook. See *Known limitations and outstanding follow-up*.
* **Stopping the PM2 daemon instead of the application.** Not attempted, and not required. The daemon never loads code from the package directory, so stopping it would not have released the lock. Recorded here so that it is not tried first next time.

---

### Final Fix
---

Stop the PM2-managed OmniRoute process so that Windows releases the handles on its installation directory, run the global npm upgrade while nothing is executing from that directory, then bring the service back and persist the process list.

```powershell
pm2 stop omniroute
npm install -g omniroute@3.8.52
pm2 restart omniroute --update-env
pm2 save
```

This fixes the root cause rather than the symptom. The retry after the stop succeeded because the rename npm performs during the retire step finally had no competing open handles and no mapped images. Nothing in the npm configuration, in the package itself, or in the filesystem permissions was changed to make the command work; the conflict was removed.

`--update-env` makes the restarted process pick up the current shell environment, so the process is not left holding an environment captured at an earlier `pm2 start`. `pm2 save` writes the current process list to the PM2 dump file so the supervisor restores the same applications after a reboot.

---

### Commands
---

**The recovery, as executed:**

```powershell
pm2 stop omniroute
npm install -g omniroute@3.8.52
pm2 restart omniroute --update-env
pm2 save
```

**Read-only diagnostics for the next `EBUSY`.** Every command below only reads state; none of them changes it.

```powershell
# 1. What is installed, and where does the global prefix live?
npm ls -g omniroute --depth=0
npm root -g
npm prefix -g

# 2. Which npm policy is actually in force? Read-only; never `npm config set` from a diagnostic.
npm config get registry
npm config get ignore-scripts
npm config get allow-scripts

# 3. Which node processes are running, and with which command lines?
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Select-Object ProcessId, CommandLine

# 4. Which PM2-managed processes exist, and what do they point at?
pm2 list
pm2 jlist | ConvertFrom-Json | Select-Object name, pid, @{n='status';e={$_.pm2_env.status}}

# 5. Who is running code out of the OmniRoute install directory?
$omni = Join-Path (npm root -g) 'omniroute'
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like "*$omni*" } |
  Select-Object ProcessId, Name, CommandLine

# 6. Is the service still listening, and on which interface?
Get-NetTCPConnection -LocalPort 20128 -State Listen -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, OwningProcess

# 7. Did an earlier interrupted install leave a retired copy behind?
Get-ChildItem (npm root -g) -Force -Directory |
  Where-Object Name -Like '*omniroute*' |
  Select-Object Name, LastWriteTime
```

**The update, once step 5 shows the only holder of the directory is the PM2-managed application:**

```powershell
pm2 stop omniroute
npm install -g omniroute@<target-version>
pm2 restart omniroute --update-env
pm2 save
```

---

### Verification
---

Each check below was run after the successful upgrade, and the recorded outcome is what was observed.

```powershell
# npm reports the new version
npm ls -g omniroute --depth=0

# PM2 reports both managed services online
pm2 list

# The PM2 process list is persisted
pm2 save

# The dashboard answers on the OmniRoute port
Invoke-WebRequest -Uri 'http://127.0.0.1:20128' -UseBasicParsing -TimeoutSec 10
```

Observed results:

* `npm ls -g omniroute --depth=0` listed `omniroute@3.8.52`.
* `pm2 list` showed OmniRoute `3.8.52` as `online` and 9Router `0.5.104` as `online`.
* `pm2 save` reported that the PM2 process list was saved.
* The v3.8.52 dashboard was reachable on `127.0.0.1:20128`.
* The previously configured provider topology was still visible in the dashboard, which confirms that the application data directory (`%USERPROFILE%\.omniroute`) survived the package replacement untouched.

**Not verified.** No end-to-end provider request was issued. The dashboard renders and the provider list is present, but no model call was made, so upstream reachability, credential validity and per-provider routing after the upgrade remain untested. See *Known limitations and outstanding follow-up*.

---

### Final Working State
---

* **OmniRoute:** version `3.8.52`, installed globally at `%APPDATA%\npm\node_modules\omniroute`, running under PM2 and reachable on `127.0.0.1:20128`.
* **9Router:** version `0.5.104`, running under PM2 on `20138`, untouched by the incident.
* **PM2 daemon:** running, with both applications registered as managed processes; the process list is saved to `%USERPROFILE%\.pm2\dump.pm2`.
* **Application data:** `%USERPROFILE%\.omniroute\` intact, including the `.env` file that holds the provider configuration. Its contents were not read or modified as part of this work beyond listing key names.
* **npm global prefix:** `%APPDATA%\npm`, with `ignore-scripts=false` and the `allow-scripts` entry described in the audit section still in place, unchanged by this runbook.
* **Network binding:** both services still listen on `0.0.0.0`. This is unchanged and is recorded as an open finding.
* **Repository state:** this runbook, the root `README.md` index entry, the new `windows/README.md` platform index, and one line in the site's AI-tool taxonomy are the only changes to the debug-runbooks repository. No runtime, configuration or credential state was changed.

---

### Security audit
---

A read-only audit of the affected host was performed on 2026-10-21 as part of this runbook. No configuration, service, credential, npm policy, registry entry, firewall rule or environment variable was modified, and no package install script was executed or approved.

**npm configuration hygiene**

| Finding | Severity | Evidence | State |
|---|---|---|---|
| `ignore-scripts=false` in the user npmrc re-enables lifecycle scripts globally | Medium | `npm config get ignore-scripts` → `false`; the value is written in `C:\Users\USERNAME\.npmrc` | Open — not changed |
| The `allow-scripts` entry in the user npmrc is unparseable and is ignored, so the allowlist it appears to express is not in force | Medium | `npm warn install-scripts .npmrc: ignoring unparseable entry "..."`, plus npm's "not covered by allowScripts" wording | Open — not changed |
| Six dependencies and OmniRoute itself declare install scripts that build or download native code, and they would run with the privileges of the invoking shell | High | the lifecycle-script table below; the audit shell was elevated | Open — not changed |
| No project-level `.npmrc` overrides the user npmrc in the repository | Info | no `.npmrc` is tracked in the repository, and none is present in the working tree | Clear |
| The registry is the public npm registry; TLS verification is on | Info | `npm config get registry` → `https://registry.npmjs.org/`; `strict-ssl=true` | Clear |
| No proxy, custom CA or registry credential is configured | Info | `proxy`, `https-proxy`, `cafile`, `ca` are all unset; npm masks `_auth` and `password` as `(protected)` with no non-default value | Clear |
| The global npmrc path does not exist on disk | Info | `npm config get globalconfig` → `C:\Users\USERNAME\AppData\Roaming\npm\etc\npmrc`, which is not present | Clear |

**The `allow-scripts` configuration**

`allow-scripts` is a real npm 12.2.0 configuration key, not a typo. It appears in the defaults section of `npm config ls -l`, npm describes it as a comma-separated list of packages whose install-time lifecycle scripts are allowed to run, and `npm install --help` lists the matching CLI flags `--allow-scripts <package-list>`, `--strict-allow-scripts` and `--dangerously-allow-all-scripts`. npm 12 also ships a dedicated command group for managing these approvals: `npm install-scripts approve`, `npm install-scripts deny`, `npm install-scripts ls` and `npm install-scripts prune`.

What the audit established about the value that was written:

* The key is present in the user npmrc at `C:\Users\USERNAME\.npmrc`, so the earlier `npm config set allow-scripts=...` did write to disk.
* It is stored as one space-delimited string, and npm reports it as a one-element array: `["omniroute keytar onnxruntime-node @parcel/watcher @swc/core protobufjs esbuild"]`.
* npm 12.2.0 parses that value by splitting on **commas**, not on whitespace. A space-delimited string therefore collapses into a single bogus package name that matches no dependency, and npm says so on every install: `npm warn install-scripts .npmrc: ignoring unparseable entry "..."`. The entry is ignored, not merely ineffective.
* The consequence is confirmed rather than inferred. npm reports the blocked scripts as "not covered by allowScripts", which is exactly what happens when the allowlist contains no valid entry. The seven blocked scripts reported during the OmniRoute upgrade match the seven package names the malformed entry was meant to allow, so the allowlist never once did its job.
* **The correct form** is a comma-separated list, or one `allow-scripts[]=<package>` line per package. Both of these are equivalent to npm:
  ```ini
  allow-scripts=omniroute,keytar,onnxruntime-node,@parcel/watcher,@swc/core,protobufjs,esbuild
  ```
  ```ini
  allow-scripts[]=omniroute
  allow-scripts[]=keytar
  allow-scripts[]=onnxruntime-node
  allow-scripts[]=@parcel/watcher
  allow-scripts[]=@swc/core
  allow-scripts[]=protobufjs
  allow-scripts[]=esbuild
  ```
* **The review command is `npm install-scripts ls`**, which lists the packages whose install scripts are currently blocked. `npm install-scripts approve <pkg>` records a per-package approval and `npm install-scripts deny <pkg>` records a refusal; the approval is written to the project's `package.json` under `allowScripts`, and a `package.json` that declares `allowScripts` takes precedence over the `.npmrc` value.
* Neither the npmrc file nor any approval list was changed by this runbook. Correcting them requires explicit approval, and each of the seven packages should have its lifecycle hook reviewed before it is allowed to run.

**Package origin and integrity**

| Finding | Severity | Evidence | State |
|---|---|---|---|
| The published package carries an SRI hash, two registry signatures and an SLSA v1 attestation | Info | `npm view omniroute@3.8.52` reports `dist.integrity`, `dist.shasum`, `dist.signatures` and `dist.attestations` | Clear |
| The installed version matches the published version | Info | installed `3.8.52` equals the registry's `3.8.52` | Clear |
| The installed tree is not re-verified against the published hash after installation | Low | a global install produces no lockfile, and no `package-lock.json` or `npm-shrinkwrap.json` exists in the install directory | Open — by design of global installs |
| The package is published by a single maintainer | Low | `npm view omniroute` lists one maintainer; the identity is published in the registry metadata and is not reproduced here | Open — not a change this runbook can make |
| The package declares a narrow supported Node.js range that the host satisfies | Info | `engines: node >=22.22.2 <23 \|\| >=24.0.0 <27`; the host runs v24.20.0 | Clear |

**Installation-script risk**

Seven install scripts were reported as blocked during the upgrade. The per-package list npm printed for that run could not be recovered, because the npm debug log had already been rotated out. The mechanism is confirmed: the allowlist was inoperative, so every install script in the tree was blocked. The installed tree contains the following lifecycle hooks, which is where the blocked scripts came from:

| Package | Script | What it would do |
|---|---|---|
| `omniroute` | `postinstall` | `node scripts/build/postinstall.mjs` — the package's own post-install step |
| `esbuild` | `postinstall` | `node install.js` — resolves the platform binary |
| `onnxruntime-node` | `postinstall` | `node ./script/install` — installs the ONNX Runtime binary |
| `keytar` | `install` | `prebuild-install \|\| npm run build` — fetches a prebuilt binary or compiles from source |
| `@parcel/watcher` | `install` | `node scripts/build-from-source.js` — native build step |
| `protobufjs` | `postinstall` | `node scripts/postinstall` |

**The blocked scripts' consequence.** Because the allowlist was inoperative, no package was covered, so every install script in the tree was blocked — including OmniRoute's own `postinstall`, `node scripts/build/postinstall.mjs`. The service starts and serves the dashboard, so that step was not required for startup, but any artifact it produces was not generated by this upgrade. The installed tree declares lifecycle hooks for six of the seven names in the intended allowlist; `@swc/core` ships N-API prebuilds and declares none, and `omniroute` declares both a `postinstall` and a `prepare` hook, so a blocked count of seven is consistent with that set.

Running these hooks is what makes an `npm -g` update an arbitrary-code-execution event with the privileges of the invoking shell. Because the shell used for the audit was elevated, an unguarded script would have run with administrator rights. None of these scripts was executed or approved during this work. The `allow-scripts` entry names six of the seven packages in the table above, plus `@swc/core`, which ships N-API prebuilds and declares no lifecycle hook — so the malformed entry was written on the assumption that those seven install scripts needed to be permitted, and in practice it permitted none of them.

**Secret exposure**

| Finding | Severity | Evidence | State |
|---|---|---|---|
| Provider credentials are stored as plaintext values in the application `.env` file | High | `C:\Users\USERNAME\.omniroute\.env` exists and defines `STORAGE_ENCRYPTION_KEY` plus one key per configured provider; values were not read or reproduced | Open — rotation recommended, not performed |
| `STORAGE_ENCRYPTION_KEY` is 64 hex characters, which is a hash-shaped value rather than a randomly generated key | Medium | length and character class observed; the value itself was not recorded | Open |
| The PM2 dump file persists the process environment, including the names of the provider key variables | Medium | `C:\Users\USERNAME\.pm2\dump.pm2` exists and contains exported credential-named variables such as the provider API keys and a bot token; values were not read or reproduced | Open |
| Credential-named variables are present in the process environment | Medium | environment variable names only were enumerated; no values were read | Open — by design of this deployment |
| No credential-bearing file is inside the repository working tree | Info | no `.env`, `*.pem`, `*.key`, `id_rsa*`, `*.p12` or `credentials*` file exists in the repository, and none is tracked by git | Clear |

**Least-privilege practices**

| Finding | Severity | Evidence | State |
|---|---|---|---|
| Both dashboards listen on all interfaces instead of loopback | High | `Get-NetTCPConnection` shows `0.0.0.0` on ports `20128` and `20138` | Open — changing the PM2 ecosystem configuration is outside the scope of this runbook |
| The npm shell runs elevated | Medium | the audit session reported Administrator rights | Open — practice recommendation |
| The install directory, the user npmrc, the application `.env` and the PM2 dump are owned by `BUILTIN\Administrators` rather than the individual account | Medium | `Get-Acl` owner on each path | Open — ownership changes require explicit approval |
| The npm cache directory is owned by the individual user account | Info | `Get-Acl` owner on the cache path | Clear |

**Audit limitations.** The audit was read-only and did not execute an install of OmniRoute, so the peer-dependency warnings and the per-package blocked-script list for that specific install were not reproduced. The `allow-scripts` mechanism was confirmed, but by observing npm's own warnings during an unrelated `npm ci` of this repository's site, not during an OmniRoute install. The installed tree was not verified against the published SRI hash. Detailed per-principal access entries were truncated in the `Get-Acl` output and only the owner was confirmed.

---

### Known limitations and outstanding follow-up
---

None of the following is resolved. They are recorded exactly as observed.

1. **Peer-dependency warnings were not reproduced.** npm emitted peer-dependency warnings involving `marked-terminal` and React during the upgrade. A read-only audit cannot reproduce install-time warnings, and the npm debug log for that run had been rotated out. The installed manifest lists `marked-terminal` 7.3.0 and `react` 19.2.8 as direct dependencies rather than peer dependencies, so the origin of the warning is unexplained. **Open.**
2. **The exact list of scripts npm blocked during the OmniRoute install is still not recoverable.** The count of seven was reported at the time, the package names were not captured, and the npm debug log was rotated out. The mechanism is confirmed and the count is consistent with the seven packages the malformed allowlist was meant to permit, but the verbatim per-package list npm printed for that install is not available. **Open.**
3. **The `--allow-scripts` CLI invocation failed on an unparseable argument.** npm 12.2.0 does support the flag, so the argument shape was the problem. No corrected invocation was run, and no install script was approved. **Open.**
4. **The effect of the `npm config set allow-scripts=...` command is now established, but the configuration is still not corrected.** npm's own warning confirms the value is unparseable and ignored, and the "not covered by allowScripts" message confirms the consequence. The npmrc still holds the malformed entry and no approval list has been recorded, because both changes need explicit approval. **Open.**
5. **API request functionality was not independently tested.** The dashboard was reachable and the provider topology was visible, but no provider request was issued, so upstream reachability and credential validity after the upgrade are unconfirmed. **Open.**
6. **The `allow-scripts` allowlist still names packages whose install scripts execute native build steps.** Because the entry is ignored, nothing is currently permitted to run, which is the fail-closed outcome — but the entry itself is uncorrected, and a "repair" that mechanically approves those seven packages would re-open the exposure without any of their hooks having been reviewed. **Open.**
7. **The two services still bind `0.0.0.0`.** The dashboards are reachable from the local network. Remediation requires changing the PM2 ecosystem configuration, which was outside the scope of this work. **Open.**
8. **Credentials remain in plaintext in the application `.env` file and in the PM2 dump.** Rotation and storage changes were not performed. **Open.**
9. **The `STORAGE_ENCRYPTION_KEY` value is hash-shaped rather than randomly generated.** Changing it would invalidate whatever it protects, so it was left untouched. **Open.**

---

### Prevention
---

* **Stop before you install.** Treat "stop the PM2-managed process, update, restart, save" as one indivisible sequence for any `npm -g` update of a package that is currently running. The order is the whole point: install-then-restart leaves the service running code that has been replaced, and restart-then-install is what produces `EBUSY`.
* **Script the sequence.** A PowerShell function that stops, installs, restarts and saves removes the chance of getting the order wrong under time pressure.
* **Check the holder before the install.** The read-only step 5 in the Commands section identifies every process running code out of the install directory. If a holder appears that PM2 does not manage, stop that manually first.
* **Keep a copy of the previous version.** `npm pack omniroute@<current-version>` before an upgrade writes a tarball of the installed version to the current directory, which allows a rollback without a network round-trip.
* **Install into a separate prefix when a rollback must be guaranteed.** `npm install -g --prefix <staging-dir> <pkg>@<version>` keeps the live install untouched until the new one is proven to start, after which the directories are swapped.
* **Use `pm2 reload` for ordinary restarts, not for upgrades.** `reload` is for reloading a service without changing the package; it does not touch the install directory and does not need to be preceded by a stop.
* **Keep install scripts disabled by default.** `ignore-scripts=true` with a per-install `--allow-scripts` for the specific packages that need it limits arbitrary code execution to the packages you have actually reviewed. Correct the existing `allow-scripts` entry to the comma-separated form first, and review each listed package's lifecycle hook before allowing it. `npm install-scripts ls` shows what is currently blocked, and `npm install-scripts approve <pkg>` records a per-package approval.
* **Do not run npm elevated.** A lifecycle script then runs with the privileges of the calling shell, so a routine package update should not be an administrator operation.
* **Review what an update is about to execute.** `npm install-scripts ls` lists every package whose install script is currently blocked. Read that list before an update, and approve a package only after reading its lifecycle hook — an update is a code-execution event, and the hook runs with the privileges of the shell that started it.
* **Bind the dashboards to loopback.** `127.0.0.1` instead of `0.0.0.0` keeps the OmniRoute and 9Router dashboards off the local network. The macOS equivalent of this hardening is already documented in [macOS localhost AI-service hardening](../macos/localhost-ai-service-hardening-security-cleanup-macos-2026-09-10.md).
* **Rotate and relocate the credentials.** Move provider keys out of the plaintext `.env` file and out of the PM2 dump into a secret store, and rotate the keys that were resident in both.

---

### Rollback
---

The package version is the only thing that changes in a rollback. The application data directory `%USERPROFILE%\.omniroute` is not touched by a package version change, and the provider topology survived the upgrade intact, so it survives a rollback as well.

```powershell
# Roll OmniRoute back to the previous published version
pm2 stop omniroute
npm install -g omniroute@3.8.49
pm2 restart omniroute --update-env
pm2 save
```

* **Verify the rollback the same way** as the upgrade: `npm ls -g omniroute --depth=0`, `pm2 list`, and a request to `http://127.0.0.1:20128`.
* **`pm2 save` after the rollback** keeps the saved process list in step with the running daemon. The dump records process definitions rather than the package version, so the version rollback itself does not depend on it.
* **A rollback reinstalls the old dependency tree.** The same install-script policy applies to it, so a rollback can hit the same blocked-scripts behaviour as the original upgrade. If the rolled-back version refuses to start, inspect the logs before changing anything:
  ```powershell
  pm2 logs omniroute --lines 50 --nostream
  ```
* **Native modules may need rebuilding after a rollback**, because the older version may expect a different prebuilt binary. `npm rebuild omniroute` would perform that, but it runs install scripts and was deliberately not performed or verified during this incident. It needs explicit approval before use.
* **If the rollback cannot reach the registry**, use a tarball captured beforehand with `npm pack omniroute@<version>` and install it from the local file.
* **If the service cannot be made to start**, leaving it stopped is better than leaving it in a restart loop: `pm2 stop omniroute` keeps the port free and the failure visible in `pm2 list`.

---

### Optional Cleanup
---

* npm's debug log directory keeps only a small number of files, so there is no long-term log backlog to prune.
* The npm cache grows with every install. `npm cache verify` reports the cache state without deleting anything; `npm cache clean --force` is destructive and is not recommended as routine cleanup.
* If an interrupted install ever leaves a retired copy of the package behind under the global `node_modules`, the check in step 7 of the Commands section will show it. The audit did not report leftovers, and nothing should be deleted until that check has been run and no process is using the directory.
* Nothing in the application data directory needs to be removed: `%USERPROFILE%\.omniroute` holds the working configuration and the provider topology.

---

### If This Happens Again
---

**Shortest diagnostic sequence.** Read-only, and safe to run at any time:

```powershell
npm ls -g omniroute --depth=0
$omni = Join-Path (npm root -g) 'omniroute'
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like "*$omni*" } |
  Select-Object ProcessId, Name, CommandLine
pm2 list
```

If the last two commands show a PM2-managed OmniRoute process, the cause is the same lock as this incident.

**Shortest recovery procedure:**

```powershell
pm2 stop omniroute
npm install -g omniroute@<target-version>
pm2 restart omniroute --update-env
pm2 save
```

**Then verify:**

```powershell
npm ls -g omniroute --depth=0
pm2 list
Invoke-WebRequest -Uri 'http://127.0.0.1:20128' -UseBasicParsing -TimeoutSec 10
```

If the error is `EPERM` or `EACCES` rather than `EBUSY`, this is a different failure: it is a rights problem on the global prefix, not a lock, and the `EBUSY` sequence above will not help.

---

### Credits
---

This runbook, the read-only security audit behind it, the evidence collection and the repository changes were produced by **Kilo CLI** (the `@kilocode/cli` coding agent), working from the operator's incident report and a read-only audit of the affected host.

The upgrade itself — the four commands in *Final fix* — was executed by the operator on the host. The agent did not install, stop, restart, reconfigure or otherwise modify OmniRoute, 9Router, PM2, the npm configuration, the application `.env` file, or any environment variable, and it did not execute or approve any package install script.

No other AI assistant was involved in this runbook, and no work has been attributed to one.
