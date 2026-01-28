import type { BotInput, Command, Vec } from "../src/shared/types.js";

function scale(v: Vec, s: number): Vec {
  return { x: v.x * s, y: v.y * s };
}

function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

function len(v: Vec): number {
  return Math.hypot(v.x, v.y);
}

export function step(input: BotInput): Command {
  const toGoal = {
    x: input.map.goal.x - input.self.pos.x,
    y: input.map.goal.y - input.self.pos.y
  };

  const kp = 1.4;
  const kd = 1.1;

  const desiredAcc = add(
    add(scale(toGoal, kp), scale(input.self.vel, -kd)),
    scale(input.world.gravity, -1)
  );

  const mag = len(desiredAcc);
  if (mag === 0) return { throttle: 0, dir: { x: 0, y: 0 } };

  return {
    throttle: Math.min(1, mag / input.world.maxThrust),
    dir: { x: desiredAcc.x / mag, y: desiredAcc.y / mag }
  };
}
