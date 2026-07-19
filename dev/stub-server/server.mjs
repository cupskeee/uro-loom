// A zero-dependency stand-in for uro-server, so Loom is developable and testable
// without a full Uro instance (Postgres, migrations, a model). Response shapes are
// verified against the real uro-core models + projection SQL (see docs/02). Replace
// with a real `uro serve` for real data.

import { createServer } from 'node:http'

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

  if (req.method === 'GET' && p === '/worlds') return send(res, 200, WORLDS)

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
      return send(res, 200, STATE[id] ?? emptyState(campaign.branch_id))
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

server.listen(PORT, () => {
  console.log(`uro-loom stub server listening on http://127.0.0.1:${PORT}`)
})
