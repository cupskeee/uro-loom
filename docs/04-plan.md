# 04 — Implementation plan

Sequenced so Loom delivers real value against **today's** `uro-server` before depending on any
new backend, then co-evolves the deferred endpoints with the engine repo. Milestones are
stack-agnostic until M0 lands the stack decision ([`decisions.md`](decisions.md) → LD-2).

Guiding order: **stand up → observe → play → operate-what-exists → grow-the-backend →
identity/ops.** The 🟢/🔴 tags trace to [`02-feature-parity.md`](02-feature-parity.md).

---

## M0 — Foundations

Goal: a running SPA skeleton that authenticates to a `uro serve` and reads `/healthz`.

- Confirm the stack (LD-2) and scaffold the app (Vite + TS or chosen equivalent).
- **Typed API client** in `src/api/` — generated from the server OpenAPI schema if available,
  else hand-written; pin the target API version.
- **Connection + auth config**: server URL + bearer token, stored safely; a "Server Connection"
  screen; graceful 401/404/501 handling (the server returns **501** for endpoints whose dep is
  unwired — Loom must render "not supported by this server" cleanly).
- CI (lint + typecheck + unit + a Playwright smoke test against a **stub server** so Loom is
  developable without a live Uro).
- A dev `docker-compose.yml` that runs a stub/echo server; docs to point at a real `uro serve`.

**Exit:** `pnpm dev`, enter a server URL + token, see green health + engine/API version.

## M1 — Observe (read-only, ships against today's server) 🟢

Goal: a genuinely useful read-only console with **zero engine changes**.

- **World Browser** (`GET /worlds`) and **Campaign list/detail** (`GET /campaigns`, `/{c}`).
- **Roster** (`GET …/roster`), **State** (`GET …/state`), **Chronicle** (`GET …/chronicle`).
- From `state`, render first-cut **Actors**, **Places**, **Threads** panels.
- Global **branch/campaign context** chrome.

**Exit:** point Loom at a seeded world and browse its campaigns, roster, current state, and lore
wall — no CLI needed.

## M2 — Play (GM mode, the flagship) 🟢

Goal: drive live beats in the browser — parity with `uro connect`, richer than the terminal.

- **WS play client** for `/campaigns/{c}/play`: send `intent`; render streamed `narration_chunk`
  → `beat_committed`; handle `beat_failed`, reconnect, and version/`4401`/`4403` closes.
- **Multiplayer**: roster join/leave, the **non-canon** `table_talk` lane, `vote` frames + tally,
  `not_your_turn` / `proposal_opened` reflected honestly (server-driven arbitration).
- Current **scene + mode** display; the intent box; a running transcript.

**Exit:** two browser tabs on one campaign both see the same streamed beats; table-talk and votes
render distinctly from canon.

## M3 — Operate what exists 🟢

Goal: the lifecycle writes that already have endpoints.

- **New Campaign** (`POST /worlds/{w}/campaigns`, adopt/fresh PC) · **Join** (`…/join`).
- **New World** (`POST /worlds`, JSON body) + compose a default campaign.
- **Token** mint/revoke (`…/tokens`, `…/tokens/revoke`) with self/admin scope.
- **Time-Skip** (`…/time-skip`) · **Chronicler Outcome Submitter** (`…/encounters/{e}/outcome`).

**Exit:** an operator can create a world+campaign, seat players with tokens, run a session, skip
time, and submit an external outcome — entirely in Loom.

> **After M3, Loom is independently valuable.** Everything past here needs the engine to grow
> endpoints; those milestones interleave with the backend co-evolution workstream below.

## M4 — Timelines & epistemics (needs backend) 🔴

Goal: the signature branching + "who knows what" views. Paired with backend items **BE-1…BE-5**.

- **Timeline / Branch Graph** (commit DAG) · **Branch list** · **Fork** (from commit/marker,
  time-skip) · **Add Marker** · **Commit Log**.
