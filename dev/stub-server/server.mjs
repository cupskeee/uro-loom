// A zero-dependency stand-in for uro-server, so Loom is developable and testable
// without a full Uro instance (Postgres, migrations, a model). Response shapes are
// verified against the real uro-core models + projection SQL (see docs/02). Replace
// with a real `uro serve` for real data.

import { createServer } from 'node:http'
import { createHash } from 'node:crypto'

const PORT = Number(process.env.PORT ?? 8787)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  // The real uro-server allows all methods (CORSMiddleware allow_methods=["*"]); mirror that so the
  // browser doesn't block the /providers PATCH/PUT/DELETE preflight (D-47).
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
}

// ---- Sample data (matches the exact wire shapes) --------------------------------

const WORLDS = [
  { world_id: 'wld_ashfall', name: 'Ashfall', main_branch_id: 'br_ashfall_main' },
  { world_id: 'wld_thornwood', name: 'Thornwood', main_branch_id: 'br_thornwood_main' },
]

const CAMPAIGNS = [
  {
    campaign_id: 'cmp_ashfall',
    world_id: 'wld_ashfall',
    branch_id: 'br_ashfall_main',
    ruleset_id: 'uro-basic',
    ruleset_version: '1.0.0',
    seed: 42,
  },
  {
    campaign_id: 'cmp_thornwood',
    world_id: 'wld_thornwood',
    branch_id: 'br_thornwood_main',
    ruleset_id: 'uro-pbta',
    ruleset_version: '1.0.0',
    seed: 7,
  },
]

const ROSTER = {
  cmp_ashfall: { pcs: ['actor_wren'] },
}

const STATE = {
  cmp_ashfall: {
    branch_id: 'br_ashfall_main',
    state: {
      actors: [
        {
          actor_id: 'actor_kestrel',
          name: 'Kestrel',
          tier: 2,
          role: 'captain',
          aliases: ['the Gray Captain', 'Kes'],
          status: 'alive',
        },
        {
          actor_id: 'actor_doran',
          name: 'Doran Vale',
          tier: 1,
          role: '',
          aliases: [],
          status: 'dead',
        },
        {
          actor_id: 'actor_wren',
          name: 'Wren',
          tier: 0,
          role: 'adventurer',
          aliases: [],
          status: 'alive',
        },
      ],
      threads: [
        {
          thread_id: 'thread_border_war',
          stakes: 'The Ashfall border erupts into open war',
          state: 'active',
          provenance: 'author',
        },
        {
          thread_id: 'thread_missing_heir',
          stakes: 'The lost heir of House Vale may still live',
          state: 'dormant',
          provenance: 'ai_backfill',
        },
      ],
      places: [
        {
          place_id: 'place_vel',
          name: 'Vel',
          kind: 'settlement',
          status: 'destroyed',
          description: 'A river town, now a smoking crater.',
        },
        {
          place_id: 'place_ashfall_reach',
          name: 'The Ashfall Reach',
          kind: 'region',
          status: 'active',
          description: 'A wind-scoured borderland of black sand.',
        },
      ],
      factions: [
        {
          faction_id: 'faction_gray_watch',
          name: 'The Gray Watch',
          kind: 'faction',
          description: 'A mercenary company holding the eastern passes.',
        },
        {
          faction_id: 'faction_ember_cult',
          name: 'Church of the Ember',
          kind: 'religion',
          description: 'Fire-worshippers who foretold the meteor.',
        },
      ],
      // OMNISCIENT sections (operator-only, D-46). truth values + hidden beliefs.
      claims: [
        {
          claim_id: 'c:meteor',
          statement: 'the meteor will fall on Vel',
          subject_refs: ['place_vel'],
          truth: 'true',
          origin: 'narrator',
          created_day: 8,
        },
        {
          claim_id: 'c:heir',
          statement: 'the lost heir of House Vale still lives',
          subject_refs: ['actor_doran'],
          truth: 'unknown',
          origin: 'testimony',
          created_day: 5,
        },
        {
          claim_id: 'c:traitor',
          statement: 'Kestrel betrayed the Gray Watch',
          subject_refs: ['actor_kestrel'],
          truth: 'false',
          origin: 'testimony',
          created_day: 10,
        },
      ],
      beliefs: [
        {
          actor_id: 'actor_kestrel',
          claim_id: 'c:meteor',
          confidence: 0.9,
          learned_from: 'actor_elder',
        },
        {
          actor_id: 'actor_wren',
          claim_id: 'c:meteor',
          confidence: 0.5,
          learned_from: 'actor_kestrel',
        },
        { actor_id: 'actor_wren', claim_id: 'c:heir', confidence: 0.3, learned_from: null },
      ],
    },
  },
}

const CHRONICLE = {
  cmp_ashfall: {
    beats: [
      {
        v: 1,
        beat_id: 'beat_0001',
        participant_id: 'participant_wren',
        intent_text: 'I push open the tavern door and scan the room for the hooded stranger.',
        narration:
          "The Broken Spindle's door groans on its hinge. Smoke and lamplight swallow you as heads turn; in the far booth, a hooded figure lowers a tin cup and watches you over its rim.",
        synopsis: '',
      },
      {
        v: 1,
        beat_id: 'beat_0002',
        participant_id: 'participant_wren',
        intent_text: 'I sit across from the stranger and ask what they know about the caravan.',
        narration:
          'You slide onto the bench opposite. "The caravan never reached Vel," the stranger says, voice like gravel. "Ask the crows on the east road what they feasted on."',
        synopsis: '',
      },
    ],
  },
}

const emptyState = (branchId) => ({
  branch_id: branchId,
  state: { actors: [], threads: [], places: [], factions: [] },
})

// ---- M4 timelines: branches, markers, per-branch commit logs -------------------

const BRANCHES = {
  wld_ashfall: [
    {
      branch_id: 'br_ashfall_main',
      world_id: 'wld_ashfall',
      name: 'main',
      head_commit: 'cmt_a5',
      forked_from: null,
      head_depth: 5,
      world_day: 12,
    },
    {
      branch_id: 'br_ashfall_whatif',
      world_id: 'wld_ashfall',
      name: 'what-if-vel-stands',
      head_commit: 'cmt_a3',
      forked_from: 'cmt_a3',
      head_depth: 3,
      world_day: 8,
    },
  ],
  wld_thornwood: [
    {
      branch_id: 'br_thornwood_main',
      world_id: 'wld_thornwood',
      name: 'main',
      head_commit: 'cmt_t1',
      forked_from: null,
      head_depth: 1,
      world_day: 0,
    },
  ],
}

