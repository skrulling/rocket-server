export type Vec = { x: number; y: number };

export type ShipStatus = "alive" | "crashed" | "finished";

export type ShipSnapshot = {
  id: string;
  name: string;
  status: ShipStatus;
  pos: Vec;
  vel: Vec;
  finishTick?: number;
  crashTick?: number;
};

export type MapInfo = {
  width: number;
  height: number;
  lines: string[];
  start: Vec;
  goal: Vec;
};

export type WorldInfo = {
  gravity: Vec;
  maxThrust: number;
  damping: number;
  maxSpeed: number;
  shipRadius: number;
  goalRadius: number;
};

export type Command = {
  throttle: number;
  dir: Vec;
};

export type BotInput = {
  tick: number;
  dt: number;
  map: MapInfo;
  world: WorldInfo;
  self: ShipSnapshot;
  ships: ShipSnapshot[];
};
