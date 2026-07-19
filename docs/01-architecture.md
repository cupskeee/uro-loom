# 01 — Architecture

Loom is a browser SPA that is a **pure network client** of `uro-server`. This doc pins the
integration posture, the wire contract, the auth model, and the proposed stack. All of it flows
from one rule: **Loom couples only to the server's API, never to the engine's internals.**

## 1. Integration posture

```
Browser (Loom SPA)
  │
  ├─ REST  ──▶  uro-server  /worlds, /campaigns, /campaigns/{c}/{roster,state,chronicle}, …
  │                          (authed management surface — reads + lifecycle writes)
  │
  └─ WS    ──▶  uro-server  /campaigns/{c}/play?token=…
                            (GM-mode play: submit intents, receive streamed beats + lanes)
```

- **HTTP for management and reads.** Worlds, campaigns, roster, current state, chronicle,
  time-skip, token mint/revoke, chronicler outcome submission — all authed REST calls.
- **WebSocket for play.** One socket per campaign; the server fans out every participant's beats
  to every subscriber. Loom sends `intent` / `table_talk` / `vote` frames and renders the
  server→client frames (`beat_started`, `narration_chunk`, `beat_committed`, `not_your_turn`,
  `vote_tally`, …). Protocol detail in [`02-feature-parity.md`](02-feature-parity.md) and the
  parent `docs/08`.
- **Never in-process.** The CLI embeds `uro-core` for local play; Loom does not have that option
  (it's a browser) and would not take it if it could. HTTP-client posture only.

## 2. The wire contract is the only coupling

Loom depends on **the shape of the server's request/response and WS envelopes**, nothing else:

- **No `uro-core` import.** Loom is TypeScript; it cannot and must not vendor engine internals.
- **No direct DB.** Postgres/pgvector is the server deployment's private substrate. Projections
  (`proj_actors`, `proj_claims`, `proj_threads`, `proj_pcs`, `proj_counters`, …) are read **only**
  through endpoints that return them; Loom treats every one as a **read-only, branch-scoped,
  rebuildable** view.
- **Version pinning.** Loom targets a specific `uro-server` API version and surfaces a clear error
  on mismatch. When the server grows the deferred endpoints (see the plan), Loom bumps the pin.
- **Generated types.** The intent is to generate the TypeScript API client from the server's
  OpenAPI schema (FastAPI emits one) so the contract is machine-checked, not hand-copied. Until
  the server exposes a stable schema, a hand-written typed client in `src/api/` is the fallback.

### Everything is an event — what that means for a client

There is **no mutable-state write API**. Loom's "write" operations are exactly two kinds:

1. **Submit an intent** → the engine runs a beat → events get committed → projections update.
   Loom observes the result; it never authors the events.
2. **Lifecycle calls** (create world, fork branch, mint token, …) → these too resolve to
   committed events or session state on the server.

Loom must always carry **campaign/branch context** on every read — reads are branch-scoped, and
the same actor can be a PC on one fork and an NPC on a sibling. There is no cross-branch merge.

## 3. Auth & identity

The engine has **no user system** — that's Loom's job if it wants one. The model:

- **Uro side:** bearer tokens behind a single `resolve_participant(token)` choke point. Three
  tiers — static `--token` *player* creds (server-wide), an `--admin-token` *operator* subset
  (may seat/mint/revoke for others), and runtime-**minted** tokens (durable, hashed at rest,
  **campaign-scoped**). Authority is **coarse**: a valid token authorizes the call, but the
  acting `participant` is trusted from the request body. A minted token on the wrong campaign is
  rejected (403 / WS close 4403).
- **Loom side, two deployment modes:**
  - **Operator mode (M0–M3):** Loom holds one or a few bearer tokens (entered by the operator, or
    an `--admin-token`) and acts as them. No Loom accounts. Simplest; matches how `uro serve` is
    run today. **Never ship the operator/admin token to the browser in a multi-user deploy.**
  - **Multi-tenant mode (M6, optional):** Loom runs its **own** identity layer (accounts, login,
    orgs) and, at its server-side edge (a thin BFF — backend-for-frontend), mints/holds Uro
    tokens per user and proxies calls. The browser never sees a raw admin token. This is where
    Loom owns everything the engine refuses to.
- **Consequence:** because Uro's authority is coarse, Loom must **supply and trust
  `participant_id` itself** and enforce its own finer authorization at the BFF — do not treat mere
  token possession as per-actor permission.

## 4. Proposed stack (decision LD-2 — confirm before M0 code)

Recommended default, chosen for a data-dense admin/observability console with a live socket:

| Concern | Proposed | Why |
|---------|----------|-----|
| Language | **TypeScript** | Non-negotiable for a typed wire contract |
| Framework | **React + Vite** | Dominant ecosystem for admin consoles; trivial WS + data-fetching integration; easy to hire/fork |
| Server state | **TanStack Query** | Caching, refetch, and optimistic updates over the REST surface |
| Realtime | **native WebSocket** (thin wrapper) | The play channel is plain JSON frames; no library needed |
| Routing | **TanStack Router** or React Router | Deep-linkable world/branch/campaign/commit URLs |
| Styling | **Tailwind + a headless component kit** (Radix/shadcn) | Fast, consistent, accessible; theme-able |
| Graph/DAG | **d3 / a DAG lib** for the timeline + faction graph | The signature views are node-link/DAG |
| Client gen | **openapi-typescript** off the server schema | Machine-checked contract (§2) |
| Test | **Vitest + Testing Library + Playwright** | Unit + a smoke E2E against a stub server |
| BFF (M6) | **a small Node/Hono or FastAPI edge** | Holds tokens, owns identity; keeps admin creds off the browser |

**Alternatives considered:** SvelteKit (lighter, built-in BFF via server routes — strong if the
team prefers it; less ubiquitous); SolidStart; a server-rendered stack. The choice is a genuine
open decision — see [`decisions.md`](decisions.md) → **LD-2**. Nothing below M0 assumes React
specifically; the milestones are stack-agnostic until the first line of app code.

## 5. Deployment shape

- Loom builds to **static assets** (Vite `dist/`) served by any static host / CDN — plus, in
  multi-tenant mode, the small **BFF** service.
- It needs a reachable `uro-server` URL and a token; it does **not** need the `uv` workspace,
  Postgres, or migrations — those belong to the engine deployment.
- A `docker-compose.yml` here will, for local dev, optionally stand up a stub/echo server so Loom
  is developable without a full Uro instance, and document pointing at a real `uro serve`.
