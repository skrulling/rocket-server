const canvas = document.getElementById("canvas");
const meta = document.getElementById("meta");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const playersEl = document.getElementById("players");
const mapSelect = document.getElementById("mapSelect");
const mapBtn = document.getElementById("mapBtn");
const tokenInput = document.getElementById("tokenInput");
const ctx = canvas.getContext("2d");

// Load rocket SVG
const rocketImg = new Image();
rocketImg.src = "/rocket-svgrepo-com.svg";

const params = new URLSearchParams(window.location.search);
const runId = params.get("run") ?? "default";

let socket = null;
let reconnectAttempts = 0;
const maxReconnectDelay = 5000;

let map = null;
let ships = [];
let tick = 0;
let dt = 0;
let status = "paused";
let tickRate = 0;
let world = null;
let connected = false;
const colorMap = new Map();
const finishOrder = [];
const palette = [
  "#ffb703",
  "#8ecae6",
  "#ff6b6b",
  "#4cc9f0",
  "#b8f2e6",
  "#ffd166",
  "#a7c957",
  "#f28482"
];

const TOKEN_KEY = "rocket.token";
tokenInput.value = localStorage.getItem(TOKEN_KEY) || "";
tokenInput.addEventListener("change", () => {
  localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
});

// Toast notification system
const toastContainer = document.createElement("div");
toastContainer.id = "toasts";
toastContainer.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
  pointer-events: none;
`;
document.body.appendChild(toastContainer);

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  const colors = {
    info: "rgba(142, 202, 230, 0.95)",
    success: "rgba(82, 183, 136, 0.95)",
    warning: "rgba(255, 209, 102, 0.95)",
    error: "rgba(239, 71, 111, 0.95)"
  };
  toast.style.cssText = `
    background: ${colors[type] || colors.info};
    color: #0f141a;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
  `;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.3s ease-out forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add toast animations to page
const style = document.createElement("style");
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  .connection-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 6px;
    transition: background 0.3s;
  }
  .connection-dot.connected { background: #52b788; }
  .connection-dot.disconnected { background: #ef476f; }
  .connection-dot.connecting { background: #ffd166; animation: pulse 1s infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;
document.head.appendChild(style);

function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  updateConnectionStatus("connecting");
  socket = new WebSocket(`ws://${location.host}/ws`);

  socket.addEventListener("open", () => {
    connected = true;
    reconnectAttempts = 0;
    updateConnectionStatus("connected");
    socket.send(
      JSON.stringify({
        type: "join",
        runId,
        role: "spectator",
        name: "spectator",
        token: tokenInput.value.trim() || undefined
      })
    );
    loadMaps();
  });

  socket.addEventListener("close", () => {
    connected = false;
    updateConnectionStatus("disconnected");
    disableControls();
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    connected = false;
    updateConnectionStatus("disconnected");
  });

  socket.addEventListener("message", handleMessage);
}

function scheduleReconnect() {
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts - 1), maxReconnectDelay);
  showToast(`Reconnecting in ${(delay / 1000).toFixed(1)}s...`, "warning");
  setTimeout(connect, delay);
}

function updateConnectionStatus(state) {
  let dot = document.querySelector(".connection-dot");
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "connection-dot";
    meta.parentNode.insertBefore(dot, meta);
  }
  dot.className = `connection-dot ${state}`;
}

function disableControls() {
  startBtn.disabled = true;
  resetBtn.disabled = true;
  mapSelect.disabled = true;
  mapBtn.disabled = true;
}

function enableControls() {
  startBtn.disabled = status === "running";
  resetBtn.disabled = false;
  mapSelect.disabled = false;
  mapBtn.disabled = false;
}

function handleMessage(event) {
  const message = JSON.parse(event.data);

  if (message.type === "error") {
    meta.textContent = `Error: ${message.message}`;
    showToast(message.message, "error");
  }

  if (message.type === "joined") {
    map = message.map;
    world = message.world;
    tickRate = message.tickRate;
    updateMeta();
    resizeCanvas();
    enableControls();
    showToast("Connected to server", "success");
  }

  if (message.type === "map") {
    map = message.map;
    world = message.world;
    if (message.mapName) {
      mapSelect.value = message.mapName;
    }
    resizeCanvas();
    finishOrder.length = 0;
    renderPlayers();
    showToast(`Map changed to ${message.mapName?.replace(/\.txt$/, "") || "new map"}`, "info");
  }

  if (message.type === "run") {
    status = message.status;
    updateMeta();
    startBtn.disabled = status === "running";
    if (status === "paused") {
      finishOrder.length = 0;
    }
    if (status === "running") {
      showToast("Race started!", "success");
    }
  }

  if (message.type === "state") {
    ships = message.ships;
    tick = message.tick;
    dt = message.dt;
    updateFinishOrder();
    renderPlayers();
  }

  if (message.type === "event") {
    handleEvent(message);
  }
}

