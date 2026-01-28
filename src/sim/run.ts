import type { Command, ShipSnapshot, ShipStatus, Vec } from "../shared/types.js";
import type { MapData } from "./map.js";
import type { PhysicsConfig } from "./physics.js";
import { collidesWithWalls } from "./collision.js";
import { integrate } from "./physics.js";
import { vec } from "./vector.js";

export type RunConfig = PhysicsConfig & {
  shipRadius: number;
  goalRadius: number;
};

export type RunEvent =
  | { type: "playerCrashed"; shipId: string; tick: number }
  | { type: "playerFinished"; shipId: string; tick: number };

type ShipState = ShipSnapshot;

export class Run {
  readonly map: MapData;
  readonly config: RunConfig;
  tick: number;
  private ships: Map<string, ShipState>;
  private commands: Map<string, Command>;

  constructor(map: MapData, config: RunConfig) {
    this.map = map;
    this.config = config;
    this.tick = 0;
    this.ships = new Map();
    this.commands = new Map();
  }

  addPlayer(id: string, name: string): ShipState {
    const ship: ShipState = {
      id,
      name,
      status: "alive",
      pos: { ...this.map.start },
      vel: { x: 0, y: 0 }
    };
    this.ships.set(id, ship);
    this.commands.set(id, { throttle: 0, dir: { x: 0, y: 0 } });
    return ship;
  }

  removePlayer(id: string): void {
    this.ships.delete(id);
    this.commands.delete(id);
  }

  setCommand(id: string, command: Command): void {
    if (!this.commands.has(id)) return;
    this.commands.set(id, command);
  }

  getShips(): ShipSnapshot[] {
    return Array.from(this.ships.values()).map((ship) => ({ ...ship }));
  }

  reset(): void {
    this.tick = 0;
    for (const ship of this.ships.values()) {
      ship.status = "alive";
      ship.pos = { ...this.map.start };
      ship.vel = { x: 0, y: 0 };
      delete ship.finishTick;
      delete ship.crashTick;
    }
    for (const id of this.commands.keys()) {
      this.commands.set(id, { throttle: 0, dir: { x: 0, y: 0 } });
    }
  }

  step(dt: number): RunEvent[] {
    const events: RunEvent[] = [];
    this.tick += 1;

    for (const ship of this.ships.values()) {
      if (ship.status !== "alive") continue;

      const command = this.commands.get(ship.id) ?? {
        throttle: 0,
        dir: { x: 0, y: 0 }
      };

      const next = integrate(ship.pos, ship.vel, command, this.config, dt);
      ship.pos = next.pos;
      ship.vel = next.vel;

      if (collidesWithWalls(this.map, ship.pos, this.config.shipRadius)) {
        ship.status = "crashed";
        ship.crashTick = this.tick;
        ship.vel = { x: 0, y: 0 };
        events.push({ type: "playerCrashed", shipId: ship.id, tick: this.tick });
        continue;
      }

      if (vec.distance(ship.pos, this.map.goal) <= this.config.goalRadius) {
        const speed = Math.hypot(ship.vel.x, ship.vel.y);
        if (speed <= this.config.maxLandingSpeed) {
          ship.status = "finished";
          ship.finishTick = this.tick;
          ship.vel = { x: 0, y: 0 };
          events.push({ type: "playerFinished", shipId: ship.id, tick: this.tick });
        } else {
          ship.status = "crashed";
          ship.crashTick = this.tick;
          ship.vel = { x: 0, y: 0 };
          events.push({ type: "playerCrashed", shipId: ship.id, tick: this.tick });
        }
      }
    }

    return events;
  }

  isFinished(): boolean {
    return Array.from(this.ships.values()).every(
      (ship) => ship.status !== "alive"
    );
  }
}
