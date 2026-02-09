const http = require('http')
const WebSocket = require('ws')
const { URL } = require('url')

const PORT = Number.parseInt(process.env.PORT || '8080', 10)
const API_BASE = (process.env.API_BASE || '').replace(/\/$/, '')
const WS_PATH = process.env.WS_PATH || '/ws'
const NOTIFY_PATH = process.env.NOTIFY_PATH || '/notify'
const NOTIFY_SECRET = process.env.WS_NOTIFY_SECRET || ''

const matchClients = new Map()

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const sendJson = (ws, payload) => {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify(payload))
}

const addClient = (matchId, ws) => {
  let clients = matchClients.get(matchId)
  if (!clients) {
    clients = new Set()
    matchClients.set(matchId, clients)
  }
  clients.add(ws)
  ws._matchId = matchId
}

const removeClient = (ws) => {
  const matchId = ws._matchId
  if (!matchId) return
  const clients = matchClients.get(matchId)
  if (!clients) return
  clients.delete(ws)
  if (!clients.size) {
    matchClients.delete(matchId)
  }
}

const broadcast = (matchId, payload) => {
  const clients = matchClients.get(matchId)
  if (!clients || clients.size === 0) return 0
  const data = JSON.stringify(payload)
  let count = 0
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
      count += 1
    }
  }
  return count
}

const validateSubscription = async (matchId, token) => {
  if (!API_BASE) {
    return { ok: false, message: 'API_BASE missing' }
  }

  const url = `${API_BASE}/match-room-get?matchId=${encodeURIComponent(matchId)}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data || !data.ok || !data.match) {
      return { ok: false, message: 'Access denied' }
    }

    return { ok: true, match: data.match }
  } catch {
    return { ok: false, message: 'API error' }
  } finally {
    clearTimeout(timeout)
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  if (req.method === 'POST' && url.pathname === NOTIFY_PATH) {
    if (NOTIFY_SECRET) {
      const header = String(req.headers['x-notify-secret'] || '')
      if (header !== NOTIFY_SECRET) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false }))
        return
      }
    }

    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
      if (body.length > 10000) {
        res.writeHead(413, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false }))
        req.destroy()
      }
    })

    req.on('end', () => {
      let payload = {}
      try {
        payload = JSON.parse(body || '{}')
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false }))
        return
      }

      const matchId = String(payload.matchId || '')
      const event = String(payload.event || 'update')
      if (!isUuid(matchId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false }))
        return
      }

      const sent = broadcast(matchId, {
        type: 'match-update',
        matchId,
        event,
        ts: Date.now(),
      })

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, sent }))
    })

    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: false }))
})

const wss = new WebSocket.WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname !== WS_PATH) {
    socket.destroy()
    return
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

wss.on('connection', (ws) => {
  ws.isAlive = true

  const subscribeTimeout = setTimeout(() => {
    if (!ws._matchId && ws.readyState === WebSocket.OPEN) {
      sendJson(ws, { type: 'error', message: 'Subscribe timeout' })
      ws.close()
    }
  }, 10000)

  ws.on('pong', () => {
    ws.isAlive = true
  })

  ws.on('message', async (raw) => {
    let message = null
    try {
      message = JSON.parse(raw.toString())
    } catch {
      sendJson(ws, { type: 'error', message: 'Bad JSON' })
      return
    }

    if (!message || typeof message !== 'object') {
      sendJson(ws, { type: 'error', message: 'Invalid message' })
      return
    }

    if (message.type === 'subscribe') {
      const matchId = String(message.matchId || '').trim()
      const token = String(message.token || '').trim()

      if (!isUuid(matchId) || !token) {
        sendJson(ws, { type: 'error', message: 'Invalid subscribe' })
        ws.close()
        return
      }

      const result = await validateSubscription(matchId, token)
      if (!result.ok) {
        sendJson(ws, { type: 'error', message: result.message || 'Access denied' })
        ws.close()
        return
      }

      addClient(matchId, ws)
      clearTimeout(subscribeTimeout)
      sendJson(ws, { type: 'subscribed', matchId })
      if (result.match) {
        sendJson(ws, { type: 'state', matchId, match: result.match })
      }
      return
    }

    if (message.type === 'ping') {
      sendJson(ws, { type: 'pong' })
      return
    }
  })

  ws.on('close', () => {
    clearTimeout(subscribeTimeout)
    removeClient(ws)
  })

  ws.on('error', () => {
    clearTimeout(subscribeTimeout)
    removeClient(ws)
  })
})

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate()
      removeClient(ws)
      continue
    }
    ws.isAlive = false
    ws.ping()
  }
}, 30000)

server.listen(PORT, () => {
  console.log(`Realtime server listening on ${PORT}`)
  console.log(`WS path: ${WS_PATH}`)
})