function handleEvent(event) {
  switch (event.name) {
    case "playerJoined":
      showToast(`${event.playerName} joined`, "info");
      break;
    case "playerLeft":
      showToast(`${event.playerName} left`, "warning");
      break;
    case "playerCrashed":
      const crashedShip = ships.find(s => s.id === event.playerId);
      if (crashedShip) {
        showToast(`${crashedShip.name} crashed!`, "error");
      }
      break;
    case "playerFinished":
      const finishedShip = ships.find(s => s.id === event.playerId);
      if (finishedShip) {
        const position = finishOrder.indexOf(event.playerId) + 1;
        const medal = position === 1 ? "🥇" : position === 2 ? "🥈" : position === 3 ? "🥉" : "";
        showToast(`${medal} ${finishedShip.name} finished #${position}!`, "success");
      }
      break;
  }
}

function updateMeta() {
  const playerCount = ships.length;
  meta.textContent = `Run ${runId} • ${tickRate || "?"} Hz • ${status} • ${playerCount} player${playerCount !== 1 ? "s" : ""}`;
}

startBtn.addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "control", action: "start" }));
  }
});

resetBtn.addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "control", action: "reset" }));
  }
});

mapBtn.addEventListener("click", () => {
  const name = mapSelect.value;
  if (!name || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "control", action: "setMap", mapName: name }));
});

window.addEventListener("resize", resizeCanvas);

function resizeCanvas() {
  if (!map) return;
  const maxWidth = Math.min(900, window.innerWidth * 0.9);
  const aspect = map.width / map.height;
  canvas.width = Math.round(maxWidth);
  canvas.height = Math.round(maxWidth / aspect);
}

