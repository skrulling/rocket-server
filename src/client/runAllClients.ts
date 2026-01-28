import { readFile, readdir, stat } from "node:fs/promises";
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
  dir: string;
  exclude: string[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = { dir: "clients", exclude: ["_template"] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!value) continue;
    if (key === "--dir") args.dir = value;
    if (key === "--exclude") args.exclude = value.split(",").map((s) => s.trim());
  }
  return args;
}

async function loadConfig(clientDir: string): Promise<ClientConfig | null> {
  try {
    const raw = await readFile(join(clientDir, "config.json"), "utf-8");
    const parsed = configSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function loadBot(modulePath: string): Promise<BotModule> {
  const mod = await import(pathToFileURL(modulePath).toString());
  return mod as BotModule;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.dir);
  const entries = await readdir(root);

  for (const entry of entries) {
    if (args.exclude.includes(entry)) continue;
    const dir = join(root, entry);
    let stats;
    try {
      stats = await stat(dir);
    } catch {
      continue;
    }
    if (!stats.isDirectory()) continue;

    const config = await loadConfig(dir);
    if (!config) {
      console.warn(`Skipping ${entry}: missing or invalid config.json`);
      continue;
    }

    const name = config.name ?? entry;
    const url = config.url ?? "ws://localhost:4321/ws";
    const runId = config.runId ?? "default";
    const entryPath = resolve(dir, config.entry ?? "./bot.ts");

    try {
      const botModule = await loadBot(entryPath);
      const controller = toController(botModule);
      connectAndRun({ url, runId, name, token: config.token, controller });
      console.log(`Started ${entry} as ${name}`);
    } catch (err) {
      console.warn(`Failed ${entry}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
