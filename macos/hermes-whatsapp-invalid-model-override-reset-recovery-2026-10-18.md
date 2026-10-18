# Hermes WhatsApp invalid model override recovery with `/reset`

**Date:** 2026-10-18
**Status:** Fixed / Verified
**Platform:** macOS

---

## 1. Summary

Sending `/new` in an affected Hermes WhatsApp conversation was interpreted by the installed Hermes Agent runtime as a model identifier rather than as the intended new-session action. The persisted session then rehydrated with `model=/new` and `provider=local-20138`, causing repeated HTTP 400 `Invalid model format` failures. Desktop and Terminal model changes, read-only SQLite/JSON investigation, and repair attempts did not resolve the affected conversation. The user ultimately sent `/reset` directly in the same WhatsApp conversation and confirmed recovery. The supported recovery command should therefore be tried before database inspection or repair.

> **Quick fix:** Send `/reset` in the affected WhatsApp chat, then send a normal message. Escalate to gateway and session-state diagnostics only if that does not recover the conversation.

---

## 2. Environment

- Operating system: macOS on Apple Silicon
- Hermes Agent: `v0.22.2+1513.gedab579`; local source commit recorded as `edab579989a1`
- Interfaces: Hermes macOS Desktop app, Hermes CLI/TUI, macOS Terminal, WhatsApp messaging interface
- Gateway: WhatsApp messaging gateway installed as launchd service `ai.hermes.gateway`
- Session storage: SQLite `~/.hermes/state.db`
- Legacy routing mirror: `~/.hermes/sessions/sessions.json`
- Local routing endpoint observed in logs: `local-20138` at `127.0.0.1:20128`
- Initial default profile reported during the investigation: `beam-free`
- Additional profile: `openclaw---ha`, using `longcat-2.5-preview-free`
- Relevant local evidence: gateway/agent/Desktop logs and read-only diagnostic artifacts under `~/.hermes/cache/scratch/` and `~/.hermes/backups/`

No phone number, WhatsApp JID, personal message, credential, or database dump is included here.

---

## 3. Architecture and components

The affected path crossed several layers:

1. WhatsApp delivered the command and later normal messages.
2. The Hermes WhatsApp gateway mapped the chat to a persistent session.
3. Hermes rehydrated the session's persisted model/provider override.
4. The local provider endpoint (`local-20138`) forwarded requests to the local routing service.
5. Session metadata was represented in the authoritative SQLite state store and, for legacy tooling, in `sessions.json`.
6. The Desktop app and TUI issued model/session mutations through the gateway runtime-coordination layer.

The distinction between the live gateway, the Desktop/TUI control plane, and the legacy JSON mirror mattered: changing a visible model selection did not prove that the already-routed WhatsApp session had been rebuilt.

---

## 4. Symptoms

After the WhatsApp `/new` message, subsequent messages repeatedly failed. Gateway logs recorded the affected session being rehydrated with the invalid override:

```text
Rehydrated persisted /model override for session=... model=/new provider=local-20138
```

The same session then produced repeated non-retryable failures:

```text
HTTP 400: Invalid model format
provider=local-20138 model=/new
```

The Hermes Desktop log also recorded model-switch failures:

```text
Model switch failed: JsonRpcGatewayError: runtime_coordination_required
```

These symptoms were separate from provider availability failures encountered while troubleshooting, including Nous HTTP 429 responses and OmniRoute HTTP 504/request-stall failures.

---

## 5. Root Cause

### Verified cause

The affected WhatsApp session retained `/new` as a persisted model override. Hermes subsequently passed that value to the local OpenAI-compatible endpoint as the model identifier, which rejected it as an invalid model format.

### Command semantics relevant to this incident

The installed source and state layer distinguish the operations as follows:

