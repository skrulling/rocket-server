import type { BotInput, Command, MapInfo, ShipSnapshot, WorldInfo } from "./types.js";

export type JoinContext = {
  runId: string;
  playerId: string;
  mapName: string;
  map: MapInfo;
  world: WorldInfo;
  tickRate: number;
  snapshotRate: number;
};

export type MapContext = {
  mapName: string;
  map: MapInfo;
  world: WorldInfo;
};

export type RunStatus = "running" | "paused";

export type GameEvent =
  | { type: "playerCrashed"; playerId: string; tick: number }
  | { type: "playerFinished"; playerId: string; tick: number };

export type RocketController = {
  step: (input: BotInput) => Command;
  onJoined?: (ctx: JoinContext) => void;
  onMap?: (ctx: MapContext) => void;
  onRunStatus?: (status: RunStatus) => void;
  onEvent?: (event: GameEvent, ships: ShipSnapshot[]) => void;
  onError?: (message: string) => void;
};

export type BotModule = {
  step?: (input: BotInput) => Command;
  controller?: RocketController;
};
