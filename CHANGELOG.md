# Changelog

All notable changes to Uro Loom are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/); this project will use SemVer once it ships code.

## [Unreleased]

### Added
- **Extraction policy toggles on the Ops page (D-49).** A new operator-only panel controls which
  EMERGENT categories play may create — **Actors / Places / Claims & Beliefs** — as live checkboxes
  (a change PATCHes immediately). The **Claims & Beliefs** toggle carries a disclaimer (⚠ the engine
  NEEDS them for recall — disabling degrades continuity and long-range memory), and a note that
  **Threads & Factions are authored-only** (from a world pack, not from play). Pairs with the
  uro-server `/extraction-policy` surface.

### Fixed
- **Usage telemetry now updates live.** The Ops usage dashboard fetched once and cached, so it
  showed stale LLM-call counts after you chatted — beats commit over the WS play channel, which
  never invalidates the query. `useUsage` now polls while the tab is visible (`refetchInterval`,
  paused when hidden) and refetches on window focus, and the dashboard gained a manual **Refresh**
  button. (The metering itself was working — the DB was recording calls; only the view was stale.)

### Added
- **Providers: Codex (ChatGPT-subscription) OAuth connect (D-47).** A "Connect ChatGPT (Codex)"
  action on the Providers page opens an authorize modal — it shows the device code to enter on
  OpenAI's page (with a Copy button) + an "Authorize with OpenAI ↗" button, then polls until the
  login connects and the new `codex` connection appears in the list. No API key form; the token
  exchange and encrypted storage happen server-side. New `codexStart`/`codexPoll` endpoints + a
  stub-server device flow (pending→connected) for the e2e.
- **Providers: per-role-binding `test` button (D-47).** Each bound engine role now has its own
  `test` action that probes the EXACT connection + model the role uses (with an isolated ✓/✗
  result line), rather than only the connection-level canary. The connection-level `test` now
  sends no model and lets the server pick a known-good default — it no longer sends
  `cached_models[0]`, which for OpenAI was the sorted list's head `babbage-002` (a legacy model
  the chat-probe can't call, a false ✗). Pairs with the uro-server `_default_probe_model` fix.

- **M3 — operate (lifecycle writes that already have endpoints).** Every 🟢 write surface:
  - **New World** (Worlds page) and **New Campaign** (Campaigns page, with a world picker) forms.
  - A campaign **Manage** tab: **Join**, **Mint / Revoke token**, **Time-skip**, and a **Chronicler
    outcome submitter** (builds a valid `OutcomeBundle` — `encounter_id` from the path, feats/
    casualties, `extra='forbid'`-safe).
  - Data layer: typed POST endpoints + TanStack `useMutation` hooks that invalidate the affected
    read queries; a shared `errorMessage()` that surfaces the server's `{detail}`; small form
    primitives. Request bodies verified against the real uro-server handlers.
  - The dev **stub server** grew POST handlers for all seven write endpoints (in-memory), so
    operate is developable/testable without a live engine.
  - Tests: unit (outcome-bundle builder, write-endpoint URLs/bodies/method, `errorMessage`) + an
    E2E operate flow (create world → appears; mint token; time-skip). **49 unit + 5 E2E green.**
- **M2 — live play (GM mode, the flagship).** A live-play surface over the WS
  `/campaigns/{c}/play` channel:
  - Typed socket client (`src/api/playSocket.ts`) + a **pure session reducer**
    (`src/play/playSession.ts`) that folds the frame stream into renderable state — including
    **streaming** narration (`beat_started` → `narration_chunk`× → `beat_committed`/`beat_failed`).
  - **Play** tab: a live transcript, an intent box (Enter to send), and the **non-canon
    table-talk lane** rendered distinctly from canonical beats; roster + honest close-code
    handling (4401/4403/4404). Frame shapes verified against the real uro-server WS handler.
  - The dev **stub server** grew a hand-rolled, zero-dependency **WebSocket** (RFC 6455
    handshake + framing) that simulates a streamed beat, so play is developable/testable without a
    live engine.
  - Tests: unit (socket URL/frame parsing, reducer streaming/roster/notices) + an E2E play flow
    (intent → streamed beat; table-talk → non-canon lane). **38 unit + 4 E2E green.**
  - Honest gap: the server does not stream scene/mode frames (docs/08 advertises them; `app.py`
    doesn't emit them), so the panel says so rather than faking it.
- **M1 — observe (read-only surfaces).** A genuinely useful console against today's `uro-server`,
  no engine changes:
  - **Worlds** browser, **Campaigns** list (with `?world=` filter) + detail, and a campaign
    workspace with deep-linkable tabs: **Overview**, **Roster**, **State**, **Chronicle**.
  - **State** renders the four projections — actors (tier / role / aliases / status), places
    (kind / status), threads (state / provenance), factions — with status/provenance badges.
  - **Chronicle** renders narrated beats (oldest-first); **Roster** lists bound PC actor ids.
  - Wire types verified against the real uro-core models + projection SQL (not docs/08 —
    avoiding the known wire drift). A reusable `<QueryBoundary>` gives uniform loading / error /
    empty handling and the 501 "not supported by this server" graceful-degradation path.
  - Routing (React Router), query hooks (TanStack Query), the stub server extended with realistic
    sample data, plus unit tests (endpoint URLs, QueryBoundary degradation) and an E2E browse flow.
- **M0 — foundations (LD-2 stack accepted: React + Vite + TS).** The app skeleton:
  - Typed `uro-server` API client (`src/api/`) — a single `apiFetch` choke point mapping HTTP
    status to typed errors, incl. **501 → `UnsupportedByServerError`** (the graceful "not
    supported by this server" degradation path), plus a wire-version pin.
  - Connection/auth flow — a Connection screen (server URL + bearer token, kept in sessionStorage
    per LD-4) and a live health badge (TanStack Query) showing connected/unreachable + version.
  - A zero-dependency dev **stub server** (`dev/stub-server/`) + `docker-compose.yml`, so Loom is
    developable/testable without a full Uro instance.
  - Tooling: Tailwind, ESLint (flat) + Prettier, Vitest unit tests (API client error mapping),
    Playwright E2E smoke, and a GitHub Actions **CI** gate (format · lint · typecheck · unit ·
    build · E2E). All green locally.
- Planning scaffold: MIT license, `.gitignore`, and the design docs — `README.md`,
  `docs/00-vision.md`, `docs/01-architecture.md`, `docs/02-feature-parity.md` (the 26-command
  CLI → console matrix + backend gap map), `docs/03-surfaces.md`, `docs/04-plan.md` (M0–M6 +
  backend co-evolution BE-1…BE-11), and `docs/decisions.md` (LD-1…LD-5).

_Next: M1 (observe) — world browser, campaign list/detail, roster, state, chronicle against
today's server. See `docs/04-plan.md`._
