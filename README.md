# Uro Loom

**A web console for operating a [Uro](https://github.com/cupskeee/uro) world-state engine instance.**

Uro Loom is the graphical front-of-house for Uro: browse worlds and timelines, inspect the
event log and the epistemic layer, drive live play sessions, and perform every management
operation the `uro` reference CLI can — from a browser instead of a terminal.

> **Status: M2 (live play) — the flagship surface is live.** On top of observe (M1), Loom now
> drives **live GM-mode play** over the WebSocket `/campaigns/{c}/play` channel: submit intents,
> watch narration **stream** in, and use the **non-canon table-talk lane** — all rendered from the
> real server frames. Plus M1's read surfaces (worlds, campaigns, roster, state, chronicle). Next:
> M3 (operate — the lifecycle writes that already have endpoints). See
> [`docs/04-plan.md`](docs/04-plan.md).

---

## Why a separate repo

Uro is, by its own charter, a **headless, game-agnostic world-state engine** — *"games and
platforms are consumers, not what Uro is."* Its vision doc explicitly lists *"graphical
world-builder UIs"* and *"frontends of any kind beyond the reference CLI"* as **out of scope**
for the engine. A web console is definitionally one of those consumers.

So Uro Loom lives outside the engine repo on purpose. It is a **pure network client** of
`uro-server`'s HTTP + WebSocket API. It never imports `uro-core`, never opens a Postgres
connection, never runs a migration. Its only coupling to Uro is the **wire contract**, which it
pins and tracks like any external integration. This keeps the engine's API *the* contract and
keeps Loom free to iterate on its own release cadence, its own toolchain (TypeScript/Node), and
its own concerns the engine deliberately refuses to own — accounts, dashboards, usage/billing UI.

See [`docs/00-vision.md`](docs/00-vision.md) for the full boundary, and the parent repo's
`docs/00` / `docs/08` for the engine's side of it.

## Relationship to Uro

```
┌─────────────┐   HTTP (REST management surface)     ┌──────────────┐        ┌────────────┐
│  Uro Loom   │ ───────────────────────────────────▶ │  uro-server  │ ─────▶ │  Postgres  │
│ (this repo) │ ◀─────────────────────────────────── │ (FastAPI     │        │ + pgvector │
│  browser    │   WebSocket (/campaigns/{c}/play)     │  shell over  │        └────────────┘
│  SPA        │                                       │  uro-core)   │
└─────────────┘                                       └──────────────┘
     owns: identity/accounts, UX,        owns: the engine, events, projections,
     dashboards, session UX, guardrails   auth tokens, the wire contract
```

Loom talks **only** to `uro-server`. It is a **GM-mode client** (it submits intents; the engine
runs the beat pipeline and streams narration) — it is *not* an external resolver, and it cannot
edit world state directly (everything is an event; reads are of rebuildable projections).

## Feature parity with `uro-cli`

Loom's north star is: **anything you can do with the `uro` CLI, you can do in Loom.** The full
26-command → console-surface mapping — including the honest gap analysis of which commands have a
server endpoint *today* vs. which require new endpoints in `uro-server` — is in
[`docs/02-feature-parity.md`](docs/02-feature-parity.md).

The headline: ~11 of 26 CLI commands are already reachable over the existing API; the rest
(branch ops, world authoring, dry-run, consistency, codex, export/import) are CLI-only and need
`uro-server` to grow the deferred `docs/08` REST surface. **Full CLI parity is therefore a
two-repo effort** — Loom + a companion endpoints workstream in Uro. The plan sequences Loom
around what ships today first.

## Documentation

| Doc | What it covers |
|-----|----------------|
| [`docs/00-vision.md`](docs/00-vision.md) | What Loom is and is **not**; the consumer-stance boundary |
| [`docs/01-architecture.md`](docs/01-architecture.md) | Client architecture, the wire contract, auth strategy, proposed stack |
| [`docs/02-feature-parity.md`](docs/02-feature-parity.md) | The 26-command CLI → console matrix + backend gap map |
| [`docs/03-surfaces.md`](docs/03-surfaces.md) | The UI surfaces (screens) derived from the domain model |
| [`docs/04-plan.md`](docs/04-plan.md) | The phased implementation plan (M0–M6) + backend co-evolution |
| [`docs/decisions.md`](docs/decisions.md) | Decision log (LD-1…), mirroring Uro's `decisions.md` discipline |

## Quickstart

Requires Node ≥ 20 and pnpm.

```sh
pnpm install
pnpm dev            # Loom dev server → http://127.0.0.1:5173
```

Loom needs a server to talk to. Two options:

```sh
# A) zero-dep dev stub (no Uro instance needed) — enough for M0
docker compose up -d          # stub server → http://127.0.0.1:8787
# then in Loom's Connection screen, enter http://127.0.0.1:8787 + any token

# B) a real Uro instance (in the uro repo)
docker compose up -d --wait               # Postgres + pgvector on host port 5433
uv run uro db migrate
uv run uro serve --token dev=player-1     # token-auth server on :8000
# then connect Loom to http://127.0.0.1:8000 with token "dev"
```

**Dev scripts:** `pnpm dev` · `pnpm build` · `pnpm typecheck` · `pnpm lint` · `pnpm test`
(unit) · `pnpm test:e2e` (Playwright smoke) · `pnpm stub` (run the stub server directly).
CI runs the whole gate on every push/PR.

## License

MIT © 2026 cupskeee — same as the engine.
