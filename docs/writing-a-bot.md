# Writing a Bot

Bots run on your machine and send `{ throttle, dir }` commands. The server is authoritative and simulates physics.

## Game Goal

Start at `S`, reach `G` as fast as possible, and avoid crashing into walls.

How to win:

- Each run starts with all players at the same start position.
- You finish when your ship's center enters the goal radius **at low speed**.
- You lose that attempt if you crash into a wall or hit the goal too fast (hard landing).
- Rankings are based on finish order (fastest first).

### Landing

Ships must slow down before reaching the goal. If your velocity magnitude exceeds `maxLandingSpeed` when entering the goal radius, you crash (hard landing) instead of finishing.

Access the landing speed limit via `input.world.maxLandingSpeed` in your bot. Default is 3 units/s but varies per map.

## Folder Structure

Create one folder per bot under `clients/`.

Example:

```
clients/
  my-bot/
    config.json
    bot.ts
```

Put your controller in `bot.ts` and reference it from `config.json` (default `entry` is `./bot.ts`).
Run it with:

```
npm run client -- --client my-bot
```

## Bot API

You can export a simple function:

```ts
import type { BotInput, Command } from "../src/sdk/types.js";

export function step(input: BotInput): Command {
  const dx = input.map.goal.x - input.self.pos.x;
  const dy = input.map.goal.y - input.self.pos.y;
  return { throttle: 1, dir: { x: dx, y: dy } };
}
```

Or export a controller with hooks:

```ts
import type { RocketController } from "../src/sdk/controller.js";

export const controller: RocketController = {
  onMap(ctx) {
    // recompute path
  },
  step(input) {
    return { throttle: 1, dir: { x: 1, y: 0 } };
  }
};
```

## BotInput

- `tick`, `dt`: simulation time
- `map`: grid map with `lines`, `start`, `goal`
- `world`: physics settings (can change per map)
  - `gravity`: `{ x, y }` gravity vector
  - `maxThrust`: maximum thrust power
  - `damping`: velocity damping factor
  - `maxSpeed`: speed cap
  - `maxLandingSpeed`: maximum velocity to land safely
  - `shipRadius`: ship collision radius
  - `goalRadius`: goal detection radius
- `self`: your ship state
- `ships`: all ships

## Coordinates

World units match grid tiles. `(0,0)` is top-left. `+x` is right, `+y` is down.

## Tips

- Normalize your direction vector
- Slow down before reaching the goal to avoid a hard landing crash
- Check `input.world.maxLandingSpeed` to know when you're safe to land
- Compensate for gravity with a small upward component
