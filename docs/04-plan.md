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

## M1 — Observe (read-only, ships against today's server) 🟢 ✅ DONE

Goal: a genuinely useful read-only console with **zero engine changes**.

- ✅ **World Browser** (`GET /worlds`) and **Campaign list/detail** (`GET /campaigns`, `/{c}`).
- ✅ **Roster** (`GET …/roster`), **State** (`GET …/state`), **Chronicle** (`GET …/chronicle`).
- ✅ From `state`, **Actors / Places / Threads / Factions** panels (all four sections).
- ✅ Campaign workspace with deep-linkable tabs; a reusable `<QueryBoundary>` (loading/error/empty
  + 501 graceful-degradation). Wire types verified against the real uro-core models.

**Exit (met):** point Loom at a seeded world and browse its campaigns, roster, current state, and
lore wall — no CLI needed. _Note: the world/campaign selector is per-page navigation; a persistent
global branch-context switcher lands with M4's branch/timeline work (there's no branch-list
endpoint yet — BE-1)._

## M2 — Play (GM mode, the flagship) 🟢 ✅ DONE

Goal: drive live beats in the browser — parity with `uro connect`, richer than the terminal.

- ✅ **WS play client** for `/campaigns/{c}/play`: send `intent`; render streamed `narration_chunk`
  → `beat_committed`; handle `beat_failed` and `4401`/`4403`/`4404` closes (a pure reducer folds
  the frame stream; the socket reconnects on connection/campaign change).
- ✅ **Multiplayer**: roster join/leave, the **non-canon** `table_talk` lane (rendered distinctly),
  `vote` frames (→ `vote_unsupported`/`vote_tally`/`vote_decided`), `not_your_turn` /
  `proposal_opened` / `intent_rejected` reflected honestly (server-driven arbitration).
- ✅ Intent box + running transcript.