function draw() {
  if (!map) {
    requestAnimationFrame(draw);
    return;
  }

  const cellW = canvas.width / map.width;
  const cellH = canvas.height / map.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (map.lines[y][x] === "#") {
        ctx.fillStyle = "#2b3a4a";
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
  }

  const goalRadius = world?.goalRadius ?? 0.5;
  const shipRadius = world?.shipRadius ?? 0.3;

  ctx.fillStyle = "#52b788";
  ctx.beginPath();
  ctx.arc(map.goal.x * cellW, map.goal.y * cellH, goalRadius * Math.min(cellW, cellH), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,183,3,0.6)";
  ctx.beginPath();
  ctx.arc(map.start.x * cellW, map.start.y * cellH, Math.min(cellW, cellH) * 0.25, 0, Math.PI * 2);
  ctx.fill();

  for (const ship of ships) {
    if (!ship) continue;
    if (!colorMap.has(ship.id)) {
      const color = palette[colorMap.size % palette.length];
      colorMap.set(ship.id, color);
    }
    const shipColor = colorMap.get(ship.id);

    const x = ship.pos.x * cellW;
    const y = ship.pos.y * cellH;
    const size = shipRadius * Math.min(cellW, cellH) * 2.5;

    // Calculate rotation angle from velocity
    // atan2 gives angle where 0=right, π/2=down, etc.
    // The SVG rocket points upper-right (~-45deg), so we offset by π/4
    const speed = Math.hypot(ship.vel.x, ship.vel.y);
    // Default to pointing up (-π/2) when stationary, which requires -π/4 rotation for our SVG
    const angle = speed < 0.1
      ? -Math.PI / 4  // Points up when stationary
      : Math.atan2(ship.vel.y, ship.vel.x) + Math.PI / 4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Dim if finished or crashed
    if (ship.status === "finished") {
      ctx.globalAlpha = 0.7;
    } else if (ship.status === "crashed") {
      ctx.globalAlpha = 0.5;
    }

    if (rocketImg.complete) {
      // Draw rocket with color tint using offscreen canvas
      const offscreen = document.createElement("canvas");
      offscreen.width = size;
      offscreen.height = size;
      const offCtx = offscreen.getContext("2d");

      // Draw the rocket
      offCtx.drawImage(rocketImg, 0, 0, size, size);

      // Replace color entirely using source-in compositing (keeps alpha, replaces color)
      offCtx.globalCompositeOperation = "source-in";
      offCtx.fillStyle = shipColor;
      offCtx.fillRect(0, 0, size, size);

      // Draw the colored rocket
      ctx.drawImage(offscreen, -size / 2, -size / 2);
    } else {
      // Fallback circle if image not loaded
      ctx.fillStyle = shipColor;
      ctx.beginPath();
      ctx.arc(0, 0, shipRadius * Math.min(cellW, cellH), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    ctx.fillStyle = "rgba(232,240,248,0.9)";
    ctx.font = "12px 'Space Grotesk', sans-serif";
    ctx.fillText(ship.name, x + size / 2 + 4, y - size / 2);
  }

  ctx.fillStyle = "rgba(232,240,248,0.8)";
  ctx.font = "12px 'Space Grotesk', sans-serif";
  ctx.fillText(`Tick ${tick} • dt ${dt.toFixed(3)}`, 8, canvas.height - 8);

  requestAnimationFrame(draw);
}

async function loadMaps() {
  try {
    const res = await fetch("/api/maps");
    const data = await res.json();
    mapSelect.innerHTML = "";
    for (const name of data.maps || []) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name.replace(/\.txt$/, "");
      if (data.current === name) opt.selected = true;
      mapSelect.appendChild(opt);
    }
  } catch {
    mapSelect.innerHTML = "";
  }
}

function updateFinishOrder() {
  for (const ship of ships) {
    if (ship.status !== "finished") continue;
    if (finishOrder.includes(ship.id)) continue;
    finishOrder.push(ship.id);
  }
}

function medalFor(shipId) {
  const idx = finishOrder.indexOf(shipId);
  if (idx === 0) return "🥇";
  if (idx === 1) return "🥈";
  if (idx === 2) return "🥉";
  return "";
}

function formatTime(seconds) {
  if (seconds < 0 || !isFinite(seconds)) return "0.000s";
  if (seconds < 60) {
    return seconds.toFixed(3) + "s";
  }
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, "0")}`;
}

function getShipTime(ship) {
  // Calculate time based on tick and dt
  const tickToUse = ship.finishTick ?? ship.crashTick ?? tick;
  return tickToUse * dt;
}

function renderPlayers() {
  playersEl.innerHTML = "";
  // Sort: finished first (by finish time), then alive, then crashed
  const ordered = [...ships].sort((a, b) => {
    if (a.status === "finished" && b.status !== "finished") return -1;
    if (b.status === "finished" && a.status !== "finished") return 1;
    if (a.status === "finished" && b.status === "finished") {
      return (a.finishTick ?? 0) - (b.finishTick ?? 0);
    }
    if (a.status === "alive" && b.status !== "alive") return -1;
    if (b.status === "alive" && a.status !== "alive") return 1;
    return a.name.localeCompare(b.name);
  });

  for (const ship of ordered) {
    if (!colorMap.has(ship.id)) {
      const color = palette[colorMap.size % palette.length];
      colorMap.set(ship.id, color);
    }
    const baseColor = colorMap.get(ship.id);
    const medal = medalFor(ship.id);
    const time = getShipTime(ship);

    const row = document.createElement("div");
    row.className = "player";

    const info = document.createElement("div");
    info.className = "player-info";

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = baseColor;

    const name = document.createElement("span");
    name.textContent = ship.name;

    info.appendChild(swatch);
    info.appendChild(name);

    const rightSide = document.createElement("div");
    rightSide.style.cssText = "display: flex; align-items: center; gap: 12px;";

    const timerEl = document.createElement("span");
    timerEl.className = "timer";
    const timerColor = ship.status === "finished" ? "#52b788" : ship.status === "crashed" ? "#ef476f" : "#ffffff";
    timerEl.style.cssText = `
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 0.85rem;
      color: ${timerColor};
      min-width: 70px;
      text-align: right;
    `;
    timerEl.textContent = formatTime(time);

    const statusEl = document.createElement("span");
    statusEl.className = "status";
    statusEl.textContent = `${medal} ${ship.status}`.trim();

    rightSide.appendChild(timerEl);
    rightSide.appendChild(statusEl);

    row.appendChild(info);
    row.appendChild(rightSide);
    playersEl.appendChild(row);
  }

  // Update meta with player count
  updateMeta();
}

// Initialize connection
connect();
requestAnimationFrame(draw);
