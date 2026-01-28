# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Authoritative game server for programmable rocket ships. Players write bots that run locally and connect over WebSockets to control ships navigating from start (S) to goal (G) while avoiding walls. The server handles physics simulation, collisions, and multiplayer coordination.

## Commands

```bash
# Install dependencies
npm install

# Start server (local mode - no auth required)
npm run server:local

# Start server (multiplayer mode - requires token)
npm run server:multi -- --token <secret>

# Run a specific bot
npm run client -- --client <bot-folder-name>

# Run all bots in clients/ directory
npm run clients

# Run tests
npm test
npm run test:watch

# Quick smoke test
npm run smoke
```

## Architecture

```
src/
├── server/         # WebSocket server, game state management
│   ├── index.ts    # Entry point, CLI arg parsing
│   ├── startServer.ts  # HTTP + WS setup
│   ├── runManager.ts   # Tick loop (60Hz), client connections, state broadcast (20Hz)
│   └── protocol.ts     # Zod schemas for WebSocket messages
├── sim/            # Physics engine (server-authoritative)
│   ├── run.ts      # Game loop, ship tracking, crash/finish detection
│   ├── physics.ts  # Newtonian integration: gravity, thrust, damping
│   ├── collision.ts    # Circle-to-AABB wall collision
│   ├── map.ts      # ASCII map parser (# = wall, S = start, G = goal)
│   └── vector.ts   # Vec math utilities
├── sdk/            # Client SDK for bot developers
│   ├── client.ts   # WebSocket connection, bot lifecycle
│   ├── controller.ts   # Controller interface (step function or full hooks)
│   └── types.ts    # Re-exports from shared/types
├── client/         # Bot runners
│   ├── runClient.ts    # Single bot launcher
│   └── runAllClients.ts    # Multi-bot launcher
└── shared/
    └── types.ts    # Core types: Vec, Command, BotInput, ShipSnapshot, MapInfo, WorldInfo
```

**Key data flow:** Client connects via WebSocket → sends join message → receives game state every tick → calls `bot.step(BotInput)` → sends `Command {throttle, dir}` → server applies in physics step.

## Bot Development

Bots live in `clients/<bot-name>/` with a `config.json` and entry file (default `bot.ts`).

**Simple bot (export step function):**
```ts
import type { BotInput, Command } from "../../src/sdk/types.js";

export function step(input: BotInput): Command {
  const dx = input.map.goal.x - input.self.pos.x;
  const dy = input.map.goal.y - input.self.pos.y;
  return { throttle: 1, dir: { x: dx, y: dy } };
}
```

**Controller with hooks:**
```ts
import type { RocketController } from "../../src/sdk/controller.js";

export const controller: RocketController = {
  onMap(ctx) { /* recompute path */ },
  step(input) { return { throttle: 1, dir: { x: 1, y: 0 } }; }
};
```

Copy `clients/_template/` to start a new bot.

## Coordinates and Physics

- World units = grid tiles. `(0,0)` is top-left, `+x` right, `+y` down
- Default physics: gravity `{x:0, y:1.62}`, maxThrust `25`, damping `0.05`, maxSpeed `20`
- Ship radius `0.35`, goal radius `0.5`
- Win: ship center enters goal radius. Lose: collide with wall

## Maps

ASCII format in `maps/`. Companion `.json` file configures physics per map.
- `#` = wall, `S` = start, `G` = goal
- All lines must have equal width

## Server Modes

- **Local:** Any client can join and control (start/reset/setMap)
- **Multi:** Requires token. Only spectators can control; players send commands only

## Spectator UI

Open `http://localhost:4321` to watch runs, switch maps, and control game state.
