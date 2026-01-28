import type { BotInput, Command } from "../../src/sdk/types.js";

const GRAVITY_COMPENSATION = 0.05; // Small upward thrust to counter gravity

export function step(input: BotInput): Command {
  let dx = input.map.goal.x - input.self.pos.x;
  let dy = input.map.goal.y - input.self.pos.y;

  // Compensate for gravity by adding upward component
  dy -= GRAVITY_COMPENSATION;

  const dist = Math.hypot(dx, dy);
  if (dist === 0) {
    return { throttle: 0, dir: { x: 0, y: 0 } };
  }

  // Normalize direction
  const dir = { x: dx / dist, y: dy / dist };

  // Throttle: full at distance 6, min 0.2, max 1
  const throttle = Math.min(1, Math.max(0.2, dist / 6));

  return { throttle, dir };
}