- **Event-Log Inspector** + **Commit/Beat Detail**.
- **Epistemic Explorer** (claims + belief fan-out) · **Faction/Relationship graph** ·
  **Counters dashboard** · **Memory/Recall inspector**.
- **Preview Beat (dry-run)** · **Consistency** panel.

**Exit:** fork a timeline in the UI, watch the DAG branch, and inspect the epistemic delta
between two forks.

## M5 — World authoring & lifecycle (needs backend + LLM) 🔴

Goal: the pack pipeline in the browser. Backend items **BE-6…BE-9**.

- **Validate / Import (with pack upload) / Backfill / Probe / Seed** wizards (multipart upload +
  LLM-stage endpoints; stream progress).
- **Export / Import bundle** with hash-chain verification surfaced (tamper → clear error).
- **Campaign End** (marker + PC release).
- **Codex** add/list (participant memory).

**Exit:** author a thin pack → validate → backfill → seed → play, without a terminal.

## M6 — Identity & ops (Loom-owned) — optional / multi-tenant

Goal: what the engine deliberately refuses to own.

- **Own identity layer** (accounts/login/orgs) behind a **BFF** that holds Uro tokens and proxies
  calls; the browser never sees an admin token. Finer per-actor authorization enforced at the BFF
  (Uro authority is coarse).
- **Usage & telemetry** dashboards + any **billing/quota** UX, fed by `GET /usage` (BE-10).
- Any **content guardrails/moderation** Loom needs, at Loom's layer.
- **Ruleset viewer** + **reaction-layer/rule-pack viewer**.

**Exit:** a multi-user deploy where real accounts map to Uro tokens, with usage visibility.

---

## Backend co-evolution (companion workstream in `uro`)

Full CLI parity requires these endpoints in `uro-server` — mostly the **already-designed but
deferred `docs/08` surface**. Track them as issues in the engine repo; Loom milestones depend on
them as noted. **This is engine work, done in the engine repo via its branch→PR→review rhythm** —
Loom only consumes the wire contract.

| ID | Endpoint(s) | Feeds | Notes |
|----|-------------|-------|-------|
| BE-1 | `GET /worlds/{w}/branches` | M4 | deferred in docs/08 |
| BE-2 | `POST /worlds/{w}/branches` (fork) | M4 | deferred |
| BE-3 | commit **lineage/log** + marker create | M4 | new |
| BE-4 | **events** read (filterable) + commit detail | M4 | new; the inspector's source |
| BE-5 | `dry_run` beat + **consistency** read | M4 | preview + T2 proxy |
| BE-6 | pack **upload** (multipart) + `validate` | M5 | `POST /worlds` is JSON-only today |
| BE-7 | `backfill` / `probe` (LLM stages) | M5 | deferred; stream progress |
| BE-8 | `seed`, world `export` / `import` over HTTP | M5 | deferred/scaffolded |
| BE-9 | **campaign end**, **codex** add/list | M4/M5 | new |
| BE-10 | `GET /usage`, world-scoped `state?at=` / `chronicle`, ruleset registry read | M6/M4 | metering + world-scope reads |
| BE-11 | **WS envelope reconciliation** (add `campaign_id`/`beat_id`; the richer frame set docs/08 advertises) | M2/M4 | fixes the documented wire drift |

> Sequencing rule: **Loom never blocks on the backend.** If a 🔴 endpoint isn't ready, the
> corresponding surface ships behind a feature flag that degrades to "not supported by this
> server" (the server's own 501 convention). Loom's M1–M3 value is unconditional.

## Risks & open decisions

- **LD-2 stack** — confirm before M0 code.
- **Coarse authority** — Loom must enforce its own per-actor authorization (M6 BFF); don't ship an
  admin token to the browser.
- **Wire drift** (BE-11) — code to the *actual* frames, not docs/08's advertised set.
- **Two-repo cadence** — Loom and the engine version independently; Loom pins the API version and
  the endpoint set it requires per milestone.
