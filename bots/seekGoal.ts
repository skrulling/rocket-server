import type { BotInput, Command } from "../src/shared/types.js";

export function step(input: BotInput): Command {
  const dx = input.map.goal.x - input.self.pos.x;
  const dy = input.map.goal.y - input.self.pos.y;
  return {
    throttle: Math.min(1, Math.max(0.2, Math.hypot(dx, dy) / 6)),
    dir: { x: dx, y: dy }
  };
}