const MARKERS = {
  wld_ashfall: [
    { marker_id: 'mk_prestrike', world_id: 'wld_ashfall', name: 'pre-strike', commit_id: 'cmt_a3' },
  ],
  wld_thornwood: [],
}

// keyed by branch_id; head→genesis order (matches the real `uro log` view)
const LOG = {
  br_ashfall_main: [
    {
      commit_id: 'cmt_a5',
      depth: 5,
      event_types: ['BeatResolved', 'PlaceDestroyed'],
      summary: 'the meteor strikes Vel',
      markers: [],
    },
    {
      commit_id: 'cmt_a4',
      depth: 4,
      event_types: ['BeatResolved'],
      summary: 'the wizard climbs the spire',
      markers: [],
    },
    {
      commit_id: 'cmt_a3',
      depth: 3,
      event_types: ['BeatResolved', 'ClaimRecorded'],
      summary: 'a warning is spoken',
      markers: ['pre-strike'],
    },
    {
      commit_id: 'cmt_a2',
      depth: 2,
      event_types: ['BeatResolved'],
      summary: 'the road to Vel',
      markers: [],
    },
    {
      commit_id: 'cmt_a1',
      depth: 1,
      event_types: ['CampaignStarted', 'PCBound'],
      summary: 'campaign begins',
      markers: [],
    },
    {
      commit_id: 'cmt_a0',
      depth: 0,
      event_types: ['WorldGenesis'],
      summary: 'world genesis',
      markers: [],
    },
  ],
  br_ashfall_whatif: [
    {
      commit_id: 'cmt_a3',
      depth: 3,
      event_types: ['BeatResolved', 'ClaimRecorded'],
      summary: 'a warning is spoken',
      markers: ['pre-strike'],
    },
    {
      commit_id: 'cmt_a2',
      depth: 2,
      event_types: ['BeatResolved'],
      summary: 'the road to Vel',
      markers: [],
    },
    {
      commit_id: 'cmt_a1',
      depth: 1,
      event_types: ['CampaignStarted', 'PCBound'],
      summary: 'campaign begins',
      markers: [],
    },
    {
      commit_id: 'cmt_a0',
      depth: 0,
      event_types: ['WorldGenesis'],
      summary: 'world genesis',
      markers: [],
    },
  ],
  br_thornwood_main: [
    {
      commit_id: 'cmt_t1',
      depth: 1,
      event_types: ['WorldGenesis'],
      summary: 'world genesis',
      markers: [],
    },
  ],
}

// M5 slice 3: participant codex notes, keyed by `${campaignId}:${participant}` (fork-surviving,
// self-or-admin). The stub treats the token as the participant identity.
const CODEX = {}

// Per-commit raw events (the OMNISCIENT log — operator-only, D-45). Keyed by commit_id;
// the events-along-a-branch view flattens these over the branch's lineage.
const COMMIT_EVENTS = {
  cmt_a5: {
    parent_id: 'cmt_a4',
    depth: 5,
    events: [
      {
        event_id: 'ev_a5_0',
        seq: 0,
        event_type: 'BeatResolved',
        entity_refs: ['a:wizard'],
        world_time: { day: 12, segment: 'evening' },
        caused_by: { kind: 'player_action', participant_id: 'player-1' },
        payload: {
          intent_text: 'call down the meteor',
          narration: 'The sky splits and fire falls on Vel.',
        },
      },
      {
        event_id: 'ev_a5_1',
        seq: 1,
        event_type: 'PlaceDestroyed',
        entity_refs: ['p:vel'],
        world_time: { day: 12, segment: 'evening' },
        caused_by: { kind: 'narrator' },
        payload: { place_id: 'p:vel' },
      },
    ],
  },
  cmt_a4: {
    parent_id: 'cmt_a3',
    depth: 4,
    events: [
      {
        event_id: 'ev_a4_0',
        seq: 0,
        event_type: 'BeatResolved',
        entity_refs: ['a:wizard'],
        world_time: { day: 10, segment: 'night' },
        caused_by: { kind: 'player_action' },
        payload: { intent_text: 'climb the spire' },
      },
    ],
  },
  cmt_a3: {
    parent_id: 'cmt_a2',
    depth: 3,
    events: [
      {
        event_id: 'ev_a3_0',
        seq: 0,
        event_type: 'BeatResolved',
        entity_refs: ['a:elder'],
        world_time: { day: 8, segment: 'morning' },
        caused_by: { kind: 'player_action' },
        payload: { intent_text: 'ask the elder about the omen' },
      },
      {
        event_id: 'ev_a3_1',
        seq: 1,
        event_type: 'ClaimRecorded',
        entity_refs: ['a:elder', 'p:vel'],
        world_time: { day: 8, segment: 'morning' },
        caused_by: { kind: 'narrator' },
        payload: { statement: 'the meteor will fall on Vel', truth: 'true', origin: 'narrator' },
      },
    ],
  },
  cmt_a2: {
    parent_id: 'cmt_a1',
    depth: 2,
    events: [
      {
        event_id: 'ev_a2_0',
        seq: 0,
        event_type: 'BeatResolved',
        entity_refs: [],
        world_time: { day: 5, segment: 'afternoon' },
        caused_by: { kind: 'player_action' },
        payload: { intent_text: 'take the road to Vel' },
      },
    ],
  },
  cmt_a1: {
    parent_id: 'cmt_a0',
    depth: 1,
    events: [
      {
        event_id: 'ev_a1_0',
        seq: 0,
        event_type: 'CampaignStarted',
        entity_refs: ['cmp_ashfall'],
        world_time: { day: 0 },
        caused_by: { kind: 'system' },
        payload: {},
      },
      {
        event_id: 'ev_a1_1',
        seq: 1,
        event_type: 'PCBound',
        entity_refs: ['a:wizard'],
        world_time: { day: 0 },
        caused_by: { kind: 'system' },
        payload: { participant_id: 'player-1' },
      },
    ],
  },
  cmt_a0: {
    parent_id: null,
    depth: 0,
    events: [
      {
        event_id: 'ev_a0_0',
        seq: 0,
        event_type: 'WorldGenesis',
        entity_refs: [],
        world_time: { day: 0 },
        caused_by: { kind: 'system' },
        payload: { world_name: 'Ashfall', tone: ['grim'] },
      },
    ],
  },
  cmt_t1: {
    parent_id: null,
    depth: 1,
    events: [
      {
        event_id: 'ev_t1_0',
        seq: 0,
        event_type: 'WorldGenesis',
        entity_refs: [],
        world_time: { day: 0 },
        caused_by: { kind: 'system' },
        payload: { world_name: 'Thornwood' },
      },
    ],
  },
}

