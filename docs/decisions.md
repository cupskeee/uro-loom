# Decisions — Uro Loom

Append-only decision log, mirroring the engine repo's `docs/decisions.md` discipline: never edit
a past decision; a reversal is a new entry pointing at the old. `LD-*` = "Loom Decision".

Cross-references to engine decisions use their `D-*` ids from `cupskeee/uro` → `docs/decisions.md`.

---

## LD-1 — Uro Loom is a separate repository, a pure consumer of `uro-server`

**Status:** accepted (2026-07-19).

The engine's charter (`uro` → `docs/00`) makes *"frontends of any kind beyond the reference CLI"*
and *"graphical world-builder UIs"* explicitly **out of scope**: *"Uro is the engine; everything
user-facing beyond a reference CLI is a consumer built on the engine."* A web console is exactly
such a consumer.

Owner decision (2026-07-19): **Uro stays an engine; the UI lives in its own repo.** Therefore Loom
is `cupskeee/uro-loom`, not a package inside the `uro` workspace, and not a directory in it.

**Consequences:** independent versioning + release cadence; its own Node/TS toolchain (kept out of
the engine's `uv` workspace, `just test`, import-linter, PyPI train); coupling limited to the
server **wire contract**. This is a restatement of the engine's own identity boundary, and the
mirror of the engine-side decision to keep UI out (record it there as its own `D-*` when convenient).

## LD-2 — Frontend stack (OPEN — confirm before M0 code)

**Status:** proposed, not yet accepted.

**Proposed default:** TypeScript + React + Vite + TanStack Query + native WebSocket + Tailwind/
headless components + d3 for the DAG/graph views; Vitest/Playwright for test; openapi-typescript
for the generated client; a small Node BFF for M6 multi-tenant identity. Rationale + alternatives
(SvelteKit, SolidStart) in [`01-architecture.md`](01-architecture.md) §4.

**Why open:** genuine owner call; changes tooling and hiring but not the milestone shape (M0–M6
are stack-agnostic). Resolve at M0.

## LD-3 — Client-only integration: no `uro-core` import, no direct DB, no migrations

**Status:** accepted (2026-07-19).

Loom talks to `uro-server` over HTTP + WS **only**. It never imports `uro-core` (it's a browser
app anyway), never opens a Postgres connection, never reads `proj_*` tables directly, never runs a
migration. Projections are the server's private, rebuildable substrate; Loom treats every read as
a **read-only, branch-scoped, rebuildable** view. Writes are **intents** (→ beats/events) or
lifecycle calls — there is no mutable-state write API to call, by construction (engine invariant
*"everything is an event"*).

**Consequences:** the wire contract is the only thing to pin/track; the engine can refactor core,
adapters, and even the DB schema freely as long as the API holds.

## LD-4 — Loom owns identity; Uro owns bearer tokens

**Status:** accepted (2026-07-19).

The engine has **no user system** by design (a platform concern; OAuth/OIDC/orgs are *"never in
the engine"*). Uro authenticates via bearer tokens behind a single `resolve_participant` choke
point, with **coarse** authority (a valid token authorizes the call; the acting `participant` is
trusted from the request body).

Therefore: in **operator mode** (M0–M3) Loom holds operator/admin token(s) directly (simplest,
single-user). In **multi-tenant mode** (M6, optional) Loom runs its **own** accounts/login behind a
**BFF** that holds Uro tokens and enforces finer per-actor authorization at its edge — **the raw
admin token never reaches the browser.** Any content moderation Loom needs is also a Loom-layer
concern (the engine is content-agnostic).

Ties to engine `D-39` (durable hashed campaign-scoped `session_tokens`).

## LD-5 — Loom never blocks on the backend; full CLI parity is a two-repo effort

**Status:** accepted (2026-07-19).

Only ~11 of the 26 `uro` CLI commands have an HTTP endpoint today; ~13 need new endpoints (mostly
the deferred `docs/08` surface). Rather than wait, Loom sequences the **🟢 available-today** work
first (observe + play + core lifecycle: M1–M3) and gates each **🔴 needs-backend** surface behind a
feature flag that degrades to the server's own **501 "not supported"** convention. The endpoint
work is tracked as a **companion workstream in the engine repo** (see [`04-plan.md`](04-plan.md) →
Backend co-evolution, BE-1…BE-11). Full parity ships when both sides meet; Loom is useful before
then.
