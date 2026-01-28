import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { runBot } from "./botRunner.js";
import type { Bot } from "./botRunner.js";

type Args = {
  url: string;
  runId: string;
  name: string;
  botPath: string;
};

function parseArgs(argv: string[]): Args {
  const [url, ...rest] = argv;
  if (!url) throw new Error("Usage: rocket <ws-url> --run <id> --name <name> --bot <path>");

  const args: Args = {
    url,
    runId: "default",
    name: `bot-${Math.floor(Math.random() * 1000)}`,
    botPath: ""
  };

  for (let i = 0; i < rest.length; i += 1) {
    const key = rest[i];
    const value = rest[i + 1];
    if (!value) continue;
    if (key === "--run") args.runId = value;
    if (key === "--name") args.name = value;
    if (key === "--bot") args.botPath = value;
  }

  if (!args.botPath) throw new Error("Missing --bot <path>");
  return args;
}

async function loadBot(botPath: string): Promise<Bot> {
  const full = resolve(botPath);
  const mod = await import(pathToFileURL(full).toString());
  if (!mod.step || typeof mod.step !== "function") {
    throw new Error("Bot module must export a step(input) function");
  }
  return { step: mod.step };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const bot = await loadBot(args.botPath);
  const socket = runBot({
    url: args.url,
    runId: args.runId,
    name: args.name,
    bot
  });

  socket.on("open", () => {
    console.log(`Connected to ${args.url} as ${args.name}`);
  });

  socket.on("close", () => {
    console.log("Disconnected");
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