// Dev convention: a "player*"/"pleb*" token is a plain player (→ 403 on operator
// writes, so the 403 UX is demoable); any other token is treated as an operator so
// the happy path works out of the box. The real server gates on `is_admin` (D-44).
function isOperator(token) {
  return !/^(player|pleb)/i.test(String(token || ''))
}

// M6: the model-connection registry (D-47). In-memory, mirroring the real server: operator-only,
// no read returns a secret, deleting a credential UNLINKS connections, deleting a connection
// cascades its role bindings. No real crypto — the stub keeps the secret aside and never returns it.
const REGISTRY = { connections: {}, credentials: {}, roles: {}, secrets: {}, n: 0 }
const REGISTRY_ROLES = new Set([
  'default',
  'narrator',
  'extractor',
  'planner',
  'embedder',
  'dialogue',
  'judge',
])
const regId = (prefix) => `${prefix}_${(REGISTRY.n += 1).toString().padStart(3, '0')}`

// Canned discovery results per provider (slice 3) — the stub can't call a real provider.
const CANNED_MODELS = {
  openai: [
    { id: 'gpt-4o', modality: 'chat' },
    { id: 'gpt-4o-mini', modality: 'chat' },
    { id: 'text-embedding-3-small', modality: 'embedding' },
  ],
  anthropic: [
    { id: 'claude-sonnet-5', modality: 'chat' },
    { id: 'claude-opus-4-8', modality: 'chat' },
  ],
  local: [
    { id: 'llama3.1', modality: 'chat' },
    { id: 'nomic-embed-text', modality: 'embedding' },
  ],
  stub: [
    { id: 'stub-chat', modality: 'chat' },
    { id: 'stub-embed', modality: 'embedding' },
  ],
}

// Mirror the server's classify_modality (slice 3): per-adapter, no universal is_embedding flag.
function classifyModality(provider, modelId) {
  const m = String(modelId || '').toLowerCase()
  if (provider === 'anthropic') return 'chat'
  if (['openai', 'openai_compat', 'local', 'stub'].includes(provider))
    return m.includes('embed') ? 'embedding' : 'chat'
  return 'unknown'
}

function handleProviders(method, p, body, res, token) {
  if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
  const parts = p.split('/').filter(Boolean) // ['providers', ...]

  // POST /providers/reload (slice 4) — rebind the router; reloaded iff the registry has bindings.
  if (parts.length === 2 && parts[1] === 'reload' && method === 'POST') {
    // Mirror build_router_from_registry: a binding counts only if its connection exists AND is enabled.
    const has = Object.values(REGISTRY.roles).some((rb) => {
      const c = REGISTRY.connections[rb.connection_id]
      return !!c && c.is_enabled
    })
    return send(res, 200, {
      reloaded: has,
      detail: has ? undefined : 'registry has no bindings; router unchanged',
    })
  }

  // POST /providers/{id}/refresh | /test (slice 3)
  if (parts.length === 3 && method === 'POST' && (parts[2] === 'refresh' || parts[2] === 'test')) {
    const conn = REGISTRY.connections[parts[1]]
    if (!conn) return send(res, 404, { detail: 'no such connection' })
    if (parts[2] === 'refresh') {
      const models = CANNED_MODELS[conn.provider] ?? []
      conn.cached_models = models // so the snapshot's model pickers populate
      return send(res, 200, { models })
    }
    return send(res, 200, { ok: true, detail: `${conn.provider} responded` }) // test probe
  }

  // /providers
  if (parts.length === 1) {
    if (method === 'GET') {
      return send(res, 200, {
        connections: Object.values(REGISTRY.connections),
        roles: Object.values(REGISTRY.roles),
        credentials: Object.values(REGISTRY.credentials),
      })
    }
    if (method === 'POST') {
      if (!body.name || !body.provider)
        return send(res, 400, { detail: 'name + provider required' })
      if (body.auth_id && !REGISTRY.credentials[body.auth_id])
        return send(res, 400, { detail: `no such credential: ${body.auth_id}` })
      const id = regId('conn')
      REGISTRY.connections[id] = {
        id,
        name: body.name,
        provider: body.provider,
        base_url: body.base_url ?? null,
        auth_id: body.auth_id ?? null,
        is_enabled: true,
        cached_models: null,
      }
      return send(res, 200, { id })
    }
  }

  // /providers/credentials[/{id}]
  if (parts[1] === 'credentials') {
    if (parts.length === 2 && method === 'POST') {
      if (!body.provider) return send(res, 400, { detail: 'provider required' })
      const id = regId('cred')
      REGISTRY.credentials[id] = {
        id,
        provider: body.provider,
        auth_mode: body.auth_mode || 'api_key',
        has_access_token: body.access_token != null,
        has_refresh_token: false,
        last_refresh: null,
      }
      if (body.access_token != null) REGISTRY.secrets[id] = body.access_token // never returned
      return send(res, 200, { id })
    }
    if (parts.length === 3 && method === 'DELETE') {
      const id = parts[2]
      const existed = id in REGISTRY.credentials
      delete REGISTRY.credentials[id]
      delete REGISTRY.secrets[id]
      for (const c of Object.values(REGISTRY.connections)) if (c.auth_id === id) c.auth_id = null // unlink
      return send(res, 200, { deleted: existed })
    }
  }

  // /providers/roles/{role}
  if (parts[1] === 'roles' && parts.length === 3) {
    const role = decodeURIComponent(parts[2])
    if (method === 'PUT') {
      if (!REGISTRY_ROLES.has(role)) return send(res, 400, { detail: `unknown role ${role}` })
      const conn = REGISTRY.connections[body.connection_id]
      if (!conn) return send(res, 400, { detail: `no such connection: ${body.connection_id}` })
      const model = String(body.model || '').trim()
      if (!model) return send(res, 400, { detail: 'model must not be empty' }) // mirror the server
      // Mirror slice-3 embedder-modality validation: the embedder role needs an embedding model.
      if (role === 'embedder' && classifyModality(conn.provider, model) === 'chat') {
        return send(res, 400, {
          detail: `the embedder role needs an embedding model, not '${model}' (a chat model on provider '${conn.provider}')`,
        })
      }
      REGISTRY.roles[role] = { role, connection_id: body.connection_id, model }
      return send(res, 200, { role, connection_id: body.connection_id })
    }
    if (method === 'DELETE') {
      const existed = role in REGISTRY.roles
      delete REGISTRY.roles[role]
      return send(res, 200, { deleted: existed })
    }
  }

  // /providers/{id}
  if (parts.length === 2) {
    const id = parts[1]
    if (method === 'PATCH') {
      const c = REGISTRY.connections[id]
      if (!c) return send(res, 404, { detail: 'no such connection' })
      if (body.is_enabled == null) return send(res, 400, { detail: 'nothing to update' })
      c.is_enabled = !!body.is_enabled
      return send(res, 200, { updated: true })
    }
    if (method === 'DELETE') {
      const existed = id in REGISTRY.connections
      delete REGISTRY.connections[id]
      for (const r of Object.keys(REGISTRY.roles))
        if (REGISTRY.roles[r].connection_id === id) delete REGISTRY.roles[r] // cascade
      return send(res, 200, { deleted: existed })
    }
  }

  return send(res, 404, { detail: 'not found' })
}

