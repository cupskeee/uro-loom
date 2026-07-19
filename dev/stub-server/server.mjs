// A zero-dependency stand-in for uro-server, so Loom is developable and testable
// without a full Uro instance (Postgres, migrations, a model). It implements just
// enough of the wire contract for M0 + early M1: /healthz, /version, an authed
// /worlds, and a deliberately-501 /usage so the "not supported by this server"
// degradation path is exercisable. Replace with a real `uro serve` for real data.

import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? 8787)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

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

  // Open endpoints (no auth), matching uro-server's `/healthz`.
  if (url.pathname === '/healthz') return send(res, 200, { status: 'ok' })
  if (url.pathname === '/version') {
    return send(res, 200, { engineVersion: '0.2.0-stub', apiVersion: '0' })
  }

  // Everything else requires a bearer token → 401 otherwise (mirrors `_auth`).
  const token = tokenFrom(req, url)
  if (!token) return send(res, 401, { detail: 'missing or invalid token' })

  if (url.pathname === '/worlds' && req.method === 'GET') return send(res, 200, { worlds: [] })
  if (url.pathname === '/campaigns' && req.method === 'GET')
    return send(res, 200, { campaigns: [] })

  // A deliberately-unwired endpoint, so Loom's 501 handling has something to hit.
  if (url.pathname === '/usage') return send(res, 501, { detail: 'not supported by this server' })

  return send(res, 404, { detail: 'not found' })
})

server.listen(PORT, () => {
  console.log(`uro-loom stub server listening on http://127.0.0.1:${PORT}`)
})
