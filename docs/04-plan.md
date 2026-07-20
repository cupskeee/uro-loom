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
display isn't possible — the server doesn't emit those frames (docs/02 wire drift), so the panel
says so; a two-tab "both see the same beats" demo needs a real multi-connection server (the stub
is per-connection). `vote_tally` rendering is generic pending a `VoteCoordinator` arbiter._

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
_Deferred: `end_campaign` has no endpoint (it's a 🔴/BE item, not part of "operate what exists"); the
outcome form covers participants/witnesses/casualties/one-feat/duration — loot + multi-feat extend
the same pattern._

> **After M3, Loom is independently valuable.** Everything past here needs the engine to grow
> endpoints; those milestones interleave with the backend co-evolution workstream below.

## M4 — Timelines & epistemics (needs backend) 🔴

Goal: the signature branching + "who knows what" views. Paired with backend items **BE-1…BE-5**.

- ✅ **Slice 1 — timeline cluster (shipped):** a **World workspace** (`/worlds/:worldId`) with a
  **Timeline** tab — **Branch list** (heads, depth, in-fiction day, fork origin) · **Commit Log**
  (git-log lineage, markers) · **Fork** (from a commit/marker, optional time-skip) · **Add Marker**.
  Fork + marker are **operator-only** (a 403 renders "operator token required", D-44). BE-1/2/3.
- **Event-Log Inspector** + **Commit/Beat Detail** (BE-4, **operator-only** — the omniscient log).
- **Epistemic Explorer** (claims + belief fan-out) · **Faction/Relationship graph** ·
  **Counters dashboard** · **Memory/Recall inspector** (claims/beliefs/sheets/edges/counters are
  operator-only, D-46; the state read enforces the player allowlist).
- **Preview Beat (dry-run)** · **Consistency** panel (BE-5).

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
deferred `docs/08` surface**. **Tracked in the engine repo** under the epic
[cupskeee/uro#44](https://github.com/cupskeee/uro/issues/44) (label `uro-loom`); each BE has its
own issue below. **This is engine work, done in the engine repo via its branch→PR→review rhythm** —
Loom only consumes the wire contract.

| ID | Issue | Endpoint(s) | Feeds | Notes |
|----|-------|-------------|-------|-------|
| BE-1 | [#33](https://github.com/cupskeee/uro/issues/33) | `GET /worlds/{w}/branches` | M4 | deferred in docs/08 |
| BE-2 | [#34](https://github.com/cupskeee/uro/issues/34) | `POST /worlds/{w}/branches` (fork) | M4 | deferred |
| BE-3 | [#35](https://github.com/cupskeee/uro/issues/35) | commit **lineage/log** + marker create | M4 | new |
| BE-4 | [#36](https://github.com/cupskeee/uro/issues/36) | **events** read (filterable) + commit detail | M4 | new; the inspector's source |
| BE-5 | [#37](https://github.com/cupskeee/uro/issues/37) | `dry_run` beat + **consistency** read | M4 | preview + T2 proxy |
| BE-6 | [#38](https://github.com/cupskeee/uro/issues/38) | pack **upload** (multipart) + `validate` | M5 | `POST /worlds` is JSON-only today |
| BE-7 | [#39](https://github.com/cupskeee/uro/issues/39) | `backfill` / `probe` (LLM stages) | M5 | deferred; stream progress |
| BE-8 | [#40](https://github.com/cupskeee/uro/issues/40) | `seed`, world `export` / `import` over HTTP | M5 | deferred/scaffolded |
| BE-9 | [#41](https://github.com/cupskeee/uro/issues/41) | **campaign end**, **codex** add/list | M4/M5 | new |
| BE-10 | [#42](https://github.com/cupskeee/uro/issues/42) | `GET /usage`, world-scoped `state?at=` / `chronicle`, ruleset registry read | M6/M4 | metering + world-scope reads |
| BE-11 | [#43](https://github.com/cupskeee/uro/issues/43) | **WS envelope reconciliation** (add `campaign_id`/`beat_id`; the richer frame set docs/08 advertises) | M2/M4 | fixes the documented wire drift |

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
- **Wire drift** (BE-11) — code to the *actual* frames, not docs/08's advertised set.
- **Two-repo cadence** — Loom and the engine version independently; Loom pins the API version and
  the endpoint set it requires per milestone.
