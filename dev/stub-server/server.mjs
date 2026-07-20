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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

// Write endpoints (M3 + M4). Mutations are in-memory and live for the process lifetime.
function handlePost(p, body, res, token) {
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

  if (req.method === 'POST') {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
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

  // M4: GET /worlds/{w}/log[?branch=&limit=] → { branch, commits } (head→genesis).
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
    let commits = LOG[b.branch_id] ?? []
    if (lim != null) commits = commits.slice(0, Number(lim))
    return send(res, 200, { branch: branchName, commits })
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
    return send(res, 200, list)
  }

  const m = p.match(/^\/campaigns\/([^/]+)(?:\/(roster|state|chronicle))?$/)
  if (req.method === 'GET' && m) {
    const id = decodeURIComponent(m[1])
    const sub = m[2]
    const campaign = CAMPAIGNS.find((c) => c.campaign_id === id)

    // roster does NO existence check → 200 {pcs:[]} even for a missing campaign.
    if (sub === 'roster') return send(res, 200, ROSTER[id] ?? { pcs: [] })

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
    return send(res, 200, campaign)
  }

  // A deliberately-unwired endpoint, so Loom's 501 handling has something to hit.
  if (p === '/usage') return send(res, 501, { detail: 'not supported by this server' })

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
