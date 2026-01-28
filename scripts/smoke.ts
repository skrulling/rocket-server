import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { startServer } from "../src/server/startServer.js";
import { runBot } from "../src/client/botRunner.js";
import { step as seekGoal } from "../bots/seekGoal.js";
import { step as smoothApproach } from "../bots/smoothApproach.js";
import { step as stabilized } from "../bots/stabilized.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  const runId = "smoke";
  const { port, stop } = await startServer({
    port: 4321,
    runId,
    mapPath: join(__dirname, "../maps/smoke.txt"),
    mapsDir: join(__dirname, "../maps"),
    tickRate: 60,
    snapshotRate: 20,
    publicDir: join(__dirname, "../public"),
    mode: "local"
  });

  const url = `ws://localhost:${port}/ws`;
  runBot({ url, runId, name: "seek-goal", bot: { step: seekGoal } });
  runBot({ url, runId, name: "smooth-approach", bot: { step: smoothApproach } });
  runBot({ url, runId, name: "stabilized", bot: { step: stabilized } });

  console.log(`Smoke run started.`);
  console.log(`Open http://localhost:${port}/?run=${runId} to spectate.`);
  console.log(`Press Ctrl+C to stop.`);

  let stopping = false;
  process.once("SIGINT", async () => {
    if (stopping) return;
    stopping = true;
    await stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
