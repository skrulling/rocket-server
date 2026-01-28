# Rocket Server

Authoritative game server for programmable rocket ships. Players run their bots locally and connect over WebSockets. Spectator UI lets you watch runs, switch maps, and reset.

## Quickstart (Local)

```bash
npm install
npm run server:local
```

Open `http://localhost:4321` to spectate.

Run a bot from the repo:

```bash
npm run client -- --client _template
```

Run all local bots (tournament style):

```bash
npm run clients
```

## Multiplayer

Start the server with a token:

```bash
npm run server:multi -- --token mysecret
```

Each client must set `token` in `clients/<id>/config.json`.

## Docs

- `docs/writing-a-bot.md`
- `docs/client-config.md`
- `docs/multiplayer.md`
