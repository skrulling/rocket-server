import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type { MapInfo, ShipSnapshot, WorldInfo } from "../shared/types.js";
import type { MapData } from "../sim/map.js";
import { Run } from "../sim/run.js";
import { clampCommand } from "./protocol.js";
import type { JoinedMessage, ServerMessage } from "./protocol.js";

export type RunManagerConfig = {
  runId: string;
  tickRate: number;
  snapshotRate: number;
  map: MapData;
  mapName: string;
  world: WorldInfo;
};

export type ClientRole = "player" | "spectator";

export type ClientInfo = {
  id: string;
  name: string;
  role: ClientRole;
  socket: WebSocket;
};

export class RunManager {
  readonly runId: string;
  run: Run;
  readonly tickRate: number;
  readonly snapshotRate: number;
  private mapInfo: MapInfo;
  private worldInfo: WorldInfo;
  private mapName: string;
  private readonly clients: Map<WebSocket, ClientInfo>;
  private interval: NodeJS.Timer | null;
  private running: boolean;

  constructor(config: RunManagerConfig) {
    this.runId = config.runId;
    this.tickRate = config.tickRate;
    this.snapshotRate = config.snapshotRate;
    this.worldInfo = config.world;
    this.run = new Run(config.map, this.worldInfo);
    this.mapInfo = {
      width: config.map.width,
      height: config.map.height,
      lines: config.map.lines,
      start: config.map.start,
      goal: config.map.goal
    };
    this.mapName = config.mapName;
    this.clients = new Map();
    this.interval = null;
    this.running = false;
  }

  start(): void {
    if (this.interval) return;
    const dt = 1 / this.tickRate;
    const snapshotEvery = Math.max(1, Math.round(this.tickRate / this.snapshotRate));
    this.interval = setInterval(() => {
      if (!this.running) return;
      const events = this.run.step(dt);
      if (this.run.tick % snapshotEvery === 0) {
        this.broadcast({
          type: "state",
          tick: this.run.tick,
          dt,
          ships: this.run.getShips()
        });
      }
      for (const event of events) {
        if (event.type === "playerCrashed") {
          this.broadcast({
            type: "event",
            name: "playerCrashed",
            playerId: event.shipId,
            tick: event.tick
          });
        }
        if (event.type === "playerFinished") {
          this.broadcast({
            type: "event",
            name: "playerFinished",
            playerId: event.shipId,
            tick: event.tick
          });
        }
      }
    }, 1000 / this.tickRate);
  }

  stop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  startRun(): void {
    if (this.running) return;
    this.running = true;
    this.broadcast({ type: "run", status: "running" });
  }

  resetRun(): void {
    this.running = false;
    this.run.reset();
    this.broadcast({ type: "run", status: "paused" });
    this.broadcast({
      type: "state",
      tick: this.run.tick,
      dt: 1 / this.tickRate,
      ships: this.run.getShips()
    });
  }

  setMap(map: MapData, mapName: string, world: WorldInfo): void {
    this.running = false;
    this.worldInfo = world;
    this.run = new Run(map, this.worldInfo);
    this.mapInfo = {
      width: map.width,
      height: map.height,
      lines: map.lines,
      start: map.start,
      goal: map.goal
    };
    this.mapName = mapName;
    for (const client of this.clients.values()) {
      if (client.role === "player") {
        this.run.addPlayer(client.id, client.name);
      }
    }
    this.broadcast({
      type: "map",
      runId: this.runId,
      mapName: this.mapName,
      map: this.mapInfo,
      world: this.worldInfo
    });
    this.broadcast({ type: "run", status: "paused" });
    this.broadcast({
      type: "state",
      tick: this.run.tick,
      dt: 1 / this.tickRate,
      ships: this.run.getShips()
    });
  }

  addClient(socket: WebSocket, role: ClientRole, name: string): ClientInfo {
    const id = randomUUID();
    const client = { id, role, name, socket };
    this.clients.set(socket, client);
    if (role === "player") {
      this.run.addPlayer(id, name);
    }
    return client;
  }

  notifyPlayerJoined(client: ClientInfo): void {
    if (client.role !== "player") return;
    // Broadcast state so all clients see the new player
    this.broadcast({
      type: "state",
      tick: this.run.tick,
      dt: 1 / this.tickRate,
      ships: this.run.getShips()
    });
    this.broadcast({
      type: "event",
      name: "playerJoined",
      playerId: client.id,
      playerName: client.name
    });
  }

  getClient(socket: WebSocket): ClientInfo | undefined {
    return this.clients.get(socket);
  }

  removeClient(socket: WebSocket): void {
    const client = this.clients.get(socket);
    if (!client) return;
    const wasPlayer = client.role === "player";
    const playerId = client.id;
    const playerName = client.name;
    if (wasPlayer) this.run.removePlayer(playerId);
    this.clients.delete(socket);
    if (wasPlayer) {
      // Broadcast state so all clients see the player removed
      this.broadcast({
        type: "state",
        tick: this.run.tick,
        dt: 1 / this.tickRate,
        ships: this.run.getShips()
      });
      this.broadcast({
        type: "event",
        name: "playerLeft",
        playerId,
        playerName
      });
    }
  }

  handleCommand(socket: WebSocket, command: { throttle: number; dir: { x: number; y: number } }): void {
    const client = this.clients.get(socket);
    if (!client || client.role !== "player") return;
    this.run.setCommand(client.id, clampCommand(command));
  }

  makeJoined(client: ClientInfo): JoinedMessage {
    return {
      type: "joined",
      runId: this.runId,
      role: client.role,
      playerId: client.role === "player" ? client.id : undefined,
      mapName: this.mapName,
      map: this.mapInfo,
      world: this.worldInfo,
      tickRate: this.tickRate,
      snapshotRate: this.snapshotRate
    };
  }

  getStatus(): "running" | "paused" {
    return this.running ? "running" : "paused";
  }

  broadcast(message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(payload);
      }
    }
  }

  send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  snapshot(): ShipSnapshot[] {
    return this.run.getShips();
  }
}
