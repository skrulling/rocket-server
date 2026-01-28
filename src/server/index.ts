import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { networkInterfaces, platform } from "node:os";
import { execSync } from "node:child_process";
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

// macOS firewall management
const isMacOS = platform() === "darwin";
let firewallConfigured = false;
let nodePath: string | null = null;

function configureFirewall(): boolean {
  if (!isMacOS) return false;

  try {
    nodePath = execSync("which node", { encoding: "utf-8" }).trim();
    console.log("Configuring macOS firewall (requires sudo)...");
    execSync(`sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "${nodePath}"`, { stdio: "inherit" });
    execSync(`sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "${nodePath}"`, { stdio: "inherit" });
    firewallConfigured = true;
    console.log("Firewall configured to allow incoming connections.\n");
    return true;
  } catch (err) {
    console.error("Failed to configure firewall:", err instanceof Error ? err.message : err);
    console.error("You may need to manually allow connections in System Settings → Network → Firewall\n");
    return false;
  }
}

function revertFirewall(): void {
  if (!isMacOS || !firewallConfigured || !nodePath) return;

  try {
    console.log("\nReverting firewall settings...");
    execSync(`sudo /usr/libexec/ApplicationFirewall/socketfilterfw --blockapp "${nodePath}"`, { stdio: "inherit" });
    console.log("Firewall settings reverted.");
  } catch (err) {
    console.error("Failed to revert firewall:", err instanceof Error ? err.message : err);
  }
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

// Configure firewall for multi mode on macOS
if (cli.mode === "multi" && isMacOS) {
  configureFirewall();
}

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
  .then(({ port: actualPort, stop }) => {
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

    // Cleanup on exit
    const cleanup = async () => {
      console.log("\nShutting down server...");
      await stop();
      revertFirewall();
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    revertFirewall();
    process.exit(1);
  });
