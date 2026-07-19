# 00 — Vision & scope

## What Uro Loom is

A **web console for operating a Uro instance** — the graphical consumer that a Uro operator (a
game master, a world author, a platform developer, an engine dev) points at a running
`uro-server` to:

- **Observe** — browse worlds, timelines, branches, the event log, and the epistemic layer
  (claims, beliefs, memories, threads, factions, places, counters) as read-only projections.
- **Play** — drive live GM-mode beats over the WebSocket play channel, with multiplayer
  roster, turn arbitration, and the non-canon table-talk/vote lanes rendered honestly.
- **Operate** — perform world/campaign/branch/token lifecycle management: everything the `uro`
  CLI does, from a browser.

Its guiding principle is **feature parity with the `uro` reference CLI** (see
[`02-feature-parity.md`](02-feature-parity.md)), plus the richer UX the engine deliberately
leaves to consumers (identity, dashboards, usage/billing views, moderation).

## What Uro Loom is NOT

Loom inherits, by being a good consumer, the discipline the engine imposes on itself:

- **Not part of the engine.** Uro's charter: *"Uro is the engine; everything user-facing beyond a
  reference CLI is a consumer (a game, a web platform, a VTT integration) built on the engine."*
  Loom is that consumer. It is not a peer of `uro-core`/`uro-server`; it is downstream of both.
- **Not an embedder.** The CLI can run the engine in-process; Loom does **not**. It is a
  network client of `uro-server` over HTTP + WS. It never imports `uro-core`.
- **Not a database client.** Loom never opens a Postgres connection, never reads `proj_*` tables
  directly, never runs a migration. Projections are the server's private, rebuildable substrate;
  Loom reads them only through authed API endpoints.
- **Not a state editor.** Everything in Uro is an event; there is no mutable-state write API.
  Loom cannot "edit" a world — it submits **intents** (which produce beats/events) or reads
  derived views. No form in Loom writes a projection.
- **Not an external resolver.** Loom is a GM-mode client (Uro runs the beat pipeline). It is not
  a Chronicler-mode game that owns resolution — though it *can* provide a form to submit an
  external `OutcomeBundle` on behalf of one (that's still just calling the authed endpoint).
- **Not the engine's identity system.** Uro has no user system by design (a platform concern).
  Loom owns accounts/login *if it wants them* and translates its own identities to Uro **bearer
  tokens** at its edge. It never expects the engine to grow OAuth/orgs/users.
- **Not a content moderator by proxy.** The engine is content-agnostic (*"no engine-level safety
  filters"*). Any guardrails Loom needs, Loom adds at its own layer.

## The boundary, stated once

> Loom's only legitimate coupling to Uro is **the wire contract** — the REST/WS message
> envelopes exposed by `uro-server`. That contract can change independently of `uro-core`; Loom
> pins the API version it targets and treats every projection it reads as a read-only, branch-
> scoped, rebuildable view. Loom owns nothing the engine owns, and the engine owns nothing Loom
> owns.

This is why Loom is a separate repository. See [`decisions.md`](decisions.md) → **LD-1**.

## Who it's for

- **The engine dev / operator** — a real UI over the instance instead of 26 CLI incantations.
- **World authors** — validate/backfill/probe/seed a world pack and watch a timeline branch,
  without a terminal.
- **Game/platform developers** — the reference "what a rich consumer looks like" built on the
  stable API; a starting point to fork into a product front-end.

## Non-goals (for now)

- Being a game. Loom is an *operator's* console, not a polished player-facing RPG client (though
  the play surface is real). A shipped game is a *different* consumer.
- Owning world **content**. Loom edits nothing canonical; authoring happens through pack
  import + engine pipelines.
- Replacing the CLI. The CLI stays the scriptable/headless reference client; Loom is the
  interactive one. They target the same server.
