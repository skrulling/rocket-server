import { z } from "zod";
import type { Command, MapInfo, ShipSnapshot, Vec, WorldInfo } from "../shared/types.js";

const vecSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const joinSchema = z.object({
  type: z.literal("join"),
  runId: z.string().min(1),
  role: z.enum(["player", "spectator"]),
  name: z.string().min(1).max(32),
  token: z.string().min(1).optional()
});

export const commandSchema = z.object({
  type: z.literal("command"),
  throttle: z.number().finite(),
  dir: vecSchema
});

export const controlSchema = z.object({
  type: z.literal("control"),
  action: z.enum(["start", "reset", "setMap"]),
  mapName: z.string().min(1).optional()
});

export type JoinMessage = z.infer<typeof joinSchema>;
export type CommandMessage = z.infer<typeof commandSchema>;
export type ControlMessage = z.infer<typeof controlSchema>;
export type ClientMessage = JoinMessage | CommandMessage | ControlMessage;

export type JoinedMessage = {
  type: "joined";
  runId: string;
  role: "player" | "spectator";
  playerId?: string;
  mapName: string;
  map: MapInfo;
  world: WorldInfo;
  tickRate: number;
  snapshotRate: number;
};

export type StateMessage = {
  type: "state";
  tick: number;
  dt: number;
  ships: ShipSnapshot[];
};

export type RunMessage = {
  type: "run";
  status: "running" | "paused";
};

export type MapMessage = {
  type: "map";
  runId: string;
  mapName: string;
  map: MapInfo;
  world: WorldInfo;
};

export type EventMessage =
  | { type: "event"; name: "playerCrashed"; playerId: string; tick: number }
  | { type: "event"; name: "playerFinished"; playerId: string; tick: number }
  | { type: "event"; name: "playerJoined"; playerId: string; playerName: string }
  | { type: "event"; name: "playerLeft"; playerId: string; playerName: string };

export type ErrorMessage = {
  type: "error";
  code: string;
  message: string;
};

export type ServerMessage =
  | JoinedMessage
  | StateMessage
  | EventMessage
  | MapMessage
  | RunMessage
  | ErrorMessage;

export function clampCommand(input: Command): Command {
  const throttle = Math.max(0, Math.min(1, input.throttle));
  const dir = { x: input.dir.x, y: input.dir.y } as Vec;
  const len = Math.hypot(dir.x, dir.y);
  if (len === 0) return { throttle, dir: { x: 0, y: 0 } };
  return { throttle, dir: { x: dir.x / len, y: dir.y / len } };
}