- `/reset` is an explicit session-boundary operation. The state mutation implementation creates a child session, ends the previous session with `end_reason='session_reset'`, advances the conversation generation, and carries forward the session policy. This is the recovery operation confirmed by the user in WhatsApp.
- `/model` changes a session's model selection. In this incident, Desktop attempts to apply a model change returned `runtime_coordination_required`; a visible picker change was therefore not proof that the affected WhatsApp session had been rebuilt.
- `/new` was intended by the operator as a new-session command, but in this installed runtime the affected WhatsApp path persisted it as `/model` override data. The logs prove that result; this runbook does not generalize undocumented `/new` behavior beyond this installed version.

Resetting a session creates a new conversation boundary. Do not promise preservation of the old conversational context; retain the old session only through Hermes' normal session history/recovery mechanisms if it remains available.

### Plausible but not proven

The investigation found evidence of authoritative SQLite routing data and a legacy JSON mirror that did not always present the same view at the same time. This likely contributed to the difficulty of interpreting model changes and repair results, but it was not necessary to establish the user-facing failure or to apply the final fix.

---

## 6. Diagnostic evidence

The following observations were verified from local evidence without placing identifiers or message content in this runbook:

- `agent.log` recorded the persisted `/model` override as `model=/new`, `provider=local-20138` during WhatsApp session rehydration.
- `errors.log.1` recorded repeated HTTP 400 `Invalid model format` failures for `model=/new`.
- `desktop.log` recorded two `runtime_coordination_required` model-switch failures.
- The source tree contains the reset mutation implementation and the SQLite `gateway_routing` table path used for routing metadata.
- A read-only repair attempt reported `whatsapp_dm_keys_count: 0` and exited with code 2 because it could not identify exactly one affected JSON routing key. It did not establish a successful repair.
- The repair wrapper stopped and later started the gateway, but that operation did not resolve the WhatsApp session and is not the final fix.
- Logs recorded provider/model failures during the extended investigation: Nous `stepfun/step-3.7-flash:free` HTTP 429 rate limits, OmniRoute `openrouter/openrouter/free` HTTP 504 execution-expiration failures, and OmniRoute `openrouter/xingchen-agi/xing4.0-29b-a4b:free` HTTP 504 failures.
- The user confirmed that sending `/reset` in the affected WhatsApp conversation restored normal operation.

### Evidence classification

| Claim | Classification |
| --- | --- |
| `/new` became the persisted model value `/new` | Verified by gateway logs |
| Repeated requests failed with HTTP 400 invalid model format | Verified by gateway/error logs |
| Desktop model switching returned `runtime_coordination_required` | Verified by Desktop log |
| SQLite was the authoritative routing store and JSON was a legacy mirror | Supported by source inspection and diagnostics; exact historical divergence is not fully reconstructed |
| A repair script cleared the override | Not verified; the recorded script exited without identifying the target |
| `/reset` restored the conversation | User-confirmed and treated as the final working fix |

---

## 7. Troubleshooting timeline

Exact timestamps are included only where they were present in local logs; some steps are ordered from transcripts and artifacts rather than assigned invented times.

