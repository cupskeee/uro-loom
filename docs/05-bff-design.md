# 05 — Optional multi-tenant BFF (identity & token custody)

> A decision note implementing [`LD-4`](decisions.md) ("Loom owns identity; Uro owns bearer
> tokens"). Turns that one-paragraph decision into a buildable plan for the **optional** M6
> multi-tenant mode. Cross-references engine decisions by their `D-*` id in `cupskeee/uro` →
> `docs/decisions.md`. Engine-code claims below were verified against the shipped
> `packages/uro-server/uro_server/app.py` on 2026-07-20; today's single-operator mode (M0–M5)
> needs **no** BFF and is untouched by everything here.

Produced by a blind 4-architecture design panel (scored: session-cookie BFF **8.0** · OIDC-vault
7.5 · stateless-edge 7.0 · single-operator-proxy 6.0); the recommendation is the winner with the
best ideas from the runners-up grafted in (see §4).

Status: proposed · Implements: LD-4 (accepted) · Mode: M6, optional, multi-tenant only · Engine change required: none

## Recommendation

Adopt a **stateful, same-origin session-cookie BFF that owns Loom's accounts/orgs and injects a per-account, per-campaign engine-minted (D-39) PLAYER token server-side**, keeping the single operator/admin token entirely BFF-side and gating the operator routes at the edge (base = Proposal 1, "Session-cookie BFF", the highest-scored option).

Grafts from the runners-up, each earning its place:

- **Canonical request re-serialization from a strict per-route field allowlist, drop-and-overwrite never merge, campaign taken only from the URL path** (Proposal 3). This is the correct structural crux defense and defeats duplicate-key / array / casing JSON smuggling. Adopt verbatim.
- **The "move the token server-side *before* any multi-tenancy" first step + a `direct|bff` client flag** (Proposals 2/3/4). Ships an immediate security win (admin token off the wire) with zero identity work and keeps zero-BFF local mode alive.
- **An OIDC seam from day one — `sub` as the account join key, password login as the PoC escape hatch behind the same account row** (Proposals 2/4). We do *not* stand up Keycloak for the PoC (too much standing infrastructure for an opt-in mode), but the schema anticipates it so real identity work is a later swap, not a migration.
- **Derive the allowed `(campaign, participant)` binding from the engine's own `pc_seats`/`pc_for_participant` via the operator token; keep the BFF's own table thin — a role/grant overlay, not a second authoritative copy of the binding** (Proposal 2 critique). Avoids three-way drift between BFF, IdP, and the engine's `PCBound` truth.

Why not the pure runners-up: the OIDC-vault (P2) and stateless-edge (P4) options front-load an external IdP and, in P4's case, an edge runtime that **can't host the WS play channel** and mischaracterizes real crown-jewel state as "stateless." The single-operator-token proxy (P3) **declines D-39 entirely** and is thereby forced to *re-implement the engine's player-view redaction by policy* — rebuilding a security-critical guarantee the engine already ships structurally. We take P3's excellent crux mechanics and sequencing without its strategic refusal of player tokens.

## 1. Trust model

**Correction to the premise (load-bearing).** The engine is *stronger* than "body-trusts participant." The adversarial pass verified the shipped code: the WS `/play` channel derives the actor from the token in the WS `/play` handler (`participant = resolve_participant(token)`) and reads **no** participant from the wire; every REST mutator that reads a body `participant` self-or-admin-gates it (`if participant != caller and not admin → 403`, the `_scope` self-check repeated on every mutator); and a D-39 minted token hash-resolves to exactly one `(participant, campaign)` (sessions.py). So a **player token is already participant-pinned by the engine.** The body participant is trusted **only when the caller presents the admin token** (`is_admin` bypasses the `not admin` clause).

That narrows the real invariant to one sentence, which is the spine of this design:

> **Never carry a player-tier action on the operator/admin token. Player actions always ride a per-account, per-campaign D-39 PLAYER token; the admin token is reserved for the enumerated operator routes only.**

Given that, cross-user impersonation is stopped by four independent mechanisms — three engine-side, one BFF-side:

1. **BFF grant lookup (edge).** Browser sends only the session cookie + a Loom-level campaign handle (`/api/campaigns/:loomId/...`). BFF resolves cookie → server-side session → `account_id`, takes the campaign **from the URL path only**, and looks up the grant. No grant → 403 before any upstream byte (closes BOLA/IDOR on the campaign path).
2. **Server-side participant injection by re-serialization.** The outgoing body is *rebuilt* from a strict per-route field allowlist with the grant's authoritative participant injected; any browser-supplied `participant`/`token`/`Authorization` is dropped-and-overwritten, never merged. For accounts holding multiple PCs, the client passes a **seat selector** (an index) resolved against that account's own grant rows — it chooses among allowed ids, it can never name an arbitrary one.
3. **Engine token→participant (play path).** The injected minted token *is* the identity — `resolve_participant` derives the actor from it. There is no participant field on the play wire to abuse.
4. **Engine `_scope` self-check (mutating path).** Because player actions ride the **non-admin** player token, the engine's own `participant != caller and not admin → 403` is a second, independent server-side check: even a BFF bug forwarding the wrong participant is rejected — *unless the BFF also wrongly used the admin token.* Hence invariant #0 above.

**Admin token stays server-side.** Exactly one `--admin-token`, loaded from a secret manager into BFF process memory, never serialized to a cookie/JWT/browser. A **default-deny route → required-privilege table** (mirroring D-44/D-45: `create_world`, `fork_branch`, marker create, `time-skip`, world import/export, `end_campaign`, backfill/probe, `/usage`, raw event log / commit detail, claims+beliefs) is checked against the account's org role **before** any upstream call. Not authorized → 403 at the edge, token never moves. Authorized → BFF proxies with the admin token, injecting world/campaign scope **from the grant, never from a browser id**. Any unmapped route **fails closed** (never proxies as operator). Sessions are opaque + server-stored with roles re-read per request (no client-held claims to forge); the SPA holds **no bearer at all** — httpOnly + Secure + SameSite=Strict cookie only, so XSS has nothing to exfiltrate.

**Provisioning-time impersonation (the sharpest residual — closed explicitly).** The wire being locked down is not enough: participant ids are global strings, and minting for a participant requires the admin token (which bypasses `_scope`). So the BFF **generates a fresh, namespaced, unique participant id per grant** and *never* accepts a browser- or form-supplied one. "Adopt an existing participant" (e.g. a returning player, GM reassignment) is an explicit, audited, admin-only path with a uniqueness/ownership constraint on the grant table — not the default. Without this, an org-admin form supplying a participant id could mint a valid token for another user's PC. This is a design requirement, not a nicety.

**Honest scope limits.** (a) The engine has **one server-wide admin token**; "orgs" exist only in the BFF, so the engine enforces zero org isolation. A BFF compromise / SSRF to the private uro-server owns **every** tenant. True per-org isolation needs one uro-server per org (deferred; see open decisions). (b) Operator routes are **100% BFF-authz** — the engine can't tell "org-admin proxied" from "operator," so one missing role check = full omniscient/structural access. The route table must be exhaustively enumerated, default-deny, and tested. (c) Engine event attribution for **operator** actions collapses to the single operator identity; per-user forensics for those live in BFF logs. Player actions attribute correctly (distinct minted tokens).

## 2. Use of the D-39 campaign-scoped mint/revoke primitives

D-39 is used **as intended** — the BFF is exactly the "platform consumer building richer roles at its own layer" that D-39/D-44 anticipated; it invents no token storage of its own beyond an encrypted cache.

- **Mint.** On grant creation the BFF, holding the operator token, calls `POST /campaigns/{c}/join` (mint-on-join, which also seats the PC — the endpoint comments it "the blessed path to a LIVE credential") for the grant's freshly-generated participant, receiving a durable, `sha256`-at-rest, campaign-scoped token. (Standalone `POST /campaigns/{c}/tokens` 400s with "join first" when the participant has no PC — so join is the entry point — the standalone endpoint 400s `"participant has no PC on this campaign — join first"`.)
- **Custody.** Engine keeps only the hash; BFF caches the plaintext **encrypted at rest** (libsodium/KMS-envelope) keyed `(account, campaign)`. Raw player token lives only encrypted in the BFF and transiently in-process while proxying — never in the browser.
- **Revoke.** Grant removal / logout-all / role change → `POST /campaigns/{c}/tokens/revoke` then drop the cache row. Rotation = mint-new / revoke-old (note: `mint()` issues a **new** random token each call, so rotation **must** explicitly revoke the prior one or a stale token stays live).
- **BFF-owned lifecycle gaps (D-39 residuals, named).** D-39 has **no per-`(participant,campaign)` cap**, **no revoke-on-`end_campaign`/on-ungrant**, and **auth is checked once at WS accept** — so a revoked player keeps driving an *in-flight* upstream socket. The BFF therefore owns: a per-account token cap + GC, revoke-on-ungrant/logout, and **active force-close of its own upstream WS on revoke** (the engine won't drop it).
- **Prefer ephemeral where cheap.** For the play channel, consider **mint-on-connect / revoke-on-disconnect** rather than durable encrypted-at-rest per-grant tokens — smaller secret-at-rest surface, leans harder on D-39, sidesteps multiple-live-tokens bookkeeping. (Open decision.)
- **Requires a D-39-provisioned uro-server** — the token endpoints `501` unless the store-backed server has `mint_token` wired.

## 3. Incremental build plan (zero-BFF single-operator mode never breaks)

A client-side `VITE_AUTH_MODE=direct|bff` flag preserves today's paste-a-token, straight-to-engine path throughout. The BFF is deployed **only** in M6.

| Step | Ships | Trust state after |
|---|---|---|
| **0. Dual-mode flag** | `direct` keeps SPA→engine; `bff` targets `/api`. No new service. | Identical to today. |
| **1. Transparent same-origin proxy** | BFF stands up as a byte pass-through reverse proxy (SPA at `/`, API at `/api`, WS at `/ws`); proves deploy/cookie shape. Engine unchanged. | Identical to today. |
| **2. Move the token server-side + login** | Admin token loaded from env into the BFF; add accounts (argon2id, OIDC-`sub` seam) + opaque server-side sessions; SPA stops sending `Authorization`. Single operator logs in as `org_admin` — **identical UX, admin token off the wire.** | **Multi-user-authenticated, still single-privilege.** ⚠️ Every user is still proxied as operator; `_scope` bypassed. **Do not onboard untrusted/multi-org users before Step 3.** |
| **3. Grants + per-user D-39 player tokens (the crux)** | `campaign_grants` (participant id **BFF-generated**, unique-constrained) + mint-on-join + participant injection by re-serialization; play / dry-run / player-read paths switch to the **player** token. Invite a non-admin account, prove it cannot act as another PC nor reach operator routes. | **Crux live.** Players act only as their granted participant; impersonation closed on wire *and* at provisioning. |
| **4. Operator route table + revocation plumbing + WS relay** | Default-deny route→privilege table (fails closed on unmapped); D-39 revoke on ungrant/logout-all; force-close proxied WS on revoke; Origin/`Sec-Fetch-Site` check on the WS upgrade (not just SameSite). Ship M6. | **Safe multi-tenant.** |
| **5. (Optional) Harden identity/scale** | Swap password login for real OIDC (schema already anticipates `sub`); Redis sessions for multi-instance. | Enterprise-ready. |

The engine never changes across all steps. Steps 1–2 are a **trust-downgrade window** (operator-privilege for all authenticated users) — this is the one thing the "multi-user parity" framing must not hide: the crux only closes at Step 3, so multi-org onboarding is gated on Step 3+4.

## 4. Alternatives considered

| Approach | One-line shape | Why not (as the base) |
|---|---|---|
| **① Session-cookie BFF, per-grant D-39 player tokens, admin BFF-only** *(chosen)* | BFF owns accounts/orgs; injects a per-`(account,campaign)` D-39 player token; admin token gates operator routes at the edge. | **Chosen.** Best D-39 fit + real engine-side defense-in-depth; grafts crux mechanics from ③ and the "token-off-the-wire-first" step from ②/③/④. |
| **② OIDC-delegated token-vault BFF** | External IdP (Keycloak) owns accounts; BFF holds a `sub→participant` grant map + minted-token vault. | Correct and native to D-39, but heaviest for an *optional* PoC mode (IdP + session store + grants + minted cache + WS termination), and duplicates bindings the engine already owns. Kept as the identity **seam**, not the day-one build. |
| **③ Single-operator-token proxy + response re-gating** | One admin token for everything; down-redact omniscient responses to the player view by policy. | **Declines D-39** → forced to re-implement the engine's structural player redaction as fragile per-route/per-WS-frame policy; single-token = zero engine containment. Its crux mechanics (canonical re-serialize, URL-path campaign, seat selector) and sequencing are grafted in; its strategy is rejected. |
| **④ Stateless edge BFF (signed-cookie + D-39 vault)** | Edge middleware, signed-JWT cookie carries bindings, tokens in a KV vault. | Edge runtimes (e.g. Lambda@Edge) **can't host the WS play channel**, which is the actual product surface; "stateless" mischaracterizes real crown-jewel state; signed-cookie revocation is coarse. Its D-39 vault and operator-allowlist ideas overlap ①. |

## 5. Open decisions (with recommendations)

1. **Player token lifetime: durable per-grant vs ephemeral per-session?** → **Recommend ephemeral mint-on-connect / revoke-on-disconnect for the play channel**, durable-encrypted only where a long-lived REST token is genuinely needed. Smaller secret-at-rest surface; sidesteps the multiple-live-tokens-per-`(P,C)` bookkeeping and the WS-survives-revoke residual.
2. **PoC login: password (argon2id) or OIDC now?** → **Recommend argon2id for the PoC, OIDC-`sub` as a first-class nullable column from day one.** Keycloak is too much standing infrastructure for an opt-in mode; the seam makes the later swap a config change, not a migration.
3. **Binding source of truth: BFF grants table vs derive from engine `pc_seats`?** → **Recommend deriving the `(campaign, participant)` binding from the engine (queried with the operator token); keep the BFF table as a thin role/grant *overlay* only.** Avoids three-way drift with the engine's `PCBound` truth. The BFF still **generates** the participant id at grant time (see §1) — derivation is for validation/read, generation is for provisioning.
4. **Per-org isolation with one server-wide admin token?** → **Recommend accepting shared-server, BFF-enforced org boundaries for the PoC, documented as by-policy.** True isolation (one uro-server per org, or an engine-side per-org operator token) is out of scope until a real multi-org tenant needs it — the engine deliberately owns no org concept.
5. **Operator "act-as-player" debug feature?** → **Recommend NOT building it, and encoding "never pair admin token + body participant" as an explicit tested invariant.** This is the single reopening path for full impersonation; a lazy "admin token for everything" shortcut anywhere silently defeats §1.
6. **Session store: Postgres or Redis?** → **Recommend Postgres for the PoC** (one datastore, the account DB already exists); Redis only when Step 5 multi-instance demands it.
7. **CSRF + WS upgrade origin.** → **Recommend SameSite=Strict + double-submit `X-Loom-CSRF` on mutators AND an explicit `Origin`/`Sec-Fetch-Site` check on the WS upgrade** (CSWSH is not covered by SameSite alone on the socket handshake). Non-negotiable, listed here only to pin it in the record.

## Deferred / out of scope for the PoC (honest)

- Real per-org tenant isolation (needs per-org engine instances or an engine-side scoped operator token — engine won't change for the PoC).
- Enterprise SSO / MFA / account recovery (the OIDC seam exists; the integration is later).
- Per-user attribution of **operator** actions in the engine event log (collapses to the single operator identity; forensics for those live in BFF logs).
- Multi-instance horizontal scale (single BFF + Postgres sessions for the PoC; WS affinity to the single pinned uro-server is inherent — the engine holds in-process `SessionHub`/`PartyArbiter` state).
- A per-`(participant,campaign)` token cap in the engine (D-39 has none; the BFF caps and GCs).