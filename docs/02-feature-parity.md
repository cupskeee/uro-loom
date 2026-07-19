# 02 — Feature parity with `uro-cli`

Loom's contract with itself: **anything the `uro` CLI can do, Loom can do.** This doc maps all
**26** CLI commands (verified against `packages/uro-cli/uro_cli/main.py` at the time of writing)
to a Loom surface, and — crucially — records whether an `uro-server` endpoint exists **today** or
must be **built**. That gap is the reason full parity is a two-repo effort.

## Backend reality check

`uro-server` today exposes a real but partial management surface. **Built endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/healthz` | liveness (open) |
| GET | `/worlds` · POST | list worlds · create world (JSON body only) |
| POST | `/worlds/{w}/campaigns` | create a campaign |
| GET | `/campaigns` · `/campaigns/{c}` | list · detail |
| POST | `/campaigns/{c}/join` | seat a participant on a PC |
| GET | `/campaigns/{c}/roster` | connected/seated participants |
| GET | `/campaigns/{c}/state` | materialized state (current branch, no `?at=`) |
| GET | `/campaigns/{c}/chronicle` | campaign-scoped Lore Wall |
| POST | `/campaigns/{c}/time-skip` | advance in-fiction time + agenda tick |
| POST | `/campaigns/{c}/tokens` · `/tokens/revoke` | mint · revoke a durable token |
| POST | `/campaigns/{c}/encounters/{e}/outcome` | Chronicler: ingest an external `OutcomeBundle` |
| WS | `/campaigns/{c}/play?token=` | GM-mode play channel |

**NOT built** (from `docs/08`'s deferred list + CLI-only commands): world validate/seed/backfill/
probe/export/import over HTTP, branch list/fork/mark, commit log, dry-run/preview, consistency,
campaign end, codex add/list, world-scoped `state?at=` / chronicle, `GET /usage`, and multipart
**pack-file upload** (`POST /worlds` is JSON-body only today).

## The 26-command matrix

Legend — **Backend**: 🟢 endpoint exists · 🟡 partial (exists but limited) · 🔴 needs a new
`uro-server` endpoint · ⚙️ server-ops, out of scope for Loom.

### `world` — worlds & packs

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro world new NAME` | **New World** form (blank world + default campaign + starter PC) | 🟡 `POST /worlds` (+ compose `POST /worlds/{w}/campaigns`; CLI's default-PC convenience replicated client-side) |
| `uro world validate PATH` | **Validate Pack** — upload/paste a pack, show sufficiency grade + gaps | 🔴 new `POST /worlds/validate` + multipart upload |
| `uro world create PATH [--backfill]` | **Import World from Pack** wizard (optional AI backfill) | 🟡 `POST /worlds` is JSON-only; 🔴 pack upload + `--backfill` (LLM) endpoints |
| `uro world seed PATH [--seed]` | **Seed History** — deterministic dynasties/wars | 🔴 `POST /worlds/{w}/seed` (deferred in docs/08) |
| `uro world backfill PATH` | **Backfill Gaps** preview (AI, provenance-tagged) | 🔴 new endpoint (LLM stage) |
| `uro world probe PATH [--tries]` | **Probe Capability** — model compatibility report | 🔴 `POST /worlds/{w}/probe` (deferred) |
| `uro world export WORLD -o FILE` | **Export Bundle** — download a hash-chained `.uwp` | 🔴 `GET /worlds/{w}/export` (deferred) |
| `uro world import PATH` | **Import Bundle** — upload + verify hash chain | 🔴 `POST /worlds/import` (deferred) |

### `branch` — timelines

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro log WORLD [--branch --limit]` | **Commit Log** (git-log style lineage + markers) | 🔴 new lineage endpoint |
| `uro branch list WORLD` | **Branches** panel (heads, depth, in-fiction day, fork origin) | 🔴 `GET /worlds/{w}/branches` (deferred) |
| `uro branch fork WORLD --at --name [--time-skip-days]` | **Fork** dialog from any commit/marker (+ time-skip) | 🔴 `POST /worlds/{w}/branches` (deferred) |
| `uro branch mark WORLD NAME [--branch]` | **Add Marker** at a commit | 🔴 new endpoint |

### `campaign` — play-through lifecycle

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro campaign new WORLD (--adopt\|--pc)` | **New Campaign** (adopt an actor or fresh PC) | 🟢 `POST /worlds/{w}/campaigns` |
| `uro campaign end CAMPAIGN --marker` | **End Campaign** (release PCs, mark fork root) | 🔴 new endpoint |
| `uro campaign join CAMPAIGN --participant` | **Join Campaign** (seat a 2nd+ player) | 🟢 `POST /campaigns/{c}/join` |

### `play` — GM-mode beats

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro play CAMPAIGN` | **Play** — the live session view (stream, scene, mode) | 🟢 WS `/campaigns/{c}/play` |
| `uro connect CAMPAIGN` | *this is what Loom natively **is*** (a WS play client) | 🟢 WS `/campaigns/{c}/play` |
| `uro dry-run CAMPAIGN INTENT` | **Preview Beat** — events a beat *would* commit, no write | 🔴 `POST /campaigns/{c}/beats?dry_run=true` (deferred; or a WS dry-run frame) |
| `uro consistency CAMPAIGN` | **Consistency** metric panel (thesis proxy T2) | 🔴 new endpoint (or fold into `GET /campaigns/{c}`) |

### `codex` — participant memory

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro codex add CAMPAIGN TEXT [--pinned --ref]` | **Add Codex Note** (fork-surviving player notes) | 🔴 new endpoint |
| `uro codex list CAMPAIGN` | **Codex** viewer | 🔴 new endpoint |

### `token` — auth

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro token mint CAMPAIGN --participant --token` | **Mint Token** (admin/self-scope) | 🟢 `POST /campaigns/{c}/tokens` |
| `uro token revoke CAMPAIGN --target` | **Revoke Token** | 🟢 `POST /campaigns/{c}/tokens/revoke` |

### `db` / top-level — ops

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro db migrate` | **Not in Loom.** Migrations are the server deployment's job; Loom owns no schema and must never run one | ⚙️ out of scope (read-only migration-status display is the most Loom should ever do) |
| `uro serve` | **Not in Loom.** This *runs* the server Loom connects to | ⚙️ out of scope (Loom is the client; it configures a server URL + token) |
| `uro version` | **About** panel (server + engine versions) | 🟡 use `/healthz` / a small `GET /version` |

## Tally

- **🟢 available today (11):** campaign new/join, token mint/revoke, play, connect, world
  list/create (partial), campaign list/detail, roster, state, chronicle, time-skip, chronicler
  outcome. → *these fund Loom's first three milestones without touching the engine.*
- **🔴 needs a new endpoint (13):** world validate/seed/backfill/probe/export/import, branch
  list/fork/mark, log, dry-run, consistency, campaign end, codex add/list. → *the co-evolution
  workstream in `uro-server` (see [`04-plan.md`](04-plan.md) §Backend co-evolution).*
- **⚙️ out of scope (2):** db migrate, serve.

> **Honest headline:** Loom can be genuinely useful (observe + play + core lifecycle) against
> **today's** `uro-server`. Full CLI parity additionally requires ~13 endpoints — mostly the
> already-designed-but-deferred `docs/08` surface — landed in the engine repo. The plan front-
> loads the 🟢 work so Loom ships value before the 🔴 endpoints exist.

## The WS play protocol (what Loom must speak)

**Client → server** (only these three are handled; anything else is silently ignored):
`{type:"intent", text}` · `{type:"table_talk", text}` (non-canon lane) · `{type:"vote", choice}`.

**Server → client** (fanned out to all campaign subscribers): `participant_joined` ·
`participant_left` · `beat_started {participant_id, intent}` · `narration_chunk {participant_id,
text}` (streamed) · `beat_committed {participant_id, intent, narration}` · `beat_failed` ·
`not_your_turn` · `proposal_opened` · `intent_rejected` · `table_talk` · `vote_tally` ·
`vote_decided` · `vote_unsupported` · `outcome_recorded`.

**Loom must honor two invariants:** (1) `table_talk`/`vote`/`proposal` are the **non-canon
coordination lane** — render them distinctly and never as canonical narration; (2) turn
arbitration is server-driven (round-robin/proposal/vote) — Loom reflects `not_your_turn` /
`proposal_opened` rather than deciding turns itself.

> ⚠️ **Known wire drift to design around:** `docs/08` advertises `campaign_id`/`beat_id` on every
> envelope and client `encounter_action`/`pin_actor` + server `scene_update`/`mechanics_result`/
> `mode_change`/`suggestions` frames that `app.py` does **not** emit today. Loom codes to the
> **actual** frames above; the richer set is a backend co-evolution item, not something to assume.