1. The operator sent `/new` in WhatsApp intending to begin a new session.
2. Hermes treated `/new` as a model value for the affected session. Subsequent messages were routed with `model=/new` through `local-20138` and failed repeatedly.
3. Model changes were attempted through the Hermes Desktop GUI and Terminal/TUI. The affected WhatsApp session did not immediately recover.
4. Desktop model-switch requests returned `runtime_coordination_required`.
5. Gateway and profile diagnostics were collected. The default profile was reported as `beam-free`; the additional `openclaw---ha` profile used `longcat-2.5-preview-free`.
6. Source inspection located `SessionStore` behavior and the API used to clear or mutate session overrides.
7. Further inspection identified SQLite state in `~/.hermes/state.db` and a legacy routing mirror at `~/.hermes/sessions/sessions.json`. Their relationship required caution; a JSON read was not treated as proof of current authoritative state.
8. Repeated read-only diagnostics inspected routing/session metadata, logs, process state, and relevant source paths.
9. The repair work was delegated to Hermes CLI/TUI sessions for additional source inspection and attempted self-repair.
10. Some delegated sessions experienced context-compaction failures, interrupted turns, or model/provider failures. These interruptions made the investigation longer; they did not fix the WhatsApp session.
11. A gateway restart/repair attempt drained or interrupted active work. Logs recorded a gateway shutdown and interruption of remaining work.
12. A read-only repair script and wrapper were attempted. The script found zero matching WhatsApp DM keys in the JSON view and exited with code 2; no successful database repair was established.
13. Models and providers were switched while trying to keep the investigation moving: `beam-free`, `stepfun/step-3.7-flash:free`, `openrouter-free`, and other routed selections appear in the evidence. Some were unavailable, rate-limited, stalled, or timed out.
14. OmniRoute returned HTTP 504 execution-expiration/request-stall errors for `openrouter/openrouter/free` and `openrouter/xingchen-agi/xing4.0-29b-a4b:free`.
15. The operator discovered and sent `/reset` directly in the affected WhatsApp conversation.
16. The user confirmed recovery. No database surgery, reinstall, model switch, or repair script is credited as the fix.

---

## 8. AI model and provider transitions

The following references are documented only to distinguish observed selections and failures:

| Selection | Provider/interface | Evidence and outcome |
| --- | --- | --- |
| `beam-free` | Hermes profile/default selection | Reported as the initial default profile; successful completion of the affected recovery is not attributed to it |
| `longcat-2.5-preview-free` | `openclaw---ha` profile | Profile configuration reference; no claim that it fixed the affected session |
| `stepfun/step-3.7-flash:free` | Nous Research / Nous Portal | Logs show HTTP 429 rate limiting and temporary capacity errors |
| `openrouter-free` | OmniRoute/custom local route | Logs show request stalls and related model/provider failures during troubleshooting |
| `openrouter/xingchen-agi/xing4.0-29b-a4b:free` | OmniRoute | Logs show HTTP 504 execution-expiration failures |
| `/new` | local-20138 | Invalid persisted override; repeated HTTP 400 failures |

### Subsequent documentation workflow (not the WhatsApp repair)

The later October 18 runbook-creation workflow is separate from the October 17–18 WhatsApp recovery attempts. Its local Hermes Desktop evidence records:

- **OpenCode Zen failure:** model `mimo-v2.6-flash-free`, provider `opencode-zen`, HTTP 403. The reported reason was: `OpenCode's free tier can only be used from within OpenCode.` The requested documentation turn was not processed on that attempt.
- **Hermes documentation-session model metadata:** `gpt-5.6-luna`. This identifies the model metadata for the later Hermes Desktop documentation session, not the model that fixed WhatsApp. The execution log separately records the runtime label `gpt-5.6-luna-900k` and `provider=openai-codex`; neither detail is inferred from the visible model-picker label. No provider is assigned to the base `gpt-5.6-luna` metadata beyond that explicit runtime log evidence.

These documentation-session model records do not show participation in repairing the WhatsApp session. The `/reset` action remains the only user-confirmed WhatsApp fix.

Exact identities of other ChatGPT and Hermes subagent models used during the original investigation were not consistently recoverable and are intentionally not inferred.

---

## 9. What Did Not Work

Do not treat these as recovery procedures:

- Changing the model in Desktop or Terminal while the affected session remained stuck on its persisted override.
- Sending `/model` during the incident; the control path returned `runtime_coordination_required`.
- Repeatedly inspecting or editing routing representations without first trying the built-in session reset.
- Assuming `sessions.json` alone represented the authoritative current state.
- The attempted repair script: it exited with code 2 after finding no matching WhatsApp DM key and did not prove a repair.
- Restarting the gateway as a substitute for resetting the session.
- Switching providers/models to work around rate limits and 504s; those changes addressed availability symptoms, not the invalid session override.
- Delegating the repair to additional AI sessions when context compaction, interruption, and provider failures were already affecting the investigation.
- Database surgery, reinstalling Hermes, or modifying live session storage. None is credited with resolving this incident.