// Mirror the real server's `_campaign_view`: `seed` is GM data, stripped for a player token. Keeping
// the stub faithful is what lets the e2e catch a client that assumes `seed` is always present.
function campaignView(campaign, token) {
  if (isOperator(token)) return campaign
  const view = { ...campaign }
  delete view.seed
  return view
}

function commitDepth(worldId, commitId) {
  for (const b of BRANCHES[worldId] ?? []) {
    const hit = (LOG[b.branch_id] ?? []).find((c) => c.commit_id === commitId)
    if (hit) return hit.depth
  }
  return null
}

// ---- HTTP -----------------------------------------------------------------------

function send(res, status, obj) {
  const body = obj === undefined ? '' : JSON.stringify(obj)
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS })
  res.end(body)
}

function tokenFrom(req, url) {
  const header = req.headers['authorization']
  if (typeof header === 'string' && /^Bearer\s+/i.test(header)) {
    return header.replace(/^Bearer\s+/i, '').trim()
  }
  return url.searchParams.get('token')
}

let idCounter = 0
function nextId(prefix) {
  idCounter += 1
  return `${prefix}_${idCounter}`
}
function slug(s) {
  const out = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return out || 'x'
}

// M5: pack-upload authoring (multipart). The stub returns canned results without parsing the
// .zip — validate is any-authed; backfill/probe are operator-only (a player* token → 403).
function handlePackUpload(p, url, res, token) {
  if (p === '/worlds/validate') {
    return send(res, 200, {
      name: 'Thornwood',
      grade: 'thin',
      counts: { places: 3, actors: 3, factions: 1, threads: 0 },
      dimensions: [
        { name: 'geography', ok: true, detail: '3 places' },
        { name: 'population', ok: true, detail: '3 actors' },
        {
          name: 'conflict',
          ok: false,
          detail: 'no conflict seeds found — campaigns will open aimless',
        },
      ],
      ruleset_id: 'uro-basic',
      ruleset_ok: true,
      gaps: ['no conflict seeds found — campaigns will open aimless'],
    })
  }
  if (p === '/worlds/backfill') {
    if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
    return send(res, 200, {
      name: 'Thornwood',
      before_grade: 'thin',
      after_grade: 'runnable',
      added: ['conflict seed (ai_backfill): a rival house covets the throne'],
      seeds: [
        {
          id: 't:ai',
          stakes: 'a rival house covets the throne',
          state: 'offered',
          provenance: 'ai_backfill',
        },
      ],
    })
  }
  if (p === '/worlds/probe') {
    if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
    const tries = Number(url.searchParams.get('tries') || 3)
    return send(res, 200, {
      world: 'Thornwood',
      results: [
        {
          name: 'structured_output',
          status: 'pass',
          detail: `${tries}/${tries} schema-valid`,
          gate_for: 'planner',
          transcripts: [],
        },
        {
          name: 'content_rating',
          status: 'warn',
          detail: 'model softened a category',
          gate_for: 'narrator',
          transcripts: [],
        },
      ],
      ok: true,
      warnings: ['content_rating: model softened a category'],
    })
  }
  return send(res, 404, { detail: 'not found' })
}

