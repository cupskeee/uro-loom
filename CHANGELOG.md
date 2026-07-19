# Changelog

All notable changes to Uro Loom are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/); this project will use SemVer once it ships code.

## [Unreleased]

### Added
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