ChatGPT's initial diagnosis and source-inspection guidance were useful for locating the persisted override, but ChatGPT overcomplicated the recovery and failed to recommend `/reset` early.

---

## 10. Final working fix

In the affected WhatsApp conversation:

1. Send `/reset`.
2. Send a normal, harmless message.
3. Confirm that Hermes replies and that the reply is no longer rejected with `Invalid model format`.

This is the only fix confirmed by the operator. It invokes Hermes' session-boundary handling through the same interface that owns the broken conversation, avoiding assumptions about which routing representation is authoritative.

---

## 11. Commands

Use commands only after the WhatsApp recovery-first step fails. These examples are read-only and intentionally omit identifiers and credential values.

```bash
# Inspect the installed Hermes version without changing the live system
hermes --version

# Inspect service state; do not restart it merely because a session is stuck
hermes gateway status

# Search local logs for the failure signature, without publishing the output
rg -n --glob '*.log*' 'model=/new|Invalid model format|runtime_coordination_required' ~/.hermes/logs

# Inspect repository/source documentation for the installed reset implementation
rg -n 'reset_in_transaction|session_reset|gateway_routing' ~/.hermes/hermes-agent
```

Do not run old repair scripts from `~/.hermes/cache/scratch/` or alter `~/.hermes/state.db` without a separate, evidence-based recovery plan and a current backup.

---

## 12. Verification

The final verification was conversational and user-confirmed:

- `/reset` was sent in the affected WhatsApp chat.
- A subsequent normal message received a successful Hermes response.
- The previous repeated `model=/new` failure no longer blocked the conversation.

The runbook itself was validated by checking its Markdown structure, links, whitespace, staged diff, and repository security scan before publication.

---

## 13. Rollback and recovery considerations

- `/reset` creates a new session boundary and may change conversational continuity. Preserve any needed context before using it when possible.
- Do not delete `~/.hermes/backups/`; the incident artifacts may be useful for later forensic review.
- Do not restore SQLite or JSON state from a backup simply because the two views differ. First establish which store the installed gateway treats as authoritative and whether a live writer is active.
- Do not restart `ai.hermes.gateway` during an active turn unless the service is independently known to be unhealthy; the drain can interrupt in-flight work and delegated repair sessions.
- If `/reset` fails, stop before destructive repair and capture a new read-only evidence set.

---

## 14. Security audit and checks

The documentation review checked the new runbook and staged diff for:

- API keys, OAuth tokens, passwords, cookies, and private credential values
- WhatsApp phone numbers, JIDs, and personal message text
- Unnecessary session identifiers and database dumps
- Private environment-variable values
- Accidental inclusion of repair scripts or backups
- Unrelated configuration, permission, or credential changes

The security checks in this correction are limited to the documentation change: review of the target Markdown, the staged diff, relative links, whitespace, and targeted credential-pattern checks. Existing repository validation was also run separately.

These checks are **not** a comprehensive security audit of the live Hermes installation. No full live-system security audit or credential audit was performed or established by this documentation task. The live Hermes installation, gateway, WhatsApp session, configuration, and state database were not modified.

---

## 15. Lessons learned

- Try the supported recovery command in the affected interface before inspecting a database; `/reset` solved this incident.
- Treat a command that begins with `/` as potentially version- and transport-sensitive; verify how the installed WhatsApp path interpreted it before relying on its intended meaning.
- A successful model-picker interaction does not prove that an already-running WhatsApp session was rebuilt.
- Distinguish authoritative SQLite state from legacy JSON mirrors before drawing conclusions from either one.
- Separate transport/session corruption from provider availability. HTTP 429/504 failures and context-compression stalls were concurrent troubleshooting noise, not proof that the WhatsApp override had been repaired.
- Record failed AI-agent attempts as failed or inconclusive. Do not credit a repair script unless its target, mutation, and post-fix verification are all evidenced.
- Avoid escalating operator time and risk when a built-in recovery mechanism is available.

