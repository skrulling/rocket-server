import http from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { WebSocketServer } from "ws";
import { parseMap } from "../sim/map.js";
import { commandSchema, controlSchema, joinSchema } from "./protocol.js";
import { RunManager } from "./runManager.js";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml"
};

export type ServerOptions = {
  port: number;
  runId: string;
  mapPath: string;
  mapsDir: string;
  tickRate: number;
  snapshotRate: number;
  publicDir: string;
  mode: "local" | "multi";
  token?: string;
};

export async function startServer(options: ServerOptions): Promise<{
  port: number;
  stop: () => Promise<void>;
}> {
  const defaultWorld = {
    gravity: { x: 0, y: 1.62 },
    maxThrust: 25,
    damping: 0.05,
    maxSpeed: 20,
    maxLandingSpeed: 3,
    shipRadius: 0.3,
    goalRadius: 0.5
  };

  async function loadWorld(mapName: string) {
    const jsonName = mapName.replace(/\.txt$/, ".json");
    try {
      const raw = await readFile(join(options.mapsDir, jsonName), "utf-8");
      const parsed = JSON.parse(raw) as Partial<typeof defaultWorld>;
      return {
        gravity: parsed.gravity ?? defaultWorld.gravity,
        maxThrust: parsed.maxThrust ?? defaultWorld.maxThrust,
        damping: parsed.damping ?? defaultWorld.damping,
        maxSpeed: parsed.maxSpeed ?? defaultWorld.maxSpeed,
        maxLandingSpeed: parsed.maxLandingSpeed ?? defaultWorld.maxLandingSpeed,
        shipRadius: parsed.shipRadius ?? defaultWorld.shipRadius,
        goalRadius: parsed.goalRadius ?? defaultWorld.goalRadius
      };
    } catch {
      return { ...defaultWorld };
    }
  }

  async function loadMap(mapName: string) {
    const mapText = await readFile(join(options.mapsDir, mapName), "utf-8");
    const map = parseMap(mapText);
    const world = await loadWorld(mapName);
    return { map, world };
  }

  let currentMapName = basename(options.mapPath);
  const mapFiles = (await readdir(options.mapsDir)).filter((name) => name.endsWith(".txt"));
  if (!mapFiles.includes(currentMapName) && mapFiles.length > 0) {
    currentMapName = mapFiles[0];
  }
  const { map, world } = await loadMap(currentMapName);
  const runManager = new RunManager({
    runId: options.runId,
    tickRate: options.tickRate,
    snapshotRate: options.snapshotRate,
    map,
    mapName: currentMapName,
    world
  });

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/maps") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          maps: mapFiles,
          current: currentMapName,
          mode: options.mode
        })
      );
      return;
    }
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const relative = pathname.startsWith("/") ? pathname.slice(1) : pathname;
    const filePath = join(options.publicDir, relative);
    try {
      const file = await readFile(filePath);
      const ext = extname(filePath);
      res.setHeader("Content-Type", contentTypes[ext] ?? "application/octet-stream");
      res.end(file);
    } catch {
      res.statusCode = 404;
      res.end("Not Found");
    }
  });

  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (socket) => {
    let joined = false;

    socket.on("message", async (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        runManager.send(socket, {
          type: "error",
          code: "bad_json",
          message: "Message must be valid JSON"
        });
        return;
      }

      if (!joined) {
        const result = joinSchema.safeParse(parsed);
        if (!result.success) {
          runManager.send(socket, {
            type: "error",
            code: "bad_join",
            message: "Join message invalid"
          });
          return;
        }
        const join = result.data;
        if (options.mode === "multi") {
          if (!options.token || join.token !== options.token) {
            runManager.send(socket, {
              type: "error",
              code: "bad_token",
              message: "Invalid or missing token"
            });
            socket.close();
            return;
          }
        }
        if (join.runId !== options.runId) {
          runManager.send(socket, {
            type: "error",
            code: "unknown_run",
            message: `Unknown run ${join.runId}`
          });
          return;
        }
        const client = runManager.addClient(socket, join.role, join.name);
        joined = true;
        runManager.send(socket, runManager.makeJoined(client));
        runManager.send(socket, { type: "run", status: runManager.getStatus() });
        runManager.send(socket, {
          type: "state",
          tick: runManager.run.tick,
          dt: 1 / runManager.tickRate,
          ships: runManager.snapshot()
        });
        // Notify other clients about the new player (after sending joined to this client)
        runManager.notifyPlayerJoined(client);
        return;
      }

      const controlResult = controlSchema.safeParse(parsed);
        if (controlResult.success) {
          if (options.mode === "multi") {
            const client = runManager.getClient(socket);
            if (!client || client.role !== "spectator") {
              runManager.send(socket, {
                type: "error",
                code: "forbidden",
                message: "Control actions are spectator-only"
              });
              return;
            }
          }
          if (controlResult.data.action === "start") runManager.startRun();
          if (controlResult.data.action === "reset") runManager.resetRun();
          if (controlResult.data.action === "setMap") {
            const name = controlResult.data.mapName;
            if (!name || !mapFiles.includes(name)) {
            runManager.send(socket, {
              type: "error",
              code: "unknown_map",
              message: "Map not found"
            });
            return;
          }
          const { map: nextMap, world: nextWorld } = await loadMap(name);
          currentMapName = name;
          runManager.setMap(nextMap, name, nextWorld);
        }
        return;
      }

      const commandResult = commandSchema.safeParse(parsed);
      if (commandResult.success) {
        runManager.handleCommand(socket, commandResult.data);
        return;
      }

      runManager.send(socket, {
        type: "error",
        code: "bad_message",
        message: "Message invalid"
      });
    });

    socket.on("close", () => {
      runManager.removeClient(socket);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port, resolve);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : options.port;

  runManager.start();

  let stopping = false;

  return {
    port: actualPort,
    stop: async () => {
      if (stopping) return;
      stopping = true;
      runManager.stop();
      wss.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  };
}
