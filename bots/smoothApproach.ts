import type { BotInput, Command, Vec } from "../src/shared/types.js";

function rotate(v: Vec, angle: number): Vec {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export function step(input: BotInput): Command {
  const toGoal = {
    x: input.map.goal.x - input.self.pos.x,
    y: input.map.goal.y - input.self.pos.y
  };

  const distance = Math.hypot(toGoal.x, toGoal.y);
  const baseDir = distance === 0 ? { x: 1, y: 0 } : { x: toGoal.x / distance, y: toGoal.y / distance };

  const wobble = Math.sin(input.tick * 0.08) * 0.25;
  const dir = rotate(baseDir, wobble);

  const throttle = Math.max(0.35, Math.min(1, distance / 6));

  return { throttle, dir };
}