// Write endpoints (M3 + M4). Mutations are in-memory and live for the process lifetime.
function handlePost(p, body, res, token) {
  // M5 slice 2: import a world bundle (OPERATOR-only, D-44). The real server recomputes the
  // SHA-256 chain; the stub models the outcome — a malformed or tampered bundle → 400 before
  // any write, else a fresh remapped world.
  if (p === '/worlds/import') {
    if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
    if (!body || typeof body.world_name !== 'string')
      return send(res, 400, { detail: 'malformed bundle: missing world_name' })
    if (body.world_name === 'TAMPERED')
      return send(res, 400, {
        detail: 'bundle failed verification — the world name or chain was altered in transit',
      })
    const world = {
      world_id: nextId('wld_imported'),
      name: body.world_name,
      main_branch_id: nextId('br'),
    }
    WORLDS.push(world)
    return send(res, 200, world)
  }

  // M5 slice 3: end a campaign (OPERATOR-only, D-44) → the closing marker.
  const mend = p.match(/^\/campaigns\/([^/]+)\/end$/)
  if (mend) {
    const id = decodeURIComponent(mend[1])
    const campaign = CAMPAIGNS.find((c) => c.campaign_id === id)
    if (!campaign) return send(res, 404, { detail: 'no such campaign' })
    if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
    if (!body.marker) return send(res, 400, { detail: "missing required field 'marker'" })
    return send(res, 200, {
      marker_id: nextId('mk'),
      world_id: campaign.world_id,
      name: String(body.marker),
      commit_id: BRANCHES[campaign.world_id]?.[0]?.head_commit ?? 'cmt_end',
    })
  }

  // M5 slice 3: add a codex note (self-or-admin, D-39; fork-surviving, never canon).
  const mcxp = p.match(/^\/campaigns\/([^/]+)\/codex$/)
  if (mcxp) {
    const id = decodeURIComponent(mcxp[1])
    if (!CAMPAIGNS.find((c) => c.campaign_id === id))
      return send(res, 404, { detail: 'no such campaign' })
    const target = body.participant || token
    if (target !== token && !isOperator(token))
      return send(res, 403, { detail: 'can only write your own codex (or as operator)' })
    if (!body.text) return send(res, 400, { detail: "missing required field 'text'" })
    const key = body.key || nextId('note')
    const list = CODEX[`${id}:${target}`] ?? (CODEX[`${id}:${target}`] = [])
    list.push({
      key,
      text: String(body.text),
      pinned: !!body.pinned,
      entity_refs: body.refs || [],
    })
    return send(res, 200, { participant: target, key })
  }

  // M4 slice 4: dry-run a beat (any-authed; commits NOTHING).
  const mdr = p.match(/^\/campaigns\/([^/]+)\/dry-run$/)
  if (mdr) {
    const id = decodeURIComponent(mdr[1])
    if (!CAMPAIGNS.find((c) => c.campaign_id === id))
      return send(res, 404, { detail: 'no such campaign' })
    const intent = String(body.intent || '').trim()
    if (!intent) return send(res, 400, { detail: 'intent must be non-empty' })
    const events = [
      {
        event_id: 'ev_dry_0',
        event_type: 'BeatResolved',
        entity_refs: ['actor_wren'],
        world_time: { day: 12, segment: 'evening' },
        caused_by: { kind: 'player_action' },
        payload: { intent_text: intent, narration: 'The room holds its breath as you act.' },
      },
      {
        event_id: 'ev_dry_1',
        event_type: 'ClaimRecorded',
        entity_refs: ['actor_wren'],
        world_time: { day: 12, segment: 'evening' },
        caused_by: { kind: 'narrator' },
        payload: { statement: 'a bold move was made', truth: 'true', origin: 'narrator' },
      },
    ]
    return send(res, 200, { events })
  }

  // M4: fork a branch (operator-only, D-44).
  const mf = p.match(/^\/worlds\/([^/]+)\/branches$/)
  if (mf) {
    const wid = decodeURIComponent(mf[1])
    if (!WORLDS.find((w) => w.world_id === wid)) return send(res, 404, { detail: 'no such world' })
    if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
    if (!body.from_ref) return send(res, 400, { detail: "missing required field 'from_ref'" })
    if (!body.name) return send(res, 400, { detail: "missing required field 'name'" })
    const branches = BRANCHES[wid] ?? (BRANCHES[wid] = [])
    if (branches.find((b) => b.name === body.name))
      return send(res, 400, { detail: `branch ${body.name} already exists in this world` })
    const marker = (MARKERS[wid] ?? []).find((mk) => mk.name === body.from_ref)
    const forkCommit = marker ? marker.commit_id : body.from_ref // markers win on collision
    const depth = commitDepth(wid, forkCommit)
    if (depth == null) return send(res, 400, { detail: `unknown ref: ${body.from_ref}` })
    const days = Number(body.time_skip_days || 0)
    const nb = {
      branch_id: nextId('br'),
      world_id: wid,
      name: String(body.name),
      head_commit: forkCommit,
      forked_from: forkCommit,
      head_depth: depth + (days > 0 ? 1 : 0),
      world_day: days > 0 ? days : depth * 2,
    }
    branches.push(nb)
    // the fork shares history up to the fork point (copy-on-fork)
    const srcLog = LOG[branches[0].branch_id] ?? []
    LOG[nb.branch_id] = srcLog.filter((c) => c.depth <= depth)
    const result = {
      branch_id: nb.branch_id,
      world_id: wid,
      name: nb.name,
      head_commit: nb.head_commit,
      forked_from: nb.forked_from,
    }
    if (days > 0) result.world_day = days
    return send(res, 200, result)
  }

  // M4: name a branch head with a marker (operator-only, D-44).
  const mm = p.match(/^\/worlds\/([^/]+)\/markers$/)
  if (mm) {
    const wid = decodeURIComponent(mm[1])
    if (!WORLDS.find((w) => w.world_id === wid)) return send(res, 404, { detail: 'no such world' })
    if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
    if (!body.name) return send(res, 400, { detail: "missing required field 'name'" })
    const branchName = String(body.branch || 'main')
    const b = (BRANCHES[wid] ?? []).find((x) => x.name === branchName)
    if (!b) return send(res, 404, { detail: `no such branch: ${branchName}` })
    const markers = MARKERS[wid] ?? (MARKERS[wid] = [])
    if (markers.find((mk) => mk.name === body.name))
      return send(res, 400, { detail: `marker ${body.name} already exists in this world` })
    const marker = {
      marker_id: nextId('mk'),
      world_id: wid,
      name: String(body.name),
      commit_id: b.head_commit,
    }
    markers.push(marker)
    const log = LOG[b.branch_id]
    if (log && log[0]) log[0].markers = [...new Set([...log[0].markers, marker.name])]
    return send(res, 200, marker)
  }

  if (p === '/worlds') {
    if (!body.name) return send(res, 400, { detail: "missing required field 'name'" })
    const world = {
      world_id: `wld_${slug(body.name)}`,
      name: String(body.name),
      main_branch_id: `br_${slug(body.name)}_main`,
    }
    if (!WORLDS.find((w) => w.world_id === world.world_id)) WORLDS.push(world)
    return send(res, 200, world)
  }

  let m = p.match(/^\/worlds\/([^/]+)\/campaigns$/)
  if (m) {
    const world = WORLDS.find((w) => w.world_id === decodeURIComponent(m[1]))
    if (!world) return send(res, 404, { detail: 'no such world' })
    if (!body.participant) return send(res, 400, { detail: "missing required field 'participant'" })
    const campaign = {
      campaign_id: nextId('cmp'),
      world_id: world.world_id,
      branch_id: world.main_branch_id,
      ruleset_id: '',
      ruleset_version: '',
      seed: Number(body.seed) || 0,
    }
    CAMPAIGNS.push(campaign)
    return send(res, 200, { campaign_id: campaign.campaign_id, branch_id: campaign.branch_id })
  }

  m = p.match(/^\/campaigns\/([^/]+)\/join$/)
  if (m) {
    if (!body.participant) return send(res, 400, { detail: "missing required field 'participant'" })
    return send(res, 200, { actor_id: `actor_${slug(body.participant)}`, token: nextId('tok') })
  }

  m = p.match(/^\/campaigns\/([^/]+)\/tokens\/revoke$/)
  if (m) {
    if (!body.token) return send(res, 400, { detail: "missing required field 'token'" })
    return send(res, 200, { revoked: true })
  }

  m = p.match(/^\/campaigns\/([^/]+)\/tokens$/)
  if (m) {
    if (!body.participant) return send(res, 400, { detail: "missing required field 'participant'" })
    return send(res, 200, { token: nextId('tok') })
  }

  m = p.match(/^\/campaigns\/([^/]+)\/time-skip$/)
  if (m) {
    const days = Number(body.days)
    if (!Number.isInteger(days) || days <= 0) {
      return send(res, 400, { detail: 'days must be a positive integer' })
    }
    return send(res, 200, { day: days, agenda_rules_fired: 0 })
  }

  m = p.match(/^\/campaigns\/([^/]+)\/encounters\/([^/]+)\/outcome$/)
  if (m) {
    const casualties = Array.isArray(body.casualties) ? body.casualties : []
    const feats = Array.isArray(body.feats) ? body.feats : []
    const receipt = [
      ...casualties.map((ref) => ({ kind: 'casualty', ref, disposition: 'downgraded' })),
      ...feats.map((f) => ({ kind: 'feat', ref: f.actor, disposition: 'applied' })),
    ]
    return send(res, 200, {
      encounter_id: decodeURIComponent(m[2]),
      commit_id: nextId('cmt'),
      committed_events: receipt.length,
      receipt,
    })
  }

  return send(res, 404, { detail: 'not found' })
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }

  const url = new URL(req.url, `http://${req.headers.host}`)
  const p = url.pathname

  // Open endpoints (no auth), matching uro-server's `/healthz`.
  if (p === '/healthz') return send(res, 200, { status: 'ok' })
  if (p === '/version') return send(res, 200, { engineVersion: '0.2.0-stub', apiVersion: '0' })

  // Everything else requires a bearer token → 401 otherwise (mirrors `_auth`).
  const token = tokenFrom(req, url)
  if (!token) return send(res, 401, { detail: 'unauthorized' })

  // M6: model-connection registry (D-47) — every method, operator-only. Handled BEFORE the generic
  // POST block so PATCH/PUT/DELETE reach it (the real server's /providers surface).
  if (p === '/providers' || p.startsWith('/providers/')) {
    if (req.method === 'GET' || req.method === 'DELETE') {
      return handleProviders(req.method, p, null, res, token)
    }
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      let body
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      } catch {
        return send(res, 400, { detail: 'invalid json' })
      }
      handleProviders(req.method, p, body, res, token)
    })
    return
  }

  if (req.method === 'POST') {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      // M5: the pack-upload routes are multipart — consume the body, don't JSON-parse it
      // (the stub returns canned results without parsing the .zip; the real server parses).
      if (/^\/worlds\/(validate|backfill|probe)$/.test(p)) {
        return handlePackUpload(p, url, res, token)
      }
      let body
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      } catch {
        return send(res, 400, { detail: 'invalid json' })
      }
      handlePost(p, body, res, token)
    })
    return
  }

  if (req.method === 'GET' && p === '/worlds') return send(res, 200, WORLDS)

  // M4: GET /worlds/{w}/branches → { branches, markers }.
  const mb = p.match(/^\/worlds\/([^/]+)\/branches$/)
  if (req.method === 'GET' && mb) {
    const wid = decodeURIComponent(mb[1])
    if (!WORLDS.find((w) => w.world_id === wid)) return send(res, 404, { detail: 'no such world' })
    return send(res, 200, { branches: BRANCHES[wid] ?? [], markers: MARKERS[wid] ?? [] })
  }

  // M5 slice 2: GET /worlds/{w}/export → a hash-chained bundle. OPERATOR-only (D-45).
  const mex = p.match(/^\/worlds\/([^/]+)\/export$/)
  if (req.method === 'GET' && mex) {
    const wid = decodeURIComponent(mex[1])
    const world = WORLDS.find((w) => w.world_id === wid)
    if (!world) return send(res, 404, { detail: 'no such world' })
    if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
    return send(res, 200, {
      world_name: world.name,
      commits: (LOG[BRANCHES[wid]?.[0]?.branch_id] ?? []).map((c) => ({
        commit_id: c.commit_id,
        depth: c.depth,
      })),
      branches: (BRANCHES[wid] ?? []).map((b) => ({ branch_id: b.branch_id, name: b.name })),
      markers: MARKERS[wid] ?? [],
      manifest_hash: `h_${wid}`,
    })
  }

  // M4: GET /worlds/{w}/log[?branch=&limit=] → { branch, head_depth, entries } (head→genesis).
  // NOTE: the field is `entries`, matching the REAL uro-server — a prior `commits` drift here let
  // the client read `d.commits` (undefined) and crash the timeline; the stub must mirror reality.
  const ml = p.match(/^\/worlds\/([^/]+)\/log$/)
  if (req.method === 'GET' && ml) {
    const wid = decodeURIComponent(ml[1])
    if (!WORLDS.find((w) => w.world_id === wid)) return send(res, 404, { detail: 'no such world' })
    const branchName = url.searchParams.get('branch') || 'main'
    const b = (BRANCHES[wid] ?? []).find((x) => x.name === branchName)
    if (!b) return send(res, 404, { detail: `no such branch: ${branchName}` })
    const lim = url.searchParams.get('limit')
    if (lim != null && !/^-?\d+$/.test(lim))
      return send(res, 400, { detail: 'limit must be an integer' })
    if (lim != null && Number(lim) < 0)
      return send(res, 400, { detail: 'limit must not be negative' })
    let entries = LOG[b.branch_id] ?? []
    if (lim != null) entries = entries.slice(0, Number(lim))
    return send(res, 200, { branch: branchName, head_depth: b.head_depth ?? 0, entries })
  }

  // M4 slice 2: GET /worlds/{w}/events (raw log, filterable) — OPERATOR-only (D-45).
  const mev = p.match(/^\/worlds\/([^/]+)\/events$/)
  if (req.method === 'GET' && mev) {
    const wid = decodeURIComponent(mev[1])
    if (!WORLDS.find((w) => w.world_id === wid)) return send(res, 404, { detail: 'no such world' })
    if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
    const branchName = url.searchParams.get('branch') || 'main'
    const b = (BRANCHES[wid] ?? []).find((x) => x.name === branchName)
    if (!b) return send(res, 404, { detail: `no such branch: ${branchName}` })
    const lim = url.searchParams.get('limit')
    if (lim != null && !/^-?\d+$/.test(lim))
      return send(res, 400, { detail: 'limit must be an integer' })
    if (lim != null && Number(lim) < 0)
      return send(res, 400, { detail: 'limit must not be negative' })
    let events = (LOG[b.branch_id] ?? []).flatMap((c) => COMMIT_EVENTS[c.commit_id]?.events ?? [])
    const type = url.searchParams.get('type')
    if (type) events = events.filter((e) => e.event_type === type)
    const entity = url.searchParams.get('entity_ref')
    if (entity) events = events.filter((e) => e.entity_refs.includes(entity))
    const cause = url.searchParams.get('caused_by')
    if (cause) events = events.filter((e) => e.caused_by.kind === cause)
    events = events.slice(0, lim != null ? Number(lim) : 50)
    return send(res, 200, { branch: branchName, events })
  }

  // M4 slice 2: GET /worlds/{w}/commits/{id} — one commit's events. OPERATOR-only (D-45).
  const mcd = p.match(/^\/worlds\/([^/]+)\/commits\/([^/]+)$/)
  if (req.method === 'GET' && mcd) {
    const wid = decodeURIComponent(mcd[1])
    if (!WORLDS.find((w) => w.world_id === wid)) return send(res, 404, { detail: 'no such world' })
    if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
    const cid = decodeURIComponent(mcd[2])
    const ce = COMMIT_EVENTS[cid]
    if (!ce) return send(res, 404, { detail: 'no such commit' })
    return send(res, 200, {
      commit_id: cid,
      parent_id: ce.parent_id,
      depth: ce.depth,
      commit_hash: `h_${cid}`,
      events: ce.events,
    })
  }

  if (req.method === 'GET' && p === '/campaigns') {
    const wid = url.searchParams.get('world_id')
    const list = wid ? CAMPAIGNS.filter((c) => c.world_id === wid) : CAMPAIGNS
    return send(
      res,
      200,
      list.map((c) => campaignView(c, token)),
    )
  }

  const m = p.match(/^\/campaigns\/([^/]+)(?:\/(roster|state|chronicle))?$/)
  if (req.method === 'GET' && m) {
    const id = decodeURIComponent(m[1])
    const sub = m[2]
    const campaign = CAMPAIGNS.find((c) => c.campaign_id === id)

    // roster 404s on a missing campaign, like every sibling read (must mirror the real server, or
    // the e2e never exercises the error path — the drift that hid the /log crash).
    if (sub === 'roster') {
      if (!campaign) return send(res, 404, { detail: 'no such campaign' })
      return send(res, 200, ROSTER[id] ?? { pcs: [] })
    }

    // state/chronicle 404 on a missing campaign (like the real handlers).
    if (sub === 'state') {
      if (!campaign) return send(res, 404, { detail: 'no such campaign' })
      const raw = url.searchParams.get('sections') || 'actors,threads,places,factions'
      const sections = raw.split(',').map((s) => s.trim())
      // D-46: the omniscient sections are operator-only; a player token → 403.
      const OMNI = new Set(['claims', 'beliefs', 'sheets', 'items', 'edges', 'counters'])
      if (sections.some((s) => OMNI.has(s)) && !isOperator(token))
        return send(res, 403, { detail: `operator token required for: ${sections.join(', ')}` })
      const full = (STATE[id] ?? emptyState(campaign.branch_id)).state
      const out = {}
      for (const s of sections) out[s] = full[s] ?? []
      return send(res, 200, { branch_id: campaign.branch_id, state: out })
    }
    if (sub === 'chronicle') {
      if (!campaign) return send(res, 404, { detail: 'no such campaign' })
      return send(res, 200, CHRONICLE[id] ?? { beats: [] })
    }
    // bare /campaigns/{id}
    if (!campaign) return send(res, 404, { detail: 'no such campaign' })
    return send(res, 200, campaignView(campaign, token))
  }

  // M5 slice 3: GET /campaigns/{c}/codex[?participant=] — participant notes (self-or-admin, D-39).
  const mcx = p.match(/^\/campaigns\/([^/]+)\/codex$/)
  if (req.method === 'GET' && mcx) {
    const id = decodeURIComponent(mcx[1])
    if (!CAMPAIGNS.find((c) => c.campaign_id === id))
      return send(res, 404, { detail: 'no such campaign' })
    const target = url.searchParams.get('participant') || token // the stub token IS the participant
    if (target !== token && !isOperator(token))
      return send(res, 403, { detail: 'can only read your own codex (or as operator)' })
    return send(res, 200, { participant: target, notes: CODEX[`${id}:${target}`] ?? [] })
  }

  // M4 slice 4: GET /campaigns/{c}/consistency — the T2 proxy (any-authed).
  const mcon = p.match(/^\/campaigns\/([^/]+)\/consistency$/)
  if (req.method === 'GET' && mcon) {
    const id = decodeURIComponent(mcon[1])
    if (!CAMPAIGNS.find((c) => c.campaign_id === id))
      return send(res, 404, { detail: 'no such campaign' })
    const consistent = 11
    const total = 12
    return send(res, 200, { consistent, total, ratio: consistent / total })
  }

  // M6 slice 1: GET /rulesets — the bound registry (any-authed).
  if (req.method === 'GET' && p === '/rulesets') {
    return send(res, 200, {
      rulesets: [
        {
          id: 'uro-basic',
          version: '0',
          sheet_schema: {
            title: 'd20 sheet',
            type: 'object',
            properties: {
              hp: { type: 'integer' },
              ac: { type: 'integer' },
              level: { type: 'integer' },
            },
            required: ['hp', 'ac'],
          },
        },
        {
          id: 'uro-pbta',
          version: '0',
          sheet_schema: {
            title: 'PbtA sheet',
            type: 'object',
            properties: {
              stats: { type: 'object' },
              harm: { type: 'integer' },
              conditions: { type: 'array' },
            },
            required: ['stats', 'harm'],
          },
        },
      ],
    })
  }

  // M6 slice 1: GET /usage[?stage=] — LLM-call telemetry (OPERATOR-only, D-44). ?world=/?campaign=
  // aren't keyed on the rows yet → 400 (honest), never a silent no-op.
  if (req.method === 'GET' && p === '/usage') {
    if (!isOperator(token)) return send(res, 403, { detail: 'operator token required' })
    for (const bad of ['world', 'campaign']) {
      if (url.searchParams.get(bad))
        return send(res, 400, { detail: `filtering usage by '${bad}' is not supported yet` })
    }
    const stage = url.searchParams.get('stage') || null
    const all = [
      {
        stage_tag: 'narrator',
        model: 'gpt-x',
        calls: 19098,
        tokens_in: 4_100_000,
        tokens_out: 2_300_000,
        avg_latency_ms: 820,
      },
      {
        stage_tag: 'extractor',
        model: 'gpt-x',
        calls: 18643,
        tokens_in: 3_800_000,
        tokens_out: 900_000,
        avg_latency_ms: 610,
      },
      {
        stage_tag: 'planner',
        model: 'gpt-x',
        calls: 3102,
        tokens_in: 700_000,
        tokens_out: 120_000,
        avg_latency_ms: 540,
      },
      {
        stage_tag: 'embedder',
        model: null,
        calls: 38154,
        tokens_in: 0,
        tokens_out: 0,
        avg_latency_ms: 12,
      },
    ]
    const by_stage = stage ? all.filter((r) => r.stage_tag === stage) : all
    return send(res, 200, {
      stage,
      total_calls: by_stage.reduce((n, r) => n + r.calls, 0),
      by_stage,
    })
  }

  return send(res, 404, { detail: 'not found' })
})

