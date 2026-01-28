# Multiplayer Competition

Host a competition where participants run their own rocket navigation algorithms against each other.

## Setup Overview

1. **Before the event**: Share the repo so participants can write their bots
2. **At the event**: Admin starts the server, participants connect their bots
3. **Competition**: Everyone watches the spectator UI as bots race

## For Participants

### 1. Get the Code (Before the Event)

Clone the repo and install dependencies:

```bash
git clone <repo-url>
cd rocket-server
npm install
```

### 2. Write Your Bot

Copy the template and give it your name:

```bash
cp -r clients/_template clients/my-name
```

Edit `clients/my-name/bot.ts` with your navigation algorithm:

```ts
import type { BotInput, Command } from "../../src/sdk/types.js";

export function step(input: BotInput): Command {
  // Your algorithm here!
  const dx = input.map.goal.x - input.self.pos.x;
  const dy = input.map.goal.y - input.self.pos.y;
  return { throttle: 1, dir: { x: dx, y: dy } };
}
```

See `docs/writing-a-bot.md` for the full API.

### 3. Test Locally

Start a local server:

```bash
npm run server:local
```

Run your bot:

```bash
npm run client -- --client my-name
```

Open http://localhost:4321 to watch.

### 4. Connect to the Competition Server

When the admin shares the connection command, run it with your bot name:

```bash
npm run client -- --client my-name --url ws://192.168.1.42:4321/ws --token mysecret
```

That's it! The `--url` and `--token` override your local config.

---

## For the Admin

### 1. Start the Server

```bash
npm run server:multi -- --token <pick-a-token>
```

The server displays connection info:

```
Server running in MULTI mode
─────────────────────────────────────
Local:   http://localhost:4321
Network: http://192.168.1.42:4321

Share this with players on your network:
  http://192.168.1.42:4321
```

### 2. Share with Participants

Share a command participants can copy-paste (replace with your actual IP):

```
npm run client -- --client YOUR-BOT-NAME --url ws://192.168.1.42:4321/ws --token mysecret
```

Participants just replace `YOUR-BOT-NAME` with their bot folder name.

### 3. Run the Competition

Open the spectator UI at http://localhost:4321 (or the network URL).

- Wait for participants to connect (you'll see them appear)
- Click **Start** to begin a race
- Click **Reset** to restart
- Use the dropdown to change maps

### Firewall Troubleshooting

If participants can't connect:

**macOS**: Allow incoming connections when prompted, or check System Settings > Network > Firewall

**Windows**: Allow through Windows Defender Firewall when prompted

**Linux**: `sudo ufw allow 4321/tcp`
