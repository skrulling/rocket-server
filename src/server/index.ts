import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { networkInterfaces } from "node:os";
import { startServer } from "./startServer.js";

function getLocalIP(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      // Skip internal and non-IPv4 addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type Args = {
  mode: "local" | "multi";
  token?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { mode: "local" };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value) continue;
    if (key === "--mode" && (value === "local" || value === "multi")) {
      args.mode = value;
    }
    if (key === "--token") args.token = value;
  }
  return args;
}

const cli = parseArgs(process.argv.slice(2));
if (cli.mode === "multi" && !cli.token) {
  console.error("Missing --token for multiplayer mode");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 4321);
const runId = process.env.RUN_ID ?? "default";
const tickRate = Number(process.env.TICK_RATE ?? 60);
const snapshotRate = Number(process.env.SNAPSHOT_RATE ?? 20);

const mapPath = process.env.MAP_PATH ?? join(__dirname, "../../maps/smoke.txt");
const mapsDir = process.env.MAPS_DIR ?? join(__dirname, "../../maps");
const publicDir = process.env.PUBLIC_DIR ?? join(__dirname, "../../public");

startServer({
  port,
  runId,
  mapPath,
  mapsDir,
  tickRate,
  snapshotRate,
  publicDir,
  mode: cli.mode,
  token: cli.token
})
  .then(({ port: actualPort }) => {
    const localIP = getLocalIP();
    console.log(`\nServer running in ${cli.mode.toUpperCase()} mode`);
    console.log(`─────────────────────────────────────`);
    console.log(`Local:   http://localhost:${actualPort}`);
    if (localIP) {
      console.log(`Network: http://${localIP}:${actualPort}`);
    }
    if (cli.mode === "multi" && localIP && cli.token) {
      console.log(`\nShare this command with participants:`);
      console.log(`  npm run client -- --client YOUR-BOT --url ws://${localIP}:${actualPort}/ws --token ${cli.token}`);
    }
    console.log();
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
