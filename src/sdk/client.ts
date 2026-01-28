import WebSocket from "ws";
import type { BotInput, Command, MapInfo, ShipSnapshot, WorldInfo } from "./types.js";
import type { BotModule, RocketController, RunStatus } from "./controller.js";

export type ClientOptions = {
  url: string;
  runId: string;
  name: string;
  token?: string;
  controller: RocketController;
};

function clampCommand(input: Command): Command {
  const throttle = Math.max(0, Math.min(1, input.throttle));
  const len = Math.hypot(input.dir.x, input.dir.y);
  if (len === 0) return { throttle, dir: { x: 0, y: 0 } };
  return {
    throttle,
    dir: { x: input.dir.x / len, y: input.dir.y / len }
  };
}

export function toController(mod: BotModule): RocketController {
  if (mod.controller) return mod.controller;
  if (mod.step) return { step: mod.step };
  throw new Error("Bot module must export step() or controller");
}

export function connectAndRun(options: ClientOptions): WebSocket {
  const socket = new WebSocket(options.url);
  let playerId: string | undefined;
  let map: MapInfo | null = null;
  let world: WorldInfo | null = null;
  let mapName = "";
  let lastShips: ShipSnapshot[] = [];

  socket.on("open", () => {
    socket.send(
      JSON.stringify({
        type: "join",
        runId: options.runId,
        role: "player",
        name: options.name,
        token: options.token
      })
    );
  });

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === "error") {
      options.controller.onError?.(message.message);
      return;
    }

    if (message.type === "joined") {
      playerId = message.playerId;
      map = message.map;
      world = message.world;
      mapName = message.mapName ?? "";
      options.controller.onJoined?.({
        runId: message.runId,
        playerId,
        mapName,
        map,
        world,
        tickRate: message.tickRate,
        snapshotRate: message.snapshotRate
      });
      return;
    }

    if (message.type === "map") {
      map = message.map;
      world = message.world;
      mapName = message.mapName ?? mapName;
      options.controller.onMap?.({ mapName, map, world });
      return;
    }

    if (message.type === "run") {
      options.controller.onRunStatus?.(message.status as RunStatus);
      return;
    }

    if (message.type === "event") {
      options.controller.onEvent?.(message, lastShips);
      return;
    }

    if (message.type !== "state" || !playerId || !map || !world) return;
    const ships = message.ships as ShipSnapshot[];
    lastShips = ships;
    const self = ships.find((ship) => ship.id === playerId);
    if (!self || self.status !== "alive") return;

    const input: BotInput = {
      tick: message.tick,
      dt: message.dt,
      map,
      world,
      self,
      ships
    };

    let command: Command;
    try {
      command = options.controller.step(input);
    } catch {
      command = { throttle: 0, dir: { x: 0, y: 0 } };
    }

    const clamped = clampCommand(command);
    socket.send(
      JSON.stringify({
        type: "command",
        throttle: clamped.throttle,
        dir: clamped.dir
      })
    );
  });

  return socket;
}
