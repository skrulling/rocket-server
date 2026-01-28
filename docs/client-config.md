# Client Config

Each bot has its own folder under `clients/` with a `config.json`.

Example:

```json
{
  "name": "my-bot",
  "url": "ws://localhost:4321/ws",
  "runId": "default",
  "token": "",
  "entry": "./bot.ts"
}
```

Fields:

- `name`: player name shown in UI
- `url`: WebSocket URL
- `runId`: run identifier
- `token`: multiplayer password (required in multi mode)
- `entry`: path to your bot module
