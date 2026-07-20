# 03 — UI surfaces

The screens Loom provides, derived from Uro's domain model (worlds → branches → commits →
events → projections). Each surface names the projection(s)/endpoint(s) it reads and whether the
backend exists today (🟢) or needs work (🔴) — cross-referenced with
[`02-feature-parity.md`](02-feature-parity.md).

Grouped by posture: **Observe** (read), **Play** (GM mode), **Operate** (lifecycle writes),
**Admin** (identity/ops). Everything is **branch-scoped** — a campaign/branch selector is global
chrome, always visible.

## Observe (read-only projections)

| Surface | Shows | Source | Backend |
|---------|-------|--------|---------|
| **World Browser** | all worlds — name, narrator tone, bound ruleset, branch/campaign counts | `worlds` + `WorldGenesis` | 🟢 `GET /worlds` |
| **World Dashboard** | per-world overview — branches (heads), active vs ended campaigns, markers, thread/faction counts | multiple | 🟢 `GET /worlds/{w}/branches` + `/chronicle` (BE-1/BE-10) |
| **Timeline / Branch Graph** | the commit DAG as a git-style graph (depth, parent, forks, markers) | `commits` + `branches` + `markers` | 🟢 `GET /worlds/{w}/branches` + `/log` (BE-1/BE-3) |
| **Event-Log Inspector** | filterable stream over events by branch/commit, `event_type`, `entity_ref`, `caused_by` (player/module/external/…) | `events` | 🟢 `GET /worlds/{w}/events` + `/commits/{id}` — **operator-only** (D-45: raw log is omniscient) (BE-4) |
| **Commit / Beat Detail** | one commit's ordered events, parent + hash, the `BeatResolved` narration | `commits` + `events` | 🟢 `GET /worlds/{w}/commits/{id}` — **operator-only** (D-45) (BE-4) |
| **Actor / NPC Directory & Profile** | branch-scoped actors (tier T0–T3, status alive/dead, aliases); profile drills into the opaque sheet | `proj_actors` + `proj_sheets` | 🟢 actors via `state` (player); `sheets` is **operator-only** (D-46) |
| **Epistemic Explorer** | claims (truth true/false/unknown, origin, `created_day`) + a belief fan-out graph (confidence, `learned_from`) | `proj_claims` + `proj_beliefs` | 🟢 `state?sections=claims,beliefs` — **operator-only** (D-45/D-46: this IS the omniscient layer; never a player read) |
| **Faction & Relationship Graph** | node-link graph of factions + typed edges (`at_war_with`, `member_of`, `rules`, `located_in`) | `proj_factions` + `proj_edges` | 🟢 factions via `state` (player); `edges` is **operator-only** (D-46) |
| **Places / Map View** | geography hierarchy (Region ⊃ Settlement ⊃ Site) with status (active/destroyed) | `proj_places` (+ `located_in` edges) | 🟡 via `state` |
| **Threads / Quest Board** | threads by state (dormant/offered/active/resolved/dead), tagged by provenance (author/ai_backfill) | `proj_threads` | 🟡 via `state` |
| **Counters Dashboard** | engine-owned integer counters (tension/heat/influence…) by scope + trajectory | `proj_counters` | 🟢 `state?sections=counters` — **operator-only** (D-46) |
| **Memory / Recall Inspector** | `memory_index` rows per branch + a "what would recall surface here?" probe | `memory_index` | 🔴 no `memory_index` read endpoint (not in the BE epic) |
| **Chronicle / Lore Wall** | the per-branch human-readable history from `BeatResolved` along the lineage | derived on demand | 🟢 `GET /campaigns/{c}/chronicle` (campaign-scoped) |
| **Snapshot & Materialization Explorer** | snapshots per commit (hash, cadence) + "materialize state at commit X" | `snapshots` + `state?at=` | 🔴 (world `state?at=` deferred) |

## Play (GM mode)

