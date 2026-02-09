# ChessWar Realtime Server

This service hosts a WebSocket endpoint for match updates and an HTTP notify endpoint
used by the PHP API to push match changes.

## Requirements
- Node.js 18+

## Install

npm install

## Run

PORT=8080 \
API_BASE=https://your-domain.tld/api \
WS_PATH=/ws \
NOTIFY_PATH=/notify \
WS_NOTIFY_SECRET=change_me \
npm start

## Endpoints
- WebSocket: ws(s)://host:PORT/ws
- Notify (HTTP POST): http(s)://host:PORT/notify
- Health: http(s)://host:PORT/health

## Notify payload

POST /notify
Headers:
- X-Notify-Secret: your_secret
Body:
{
  "matchId": "uuid",
  "event": "move|message|finish|update"
}

## WebSocket messages

Client -> Server
{
  "type": "subscribe",
  "matchId": "uuid",
  "token": "session_token"
}

Server -> Client
{
  "type": "state",
  "matchId": "uuid",
  "match": { ... }
}
{
  "type": "match-update",
  "matchId": "uuid",
  "event": "move"
}
