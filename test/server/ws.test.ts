import { describe, it, expect } from "vitest";
import WebSocket from "ws";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer } from "../../src/server/startServer.js";

function waitForMessage<T = any>(socket: WebSocket, predicate: (msg: any) => boolean, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for message"));
    }, timeoutMs);

    function onMessage(data: WebSocket.RawData) {
      const msg = JSON.parse(data.toString());
      if (predicate(msg)) {
        cleanup();
        resolve(msg);
      }
    }

    function cleanup() {
      clearTimeout(timeout);
      socket.off("message", onMessage);
    }

    socket.on("message", onMessage);
  });
}

describe("ws server", () => {
  it("accepts joins and broadcasts state", async () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const mapPath = join(__dirname, "../../maps/smoke.txt");

    const { port, stop } = await startServer({
      port: 0,
      runId: "test",
      mapPath,
      mapsDir: join(__dirname, "../../maps"),
      tickRate: 30,
      snapshotRate: 10,
      publicDir: join(__dirname, "../../public"),
      mode: "local"
    });

    const player = new WebSocket(`ws://localhost:${port}/ws`);
    const spectator = new WebSocket(`ws://localhost:${port}/ws`);

    await new Promise<void>((resolve) => player.on("open", () => resolve()));
    await new Promise<void>((resolve) => spectator.on("open", () => resolve()));

    player.send(JSON.stringify({ type: "join", runId: "test", role: "player", name: "p1" }));
    spectator.send(JSON.stringify({ type: "join", runId: "test", role: "spectator", name: "spec" }));

    const joined = await waitForMessage(player, (msg) => msg.type === "joined");
    expect(joined.role).toBe("player");
    expect(joined.playerId).toBeDefined();

    await waitForMessage(spectator, (msg) => msg.type === "joined");

    player.send(JSON.stringify({ type: "control", action: "start" }));

    const firstState = await waitForMessage(player, (msg) => msg.type === "state");
    expect(firstState.ships.length).toBeGreaterThan(0);
    const firstShip = firstState.ships.find((s: any) => s.id === joined.playerId);
    expect(firstShip).toBeDefined();

    player.send(JSON.stringify({ type: "command", throttle: 1, dir: { x: 1, y: 0 } }));

    const movedState = await waitForMessage(player, (msg) => {
      if (msg.type !== "state") return false;
      const ship = msg.ships.find((s: any) => s.id === joined.playerId);
      if (!ship) return false;
      return ship.pos.x !== firstShip.pos.x || ship.pos.y !== firstShip.pos.y;
    });

    expect(movedState.type).toBe("state");

    player.close();
    spectator.close();
    await stop();
  });
});
