# Codex desktop and Ollama restoration recovered native OpenAI models

**Date:** 2026-10-21
**Status:** Fixed / Verified; follow-up items remain
**Platform:** Windows 11

---

## 1. Summary

After migrating from ChatGPT Classic to the newer Codex desktop app, Codex initially could not load its configuration. Removing an unsupported legacy profile declaration let Codex launch, but both Codex and ChatGPT Work continued to show only custom Ollama models. Removing the global model/provider overrides and the custom model-catalog override did not restore the native OpenAI model selector.

The successful remediation was to close ChatGPT Classic and Codex completely, then run `ollama launch codex-app --restore`. After restoration, native OpenAI models appeared in both Codex and ChatGPT Work. A separate malformed subagent definition was corrected by adding its required description. The existing OmniRoute, 9Router, and Ollama services were preserved; their complete operational health and request routing were not independently verified.

## 2. Environment

- Operating system: Windows 11
- Machine: White Ghost Rig
- PowerShell: 7.7.0-preview.5
- Ollama: 0.40.6
- Codex configuration: `$env:USERPROFILE\.codex\config.toml`
- Latest configuration backup: `$env:USERPROFILE\.codex\config.toml.backup-20261021-063035`
- Full recovery snapshot: `$env:USERPROFILE\Codex-Recovery-20261021-060216`
- Ollama restoration record: `$env:USERPROFILE\.ollama\launch\codex-app-restore.json`
- Ollama backup directory: `$env:USERPROFILE\.ollama\backup\codex-app`
- An Ollama backup dated 2026-05-23 was observed.
- Existing local service endpoints: OmniRoute at `localhost:20128`, 9Router at `localhost:20138`, and Ollama at `127.0.0.1:11434`.

The `$env:USERPROFILE` expressions above are PowerShell paths that resolve under the signed-in Windows profile. The account name is intentionally not published.

### Architecture and diagnostic interpretation

The initial Codex configuration selected `gpt-5.5` through the `9router` provider with `xhigh` reasoning effort. These settings have different roles:

- `model` selects the requested model identifier; `model_provider` selects the provider configuration used to serve it. `model_reasoning_effort` sets a model option. These do not, by themselves, establish which models the desktop model selector displays.
- Provider stanzas such as `[model_providers.9router]` and `[model_providers.ollama-launch-codex-app]` define custom provider integrations. A custom provider may point a client at an OpenAI-compatible local API. Merely having a provider stanza or a local endpoint does not prove that a request reached it successfully.
- A custom `model_catalog_json` override can affect the model catalog shown to a client. Removing it did not resolve this incident.
- Ollama's `ollama launch codex-app` integration can configure the desktop app for Ollama use. The exact internal mechanism by which its restore operation returned the native catalog was not independently inspected; this runbook records the observed before-and-after behavior, not an assumed implementation.

**Confirmed:** the initial configuration contained the settings and stanzas listed below; cached model data included native OpenAI model identifiers; and the Ollama restore command was followed by native OpenAI models appearing in both applications.

**Not established:** whether every model-list result came from a live provider, the exact persistence mechanism behind the Ollama-only selector, and which endpoint handled any subsequent inference request.

## 3. Symptoms

The initial Codex configuration load error was:

```text
ChatGPT configuration could not be loaded.

legacy profile = "ollama-launch-codex-app" config
is no longer supported.
```

The affected configuration referenced `profile = "ollama-launch-codex-app"` at line 1 and `[profiles.ollama-launch-codex-app]` at line 102. After the app started, the model selector in both Codex and ChatGPT Work showed only custom Ollama models instead of native OpenAI models.

Codex also logged this warning:

```text
Ignoring malformed agent role definition:
agent role `subagent` must define a description.
```

## 4. Root Cause

There were two distinct configuration issues:

1. **Obsolete profile selection:** the active configuration selected a legacy `ollama-launch-codex-app` profile that the newer desktop app no longer supported. Removing the top-level default profile declaration resolved the startup error. The profile and related provider configuration were part of the initial file, but the error specifically identified the selected legacy profile as unsupported.
2. **Ollama-managed model selection remained:** removing the default model/provider overrides and the custom catalog override was not sufficient to restore the model selector. The successful change came from Ollama's supported restore operation after its launch/restore records and backup directory were identified. The observed recovery does not establish which exact file or internal setting controlled the catalog.

The missing `description` in `[agents.subagent]` was a separate schema/validation issue. Adding the required description removed the warning; it did not prove the configured custom model could execute delegated work.

