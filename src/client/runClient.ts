import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { connectAndRun, toController } from "../sdk/client.js";
import type { BotModule } from "../sdk/controller.js";

const configSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
  entry: z.string().min(1).optional()
});

type ClientConfig = z.infer<typeof configSchema>;

type Args = {
  clientId: string;
  overrides: Partial<ClientConfig>;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { clientId: "", overrides: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value) continue;
    if (key === "--client") args.clientId = value;
    if (key === "--name") args.overrides.name = value;
    if (key === "--url") args.overrides.url = value;
    if (key === "--run") args.overrides.runId = value;
    if (key === "--token") args.overrides.token = value;
    if (key === "--entry") args.overrides.entry = value;
  }
  if (!args.clientId) {
    throw new Error(
      "Usage: npm run client -- --client <id> [--url <ws://host:port/ws>] [--token <token>]"
    );
  }
  return args;
}

async function loadConfig(clientId: string): Promise<{ config: ClientConfig; dir: string }> {
  const dir = resolve("clients", clientId);
  const raw = await readFile(join(dir, "config.json"), "utf-8");
  const parsed = configSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("Invalid config.json");
  }
  return { config: parsed.data, dir };
}

async function loadBot(modulePath: string): Promise<BotModule> {
  const mod = await import(pathToFileURL(modulePath).toString());
  return mod as BotModule;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { config, dir } = await loadConfig(args.clientId);
  const merged: ClientConfig = { ...config, ...args.overrides };

  const name = merged.name ?? args.clientId;
  const url = merged.url ?? "ws://localhost:4321/ws";
  const runId = merged.runId ?? "default";
  const entry = merged.entry ?? "./bot.ts";

  const entryPath = resolve(dir, entry);
  const botModule = await loadBot(entryPath);
  const controller = toController(botModule);

  const socket = connectAndRun({
    url,
    runId,
    name,
    token: merged.token,
    controller
  });

  socket.on("open", () => {
    console.log(`Connected to ${url} as ${name}`);
  });

  socket.on("close", () => {
    console.log("Disconnected");
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