// ---- Minimal WebSocket (RFC 6455) for the /play channel ------------------------
// Hand-rolled so the stub stays zero-dependency and Dockerizable (server.mjs only).

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

function wsEncode(str) {
  const payload = Buffer.from(str, 'utf8')
  const len = payload.length
  let header
  if (len < 126) {
    header = Buffer.from([0x81, len])
  } else if (len < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 127
    header.writeBigUInt64BE(BigInt(len), 2)
  }
  return Buffer.concat([header, payload])
}

function wsClose(code) {
  const body = Buffer.alloc(2)
  body.writeUInt16BE(code, 0)
  return Buffer.concat([Buffer.from([0x88, 0x02]), body])
}

// Decode one frame from a buffer; null if incomplete. Handles client masking.
function wsDecode(buf) {
  if (buf.length < 2) return null
  const opcode = buf[0] & 0x0f
  const masked = (buf[1] & 0x80) !== 0
  let len = buf[1] & 0x7f
  let offset = 2
  if (len === 126) {
    if (buf.length < 4) return null
    len = buf.readUInt16BE(2)
    offset = 4
  } else if (len === 127) {
    if (buf.length < 10) return null
    len = Number(buf.readBigUInt64BE(2))
    offset = 10
  }
  let mask
  if (masked) {
    if (buf.length < offset + 4) return null
    mask = buf.subarray(offset, offset + 4)
    offset += 4
  }
  if (buf.length < offset + len) return null
  const out = Buffer.alloc(len)
  for (let i = 0; i < len; i++) out[i] = masked ? buf[offset + i] ^ mask[i % 4] : buf[offset + i]
  return { opcode, text: out.toString('utf8'), bytesUsed: offset + len }
}