### Investigation timeline

1. Codex migration exposed the unsupported legacy profile error.
2. Removing the legacy default profile declaration allowed Codex to launch; Ollama-only models remained visible.
3. Removing the global model and provider overrides did not change the selector.
4. Removing the `model_catalog_json` override also did not change the selector.
5. Inspection of `models_cache.json` found cached entries `gpt-5.5`, `gpt-5.4-mini`, and `codex-auto-review`, and recorded Codex client version `0.140.0`. This is a cache observation, not proof of live model availability or the desktop app's version.
6. The `OPENAI_API_BASE` environment variable was found set at user and process scope, but not machine scope. Its value pointed to OmniRoute at `localhost:20128`; it was preserved to avoid unintentionally breaking the existing integration.
7. Ollama restoration files and a 2026-05-23 backup were found. The first restore attempt returned `ChatGPT did not quit. Close it manually, then try again.` because ChatGPT Classic was still running.
8. After ChatGPT Classic and Codex were closed, `ollama launch codex-app --restore` completed successfully. Native OpenAI models then appeared in Codex and ChatGPT Work.
9. The missing subagent description was added, and the malformed-agent warning disappeared.

The configuration also contained `[profiles.ollama-launch-codex-app]`, `[model_providers.ollama-launch-codex-app]`, `[model_providers.9router]`, and `[agents.subagent]`. The original default values were `model = "gpt-5.5"`, `model_provider = "9router"`, and `model_reasoning_effort = "xhigh"`.

## 5. What Did Not Work

- **Removing the legacy default profile declaration:** fixed the load error and allowed Codex to launch, but the Ollama-only model selector remained.
- **Removing global model and provider overrides:** changed the configuration, but the model selector remained Ollama-only.
- **Removing `model_catalog_json`:** changed the configuration, but did not restore native models.
- **Treating the cache as the active catalog:** `models_cache.json` contained OpenAI model identifiers, but this alone did not make them appear in the selector and did not establish live provider access.
- **First restore attempt with ChatGPT Classic still running:** failed with `ChatGPT did not quit. Close it manually, then try again.` The process had to be closed before retrying.

### Environment-variable handling

`OPENAI_API_BASE` was set in user and process scope and was not set in machine scope. It pointed to OmniRoute on `localhost:20128`. It was deliberately preserved: removing it could disrupt an existing local integration, and the model-selector issue was ultimately resolved by Ollama restoration. Its presence does not prove requests were routed through OmniRoute.

The credential-related variable names `OPENAI_API_KEY`, `OLLAMA_API_KEY`, and `OLLAMA_CLOUD_API_KEY`, and the Ollama-related `OLLAMA_ORIGINS` setting, are relevant to a complete configuration review. Their values were not recorded in this runbook. Whether each was set, whether any credential was valid, and what origins were allowed were not established here. Never print or paste their values into issue reports or runbooks.

## 6. Final Fix

The successful restore sequence was:

1. Close ChatGPT Classic and Codex completely, including any remaining background app process.
2. Run `ollama launch codex-app --restore`.
3. Launch Codex normally from Windows and inspect its model selector. Do not use the non-restore Ollama launch command unless intentionally switching Codex to Ollama.

The observed result was native OpenAI models in both Codex and ChatGPT Work. Existing OmniRoute, 9Router, and Ollama services were not intentionally removed.

The subagent definition originally contained:

```toml
[agents.subagent]
model = "openai/gpt-5.4"
```

The required description was added:

```toml
[agents.subagent]
model = "openai/gpt-5.4"
description = "General-purpose coding assistant for delegated tasks"
```

The warning disappeared. Successful subagent execution remains unverified.

## 7. Commands

This is the restoration command that succeeded. Close ChatGPT Classic and Codex completely before running it:

```powershell
ollama launch codex-app --restore
```

For normal use after restoration, launch Codex from Windows (for example, its normal Start menu shortcut). Do not run the following unless an intentional switch to Ollama is desired:

```powershell
ollama launch codex-app
```

The command without `--restore` was not the recovery procedure and can reapply the Ollama integration.

## 8. Verification

The following outcomes were observed after restoration and the subagent description edit:

- Codex launched successfully.
- Native OpenAI models appeared in the Codex model selector.
- Native OpenAI models appeared in the ChatGPT Work model selector.
- ChatGPT Work displayed no configuration warnings.
- The malformed subagent warning no longer appeared in Codex.

