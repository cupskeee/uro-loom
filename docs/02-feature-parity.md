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
| `uro world new NAME` | **New World** form (blank world + default campaign + starter PC) | 🟢 `POST /worlds` (**operator**, D-46) + compose `POST /worlds/{w}/campaigns`; CLI's default-PC convenience replicated client-side |
| `uro world validate PATH` | **Validate Pack** — upload/paste a pack, show sufficiency grade + gaps | 🟢 `POST /worlds/validate` (multipart, any-authed) (BE-6) |
| `uro world create PATH [--backfill]` | **Import World from Pack** wizard (optional AI backfill) | 🟡 pack-upload **create** still deferred (JSON-only `POST /worlds` today); backfill-COMMIT rides it (the `backfill` **preview** endpoint ships) |
| `uro world seed PATH [--seed]` | **Seed History** — deterministic dynasties/wars | 🔴 `POST /worlds/{w}/seed` (carved out — needs the pack manifest re-supplied; rides pack-upload create) |
| `uro world backfill PATH` | **Backfill Gaps** preview (AI, provenance-tagged) | 🟢 `POST /worlds/backfill` (multipart, **operator**, preview-only) (BE-7) |
| `uro world probe PATH [--tries]` | **Probe Capability** — model compatibility report | 🟢 `POST /worlds/probe[?tries=]` (multipart, **operator**, warn-not-fail) (BE-7) |
| `uro world export WORLD -o FILE` | **Export Bundle** — download a hash-chained `.uwp` | 🟢 `GET /worlds/{w}/export` (**operator**, D-45) (BE-8) |
| `uro world import PATH` | **Import Bundle** — upload + verify hash chain | 🟢 `POST /worlds/import` (**operator**; tampered → 400) (BE-8) |

### `branch` — timelines

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro log WORLD [--branch --limit]` | **Commit Log** (git-log style lineage + markers) | 🟢 `GET /worlds/{w}/log` (any-authed) (BE-3) |
| `uro branch list WORLD` | **Branches** panel (heads, depth, in-fiction day, fork origin) | 🟢 `GET /worlds/{w}/branches` (any-authed) (BE-1) |
| `uro branch fork WORLD --at --name [--time-skip-days]` | **Fork** dialog from any commit/marker (+ time-skip) | 🟢 `POST /worlds/{w}/branches` (**operator**, D-44) (BE-2) |
| `uro branch mark WORLD NAME [--branch]` | **Add Marker** at a commit | 🟢 `POST /worlds/{w}/markers` (**operator**, D-44) (BE-3) |

### `campaign` — play-through lifecycle

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro campaign new WORLD (--adopt\|--pc)` | **New Campaign** (adopt an actor or fresh PC) | 🟢 `POST /worlds/{w}/campaigns` |
| `uro campaign end CAMPAIGN --marker` | **End Campaign** (release PCs, mark fork root) | 🟢 `POST /campaigns/{c}/end` (**operator**, D-44) (BE-9) |
| `uro campaign join CAMPAIGN --participant` | **Join Campaign** (seat a 2nd+ player) | 🟢 `POST /campaigns/{c}/join` |

### `play` — GM-mode beats

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro play CAMPAIGN` | **Play** — the live session view (stream, scene, mode) | 🟢 WS `/campaigns/{c}/play` |
| `uro connect CAMPAIGN` | *this is what Loom natively **is*** (a WS play client) | 🟢 WS `/campaigns/{c}/play` |
| `uro dry-run CAMPAIGN INTENT` | **Preview Beat** — events a beat *would* commit, no write | 🟢 `POST /campaigns/{c}/dry-run` (any-authed, intent-only D-37; minted-token campaign-scoped D-46) (BE-5) |
| `uro consistency CAMPAIGN` | **Consistency** metric panel (thesis proxy T2) | 🟢 `GET /campaigns/{c}/consistency` (any-authed) (BE-5) |

### `codex` — participant memory

| CLI command | Loom surface | Backend |
|-------------|--------------|---------|
| `uro codex add CAMPAIGN TEXT [--pinned --ref]` | **Add Codex Note** (fork-surviving player notes) | 🟢 `POST /campaigns/{c}/codex` (self-or-admin, D-39) (BE-9) |
| `uro codex list CAMPAIGN` | **Codex** viewer | 🟢 `GET /campaigns/{c}/codex[?participant=]` (self-or-admin) (BE-9) |

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

**Update (BE-1…BE-11 epic + D-46 MERGED in `uro`):** the co-evolution workstream is done — all but
two of the previously-🔴 surfaces now ship, so almost the whole CLI surface has an HTTP endpoint.

- **🟢 available today (~24):** the original 11 (campaign new/join, token mint/revoke, play, connect,
  world list, campaign list/detail, roster, state, chronicle, time-skip, chronicler outcome) **plus
  the whole BE epic** — validate, backfill, probe, export, import, branch list, fork, marker, log,
  events + commit inspector (BE-4), dry-run, consistency, campaign end, codex add/list, usage
  telemetry, ruleset registry, world-scoped chronicle.
- **🔴 still needs an endpoint (2):** world **seed** and pack-upload **create** (with which
  backfill-COMMIT ships) — both carved out because they need the pack manifest re-supplied, tracked
  as named follow-ups. World `state?at=` (materialize-at-commit) is a third deferred slice.
- **⚙️ out of scope (2):** db migrate, serve.

**Authority (D-44/D-45/D-46) — the console must respect two tiers.** *Operator* (`--admin-token`):
create world, fork, marker, import, export, end, backfill, probe, usage, time-skip, and the raw
event log / commit detail. *Any authed player*: the reads + campaign-lifecycle self-scope. And the
epistemic boundary (D-45/D-46): `GET /campaigns/{c}/state` gives a **player** only the scene-safe
sections `{actors,threads,places,factions,pcs}` — `claims`/`beliefs`/`sheets`/`items`/`edges`/
`counters` require an operator token (403 otherwise). So the timeline/epistemics/authoring surfaces
are an **operator console**; a player build sees the play + scene-safe reads only.

> **Honest headline:** Loom can now reach almost the entire `uro-server` surface. The remaining gap
> is two carve-outs (seed, pack-upload create) — the frontend work is no longer backend-blocked; it
> is wiring M4–M6 to the shipped endpoints, respecting the operator/player tiers above.

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

> ✅ **Wire drift RESOLVED (BE-11, uro#43).** `docs/08` now documents the WS contract frame-for-frame
> with `app.py` — the frames above ARE the contract. The previously-advertised `campaign_id`/`beat_id`
> envelope and `scene_update`/`mode_change`/`mechanics_result`/`suggestions`/`encounter_action`/
> `pin_actor` frames were a doc overclaim and have been removed. `scene`/`mode` display remains a
> deliberate **future GROW** on the backend (not drift): encounters auto-resolve inside one beat, so
> there is no persistent mode state to emit without new engine work — Loom's Play panel says so rather
> than assuming those frames.