function simulateBeat(send, participant, text) {
  if (!text.trim()) return
  send({ type: 'beat_started', participant_id: participant, intent: text })
  const narration = `The world responds to "${text}". Shadows lengthen along the wall; somewhere behind you, a door clicks shut.`
  const words = narration.split(' ')
  const chunks = []
  for (let i = 0; i < words.length; i += 4) chunks.push(words.slice(i, i + 4).join(' ') + ' ')
  let i = 0
  const tick = () => {
    if (i < chunks.length) {
      send({ type: 'narration_chunk', participant_id: participant, text: chunks[i] })
      i += 1
      setTimeout(tick, 90)
    } else {
      send({ type: 'beat_committed', participant_id: participant, intent: text, narration })
    }
  }
  setTimeout(tick, 60)
}

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const m = url.pathname.match(/^\/campaigns\/([^/]+)\/play$/)
  const key = req.headers['sec-websocket-key']
  if (!m || !key) {
    socket.destroy()
    return
  }
  const accept = createHash('sha1')
    .update(key + WS_GUID)
    .digest('base64')
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  )

  const send = (obj) => socket.write(wsEncode(JSON.stringify(obj)))
  const closeWith = (code) => {
    socket.write(wsClose(code))
    socket.end()
  }

  const token = url.searchParams.get('token')
  const campaignId = decodeURIComponent(m[1])
  if (!token) return closeWith(4401)
  if (!CAMPAIGNS.find((c) => c.campaign_id === campaignId)) return closeWith(4404)

  const participant = `participant_${token}`
  send({ type: 'participant_joined', participant_id: participant })

  let buf = Buffer.alloc(0)
  socket.on('data', (data) => {
    buf = Buffer.concat([buf, data])
    let frame
    while ((frame = wsDecode(buf)) !== null) {
      buf = buf.subarray(frame.bytesUsed)
      if (frame.opcode === 0x8) {
        socket.end()
        return
      }
      if (frame.opcode !== 0x1) continue // ignore ping/pong/binary
      let msg
      try {
        msg = JSON.parse(frame.text)
      } catch {
        continue
      }
      if (msg.type === 'intent') simulateBeat(send, participant, String(msg.text ?? ''))
      else if (msg.type === 'table_talk') {
        const t = String(msg.text ?? '')
        if (t.trim()) send({ type: 'table_talk', participant_id: participant, text: t })
      } else if (msg.type === 'vote') {
        send({ type: 'vote_unsupported', participant_id: participant })
      }
    }
  })
  socket.on('error', () => {})
})

server.listen(PORT, () => {
  console.log(`uro-loom stub server listening on http://127.0.0.1:${PORT}`)
})