To verify after a future restore, launch each application normally and inspect its model selector for native OpenAI entries. Check the Codex logs for the malformed-agent warning if subagent configuration was changed. A visible model name is not proof that inference works, that a particular endpoint handled a request, or that MCP and subagent functions are operational.

## 9. Final Working State

**Confirmed after remediation:** Codex launched; both applications displayed native OpenAI models; the ChatGPT Work configuration warning and Codex malformed-subagent warning were absent; Ollama restoration succeeded; and the existing AI services were not intentionally removed.

**Not independently verified:** health of all three local services, MCP server functionality, custom subagent execution, actual request routing, and the security posture of existing custom integrations. Do not treat these as passed checks.

## 10. Optional Cleanup

### Backups and rollback considerations

The incident recovery snapshot is under `$env:USERPROFILE\Codex-Recovery-20261021-060216`. The latest Codex configuration backup is `$env:USERPROFILE\.codex\config.toml.backup-20261021-063035`. Ollama's restoration record and backup directory are under `$env:USERPROFILE\.ollama\launch` and `$env:USERPROFILE\.ollama\backup\codex-app`.

These backups preserve recovery options; they are not instructions to restore the old state. Keep them private and outside source control: a full snapshot can contain configuration, endpoint details, credentials, tokens, session data, or other personal information. Before any manual rollback, preserve the currently working configuration, review a backup locally for obsolete profile/provider/catalog settings, and restore only the necessary data. Blindly restoring the old configuration can reintroduce the unsupported legacy profile or the Ollama-only model selection. No backup was automatically restored or deleted during this incident.

### Security audit scope and findings

This runbook is a documentation-only record based on the supplied incident facts. The local `.codex` configuration, Ollama restoration files, caches, environment-variable values, and recovery snapshot were not opened, copied, or uploaded. Consequently, this is **not** a completed security audit of those files.

- No API credential or token value is included here. Credential presence, storage, validity, and permissions were not established.
- The reported `OPENAI_API_BASE` target was a localhost OmniRoute endpoint. The configured 9Router and Ollama endpoints were also reported as local addresses. No independent listener/bind-address checks were performed, so public-interface exposure was not ruled out.
- Other remote endpoints and dangerous overrides in the live configuration were not independently inspected.
- The site build scanned 58 generated files and reported no known-format secrets or unredacted private paths. This checks rendered publishing output, not the complete repository, Git history, or local configuration.
- No repository-wide secrets-in-Git scan was executed. `gitleaks`, `trufflehog`, and `detect-secrets` were not installed in the available environment.
- Sensitive backups were not inspected or added to the repository. Do not place them in the repository or upload them to a scanner or third party.
- The repository's website content policy redacts Windows user-profile paths in rendered output. This runbook uses `$env:USERPROFILE` rather than publishing the local account name.

Windows-specific follow-up, if a full audit is later authorized, should review file ACLs and environment-variable scopes without displaying secret values; check whether local services listen only on loopback; and verify that backup and session data remain accessible only to the intended Windows account. No firewall, Defender, authentication, or system security settings were changed.

## 11. If This Happens Again

1. Preserve the current working configuration and keep backups private.
2. If Codex reports that the legacy `ollama-launch-codex-app` profile is unsupported, do not restore an old configuration wholesale. Remove or migrate the obsolete profile selection using the currently supported configuration format.
3. If the model selector remains Ollama-only after normal configuration cleanup, close ChatGPT Classic and Codex completely, then use the supported restore command:

   ```powershell
   ollama launch codex-app --restore
   ```

4. Launch Codex normally from Windows and check the model selector in both Codex and ChatGPT Work.
5. Keep `OPENAI_API_BASE` and existing provider integrations unchanged unless their routing purpose is understood and a deliberate migration is planned.
6. If the subagent warning returns, verify `[agents.subagent]` has a `description`; test actual delegated execution separately before declaring the custom model functional.
7. Treat selector visibility, service health, request routing, MCP, and subagent execution as separate verification tasks.

**Lessons learned:** desktop startup compatibility, provider routing, model catalog presentation, and Ollama's managed app integration are related but distinct layers. Removing one visible override may not reset state maintained by another integration. Restore only after the target applications have exited, and verify the GUI result without assuming internal implementation details.

**Credits:** Incident diagnosis and recovery were performed on the White Ghost Rig; this runbook records the supplied observations and verified outcomes.
