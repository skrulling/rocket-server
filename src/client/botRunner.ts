import WebSocket from "ws";
import type { BotInput, Command, MapInfo, ShipSnapshot, WorldInfo } from "../shared/types.js";
import { clampCommand } from "../server/protocol.js";

export type Bot = {
  step: (input: BotInput) => Command;
};

export type BotRunnerOptions = {
  url: string;
  runId: string;
  name: string;
  bot: Bot;
};

export function runBot(options: BotRunnerOptions): WebSocket {
  const socket = new WebSocket(options.url);
  let playerId: string | undefined;
  let map: MapInfo | null = null;
  let world: WorldInfo | null = null;

  socket.on("open", () => {
    socket.send(
      JSON.stringify({
        type: "join",
        runId: options.runId,
        role: "player",
        name: options.name
      })
    );
  });

  socket.on("message", (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === "joined") {
      playerId = message.playerId;
      map = message.map;
      world = message.world;
      return;
    }

    if (message.type === "map") {
      map = message.map;
      world = message.world;
      return;
    }

    if (message.type !== "state" || !playerId || !map || !world) return;
    const ships = message.ships as ShipSnapshot[];
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
      command = options.bot.step(input);
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
