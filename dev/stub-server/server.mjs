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

// Write endpoints (M3). Mutations are in-memory and live for the process lifetime.
function handlePost(p, body, res) {
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
      handlePost(p, body, res)
    })
    return
  }

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
