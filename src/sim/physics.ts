import type { Command, Vec } from "../shared/types.js";
import { vec } from "./vector.js";

export type PhysicsConfig = {
  gravity: Vec;
  maxThrust: number;
  damping: number;
  maxSpeed: number;
  maxLandingSpeed: number;
};

export function integrate(
  pos: Vec,
  vel: Vec,
  command: Command,
  config: PhysicsConfig,
  dt: number
): { pos: Vec; vel: Vec } {
  const thrustDir = vec.normalize(command.dir);
  const thrust = vec.scale(thrustDir, command.throttle * config.maxThrust);
  const accel = vec.add(config.gravity, thrust);

  let nextVel = vec.add(vel, vec.scale(accel, dt));
  const damp = Math.max(0, 1 - config.damping * dt);
  nextVel = vec.scale(nextVel, damp);
  nextVel = vec.clampLen(nextVel, config.maxSpeed);

  const nextPos = vec.add(pos, vec.scale(nextVel, dt));
  return { pos: nextPos, vel: nextVel };
}