| Surface | Shows / does | Source | Backend |
|---------|--------------|--------|---------|
| **Campaign Play / Live Session** | streamed beats, current scene + mode (freeroam/encounter/downtime), participant roster, the intent box; renders `narration_chunk`→`beat_committed`, `not_your_turn`, `beat_failed` | WS `/play` | 🟢 |
| **Table-Talk & Vote lanes** | the **non-canon** coordination lane (`table_talk`) + arbiter votes (`vote_tally`/`vote_decided`), visually distinct from canon | WS `/play` | 🟢 |
| **Preview Beat (dry-run)** | events an intent *would* commit, no write | preview | 🟢 `POST /campaigns/{c}/dry-run` (BE-5) |

## Operate (lifecycle writes → events/session)

| Surface | Does | Backend |
|---------|------|---------|
| **New / Import World** | blank world, or import a pack (validate → optional backfill → seed) | 🟢 create (**operator**, D-46) · pack-upload create + `seed` still 🔴 (carve-outs) |
| **Fork / Branch Operations** | fork from any commit/marker (adopt-PC, new seed, time-skip); add markers | 🟢 `POST /worlds/{w}/branches` + `/markers` (**operator**, D-44) |
| **Campaign Lifecycle** | new (adopt/fresh PC), join, end (marker) | 🟢 new/join (self-or-admin) · 🟢 end (**operator**, D-44) |
| **Chronicler Outcome Submitter** | POST an external `OutcomeBundle` (participants, casualties, loot, feats) for a parked encounter | 🟢 `POST …/outcome` |
| **Time-Skip** | advance in-fiction time + fire downtime agenda rules | 🟢 `POST …/time-skip` (**operator**, D-46) |
| **Codex / Participant Memory** | add/list fork-surviving out-of-world notes (pinned/refs) | 🟢 `GET/POST …/codex` (self-or-admin, D-39) |
| **World Authoring aids** | validate / backfill / probe / export / import | 🟢 all ship (validate any-authed; backfill/probe/export/import **operator**) — `seed` 🔴 |

## Admin (identity / ops — Loom-owned)

| Surface | Does | Backend |
|---------|------|---------|
| **Participant & Session Admin** | participants, PC bindings (`proj_pcs`), connected roster + arbiter mode, `session_tokens` | 🟢 roster · 🔴 richer |
| **Token Management** | mint / revoke durable, campaign-scoped tokens (self/admin scope) | 🟢 |
| **Ruleset Viewer** | registered rulesets (`id@version`, e.g. `uro-basic` d20 / `uro-pbta` 2d6) + each sheet shape | 🟢 `GET /rulesets` (any-authed) (BE-10) |
| **Reaction-Layer / Rule-Pack Viewer** | a pack's declarative `rules.yaml`/`agendas.yaml` (conditions + closed action set) + module-caused beats | 🔴 no dedicated rule-pack read endpoint (the pack rides `WorldGenesis`; not in the BE epic) |
| **Ops / Usage & Telemetry** | `llm_calls` telemetry (provider/model, tokens, cost, latency) + probe quality signals | 🟢 `GET /usage[?stage=]` (**operator**, D-44) (BE-10) — **the dashboard/billing UX is explicitly Loom's job**, fed by engine metering; `?world=`/`?campaign=` not yet keyed |
| **Server Connection & About** | server URL, token, health, engine/API versions | 🟢 `/healthz` |

## Design notes

- **Branch context is global chrome.** Every read carries `(campaign|world, branch)`; switching
  forks re-scopes every panel. Never render cross-branch data as if merged.
- **Reads are derived, not authoritative-editable.** No surface offers a "save" that writes a
  projection. Writes are intents or lifecycle calls; the UI then *observes* the resulting events.
- **The two signature views** — the **Timeline/Branch DAG** and the **Epistemic Explorer** (claims
  + belief fan-out) — are what make Loom more than a CRUD panel; they visualize exactly the
  layer ("who knows what, on which timeline") the engine exists to own. Prioritize them once
  their endpoints land.