---

## 16. Known limitations

- The complete WhatsApp command-dispatch path for this exact Hermes build was not reconstructed from a single authoritative transcript; the `/new` interpretation is established from persisted state and logs.
- The historical SQLite-versus-JSON divergence was observed during investigation but is not fully reproduced here.
- Some delegated CLI/TUI and Desktop model identities are unavailable or ambiguous; this runbook does not invent them.
- `/reset` behavior can affect context continuity; operators should treat it as a new session boundary rather than a promise of a seamless continuation.

---

## 17. Final working state

- WhatsApp conversation: recovered after `/reset` and a normal-message verification.
- Invalid `/new` model override: no longer blocking the affected conversation, based on the user's confirmation.
- Hermes installation and live session storage: not modified as part of this documentation task.
- Investigation artifacts: retained under the user's Hermes cache/backups for optional later cleanup.

---

## 18. Optional cleanup

Only with explicit approval:

- Review and archive the scratch repair logs and failed repair artifacts.
- Review the two timestamped backup directories under `~/.hermes/backups/`.
- Remove obsolete repair scripts only after confirming that no later investigation depends on them.

Do not delete backups or temporary artifacts automatically.

---

## 19. If This Happens Again

Use this recovery-first sequence:

1. In the affected WhatsApp chat, send `/reset`.
2. Send a normal message and confirm a response.
3. If it fails, collect read-only gateway/Desktop logs and check `hermes gateway status`.
4. Check whether the logs show a persisted invalid model override.
5. Only then inspect SQLite and the JSON mirror, with a backup and live-writer coordination.
6. Do not run an old repair script or restart the gateway as a first response.

The shortest reliable procedure is therefore:

```text
WhatsApp: /reset
WhatsApp: send a normal test message
Only if still broken: read-only diagnostics, then carefully planned repair
```

---

## 20. Credits / AI assistance / tooling

- **ChatGPT (OpenAI):** Initial diagnosis, gateway-log interpretation, source-inspection commands, proposed repair plans, and troubleshooting guidance. ChatGPT also contributed unnecessary complexity and did not recommend `/reset` early; that failure is part of the incident lesson.
- **Hermes Agent (Nous Research):** Hermes Desktop application, CLI/TUI investigations, source inspection, attempted self-repair, command execution, gateway diagnostics, and the runtime that exposed the relevant state and failure logs.
- **User/operator:** Executed diagnostics, supervised the attempts, applied or identified the working `/reset` action, and confirmed recovery.
- **Other AI agents/tools:** No separate external coding agent is credited. Suggestions made during troubleshooting are not treated as evidence of execution.

Interfaces and components are kept distinct:

- **WhatsApp:** delivered `/new`, `/reset`, and the verification message.
- **Hermes Desktop GUI:** attempted model changes and recorded `runtime_coordination_required`.
- **Hermes CLI/TUI:** performed diagnostics, source inspection, and attempted repair orchestration.
- **macOS Terminal/shell:** hosted read-only inspection and repair-wrapper attempts.
- **macOS launchd:** owned `ai.hermes.gateway`; a restart/drain interruption was observed during troubleshooting.
- **Python and SQLite:** used for source-level/state-level inspection and attempted read-only repair logic; no successful database mutation is credited.
- **HQ viewer:** not credited as a causal or repair tool because its role is not supported by the retained evidence.
- **OmniRoute:** local routing service observed through provider/model selection and 504 timeout errors.

The documented model/provider transitions are limited to the selections and failures evidenced above. No model is claimed to have successfully completed the recovery; `/reset` in WhatsApp is the confirmed fix.