**Exit (met):** send an intent and watch narration stream in; table-talk renders distinctly from
canon (proven by E2E against a hand-rolled WS in the stub). _Honest deferrals: **scene + mode**
display isn't wired because the server doesn't emit those frames — now a documented, deliberate
**future GROW** (BE-11/uro#43), not drift: encounters auto-resolve inside one beat, so there's no
persistent mode state to emit without new engine work; the panel says so. A two-tab "both see the
same beats" demo needs a real multi-connection server (the stub is per-connection)._

## M3 — Operate what exists 🟢 ✅ DONE

Goal: the lifecycle writes that already have endpoints.

- ✅ **New Campaign** (`POST /worlds/{w}/campaigns`, fresh/adopt PC + seed) · **Join** (`…/join`).
- ✅ **New World** (`POST /worlds`) — a form on the Worlds page (compose-a-campaign is a one-click
  follow-through link into the world-filtered New Campaign form, rather than an auto-created one).
- ✅ **Token** mint/revoke (`…/tokens`, `…/tokens/revoke`) — self/admin scope enforced server-side.
- ✅ **Time-Skip** (`…/time-skip`) · **Chronicler Outcome Submitter** (`…/encounters/{e}/outcome`,
  builds a valid `OutcomeBundle`).

**Exit (met):** an operator can create a world + campaign, seat players with tokens, run a session,
skip time, and submit an external outcome — entirely in Loom (proven by an E2E operate flow).
_`end_campaign` now ships (`POST /campaigns/{c}/end`, operator, BE-9) — an M4 wire-up. The
outcome form covers participants/witnesses/casualties/one-feat/duration — loot + multi-feat extend
the same pattern._

> **After M3, Loom is independently valuable.** Everything past here needs the engine to grow
> endpoints; those milestones interleave with the backend co-evolution workstream below.

## M4 — Timelines & epistemics (backend ✅ shipped, BE-1…BE-5/9/10) 🟢

Goal: the signature branching + "who knows what" views. Paired with backend items **BE-1…BE-5**.

- ✅ **Slice 1 — timeline cluster (shipped):** a **World workspace** (`/worlds/:worldId`) with a
  **Timeline** tab — **Branch list** (heads, depth, in-fiction day, fork origin) · **Commit Log**
  (git-log lineage, markers) · **Fork** (from a commit/marker, optional time-skip) · **Add Marker**.
  Fork + marker are **operator-only** (a 403 renders "operator token required", D-44). BE-1/2/3.
- ✅ **Slice 2 — event-log inspector (shipped):** a world **Events** tab — a filterable raw event
  stream (branch/type/entity_ref/caused_by) + **Commit Detail** (deep-linked from the Timeline's
  "inspect →"). **Operator-only (D-45):** a player token gets an informational "operator required"
  panel, not the omniscient log. `QueryBoundary` now degrades a 403 gracefully; the query client no
  longer retries deterministic 4xx/501. BE-4.
- ✅ **Slice 3 — Epistemic Explorer (shipped):** a campaign **Epistemics** tab — claims with their
  ground-truth value (true/false/unknown) + the **belief fan-out** (who holds each claim, at what
  confidence, and the `learned_from` propagation chain). **Operator-only (D-46):** via
  `state?sections=claims,beliefs`; a player token gets the operator-required panel, and the
  scene-safe default state read is unaffected. (Faction/relationship graph · counters · memory
  inspector remain — same operator-only sections pattern.) BE-4/D-46.
- **Preview Beat (dry-run)** · **Consistency** panel (BE-5) — the last M4 slice.

**Exit:** fork a timeline in the UI, watch the DAG branch, and inspect the epistemic delta
between two forks.

## M5 — World authoring & lifecycle (backend ✅ shipped, BE-6/7/8) 🟢

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
deferred `docs/08` surface**. **Tracked in the engine repo** under the epic
[cupskeee/uro#44](https://github.com/cupskeee/uro/issues/44) (label `uro-loom`); each BE has its
own issue below. **This is engine work, done in the engine repo via its branch→PR→review rhythm** —
Loom only consumes the wire contract.

**All BE-1…BE-11 are ✅ MERGED in `uro` (epic #44) + a D-46 holistic-review hardening pass.** The
frontend is no longer backend-blocked; this table is now the endpoint map for the M4–M6 wiring.

| ID | Issue | Endpoint(s) | Feeds | Notes |
|----|-------|-------------|-------|-------|
| BE-1 | [#33](https://github.com/cupskeee/uro/issues/33) | ✅ `GET /worlds/{w}/branches` (any-authed) | M4 | branch tree + markers + per-branch day |
| BE-2 | [#34](https://github.com/cupskeee/uro/issues/34) | ✅ `POST /worlds/{w}/branches` (fork, **operator**) | M4 | `from_ref` + optional time-skip |
| BE-3 | [#35](https://github.com/cupskeee/uro/issues/35) | ✅ `GET /worlds/{w}/log` + `POST /worlds/{w}/markers` (**operator**) | M4 | lineage + marker create |
| BE-4 | [#36](https://github.com/cupskeee/uro/issues/36) | ✅ `GET /worlds/{w}/events` + `/commits/{id}` (**operator**, D-45) | M4 | the inspector's source — omniscient, operator-only |
| BE-5 | [#37](https://github.com/cupskeee/uro/issues/37) | ✅ `POST /campaigns/{c}/dry-run` + `GET …/consistency` | M4 | intent-only preview (D-37) + T2 proxy |
| BE-6 | [#38](https://github.com/cupskeee/uro/issues/38) | ✅ `POST /worlds/validate` (multipart) | M5 | pack-upload **create** still deferred |
| BE-7 | [#39](https://github.com/cupskeee/uro/issues/39) | ✅ `POST /worlds/backfill` + `/probe` (**operator**, LLM) | M5 | backfill **preview**-only; probe warn-not-fail |
| BE-8 | [#40](https://github.com/cupskeee/uro/issues/40) | ✅ `GET /worlds/{w}/export` + `POST /worlds/import` (**operator**) | M5 | `seed` carved out (needs the pack re-supplied) |
| BE-9 | [#41](https://github.com/cupskeee/uro/issues/41) | ✅ `POST /campaigns/{c}/end` (**operator**) + `GET/POST …/codex` (self-or-admin) | M4/M5 | end + participant memory |
| BE-10 | [#42](https://github.com/cupskeee/uro/issues/42) | ✅ `GET /usage` (**operator**), `/rulesets`, world `/chronicle` | M6/M4 | `state?at=` carved out (materialize-at-commit) |
| BE-11 | [#43](https://github.com/cupskeee/uro/issues/43) | ✅ WS contract **reconciled to the real frames** (retract, not grow) | M2/M4 | scene/mode is a documented future GROW |

> Sequencing rule: **Loom never blocks on the backend.** If a 🔴 endpoint isn't ready, the
> corresponding surface ships behind a feature flag that degrades to "not supported by this
> server" (the server's own 501 convention). Loom's M1–M3 value is unconditional.

## Risks & open decisions

- **LD-2 stack** — ✅ accepted at M0 (React + Vite + TS; see decisions.md).
- **CORS (M1, real server)** — the dev stub sends permissive CORS, but a real `uro serve` may not
  send `Access-Control-Allow-Origin`, which blocks Loom's cross-origin browser calls. M1 must
  either (a) enable CORS on `uro-server` (a small backend item), (b) serve Loom same-origin behind
  a reverse proxy, or (c) route through the M6 BFF. Decide when M1 first hits a real instance.
- **Coarse authority** — Loom must enforce its own per-actor authorization (M6 BFF); don't ship an
  admin token to the browser.
- **Wire drift** (BE-11) — ✅ RESOLVED: `docs/08` now matches `app.py` frame-for-frame; Loom already
  coded to the real frames, so no change is needed. `scene`/`mode` stay a documented future GROW.
- **Two-repo cadence** — Loom and the engine version independently; Loom pins the API version and
  the endpoint set it requires per milestone.
