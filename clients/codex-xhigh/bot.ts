import type { RocketController } from "../../src/sdk/controller.js";
import type { BotInput, Command, MapInfo, Vec } from "../../src/sdk/types.js";

type GridPath = {
  waypoints: Vec[];
  index: number;
};

type PidState = {
  integral: number;
  prevError: number;
};

const pid: PidState = { integral: 0, prevError: 0 };
let currentPath: GridPath | null = null;
let lastMap: MapInfo | null = null;

const KP = 1.1;
const KI = 0.25;
const KD = 0.35;
const INTEGRAL_CLAMP = 6;
const WAYPOINT_RADIUS = 0.35;

function resetState(): void {
  pid.integral = 0;
  pid.prevError = 0;
  currentPath = null;
}

function isWall(lines: string[], x: number, y: number): boolean {
  if (y < 0 || y >= lines.length) return true;
  if (x < 0 || x >= lines[0].length) return true;
  return lines[y][x] === "#";
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function buildPath(prev: number[], startIdx: number, goalIdx: number, width: number): Vec[] {
  const path: Vec[] = [];
  let cur = goalIdx;
  if (prev[cur] === -1 && cur !== startIdx) return path;
  while (cur !== -1) {
    const x = cur % width;
    const y = Math.floor(cur / width);
    path.push({ x: x + 0.5, y: y + 0.5 });
    if (cur === startIdx) break;
    cur = prev[cur];
  }
  path.reverse();
  return path;
}

function findPath(lines: string[], start: Vec, goal: Vec): Vec[] {
  const width = lines[0].length;
  const height = lines.length;
  const startX = Math.floor(start.x);
  const startY = Math.floor(start.y);
  const goalX = Math.floor(goal.x);
  const goalY = Math.floor(goal.y);

  const startIdx = startY * width + startX;
  const goalIdx = goalY * width + goalX;

  const open: number[] = [startIdx];
  const inOpen = new Array(width * height).fill(false);
  const closed = new Array(width * height).fill(false);
  const gScore = new Array(width * height).fill(Number.POSITIVE_INFINITY);
  const fScore = new Array(width * height).fill(Number.POSITIVE_INFINITY);
  const prev = new Array(width * height).fill(-1);

  gScore[startIdx] = 0;
  fScore[startIdx] = heuristic(startX, startY, goalX, goalY);
  inOpen[startIdx] = true;

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (fScore[open[i]] < fScore[open[bestIdx]]) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    inOpen[current] = false;

    if (current === goalIdx) break;
    closed[current] = true;

    const cx = current % width;
    const cy = Math.floor(current / width);

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isWall(lines, nx, ny)) continue;
      const ni = ny * width + nx;
      if (closed[ni]) continue;
      const tentative = gScore[current] + 1;
      if (tentative < gScore[ni]) {
        prev[ni] = current;
        gScore[ni] = tentative;
        fScore[ni] = tentative + heuristic(nx, ny, goalX, goalY);
        if (!inOpen[ni]) {
          open.push(ni);
          inOpen[ni] = true;
        }
      }
    }
  }

  const path = buildPath(prev, startIdx, goalIdx, width);
  return path.length > 0 ? path : [goal];
}

function ensurePath(input: BotInput): void {
  if (!currentPath) {
    const waypoints = findPath(input.map.lines, input.self.pos, input.map.goal);
    currentPath = { waypoints, index: 0 };
  }
}

function nextTarget(input: BotInput): Vec {
  ensurePath(input);
  if (!currentPath) return input.map.goal;

  const target = currentPath.waypoints[currentPath.index] ?? input.map.goal;
  const dx = target.x - input.self.pos.x;
  const dy = target.y - input.self.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < WAYPOINT_RADIUS && currentPath.index < currentPath.waypoints.length - 1) {
    currentPath.index += 1;
  }
  return currentPath.waypoints[currentPath.index] ?? input.map.goal;
}

function normalize(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y);
  if (l === 0) return { x: 1, y: 0 };
  return { x: v.x / l, y: v.y / l };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeThrottle(input: BotInput, dir: Vec, distance: number): number {
  const desiredSpeed = clamp(distance * 1.6, 0.2, input.world.maxSpeed * 0.8);
  const speedAlong = input.self.vel.x * dir.x + input.self.vel.y * dir.y;
  const error = desiredSpeed - speedAlong;

  pid.integral = clamp(pid.integral + error * input.dt, -INTEGRAL_CLAMP, INTEGRAL_CLAMP);
  const derivative = (error - pid.prevError) / Math.max(input.dt, 1e-5);
  pid.prevError = error;

  const desiredAccel = KP * error + KI * pid.integral + KD * derivative;
  const gravityAlong = input.world.gravity.x * dir.x + input.world.gravity.y * dir.y;
  const thrustAccel = desiredAccel - gravityAlong;

  return clamp(thrustAccel / input.world.maxThrust, 0, 1);
}

export const controller: RocketController = {
  onJoined(ctx) {
    lastMap = ctx.map;
    resetState();
  },
  onMap(ctx) {
    lastMap = ctx.map;
    resetState();
    currentPath = { waypoints: findPath(ctx.map.lines, ctx.map.start, ctx.map.goal), index: 0 };
  },
  onRunStatus(status) {
    if (status === "paused" && lastMap) {
      resetState();
      currentPath = { waypoints: findPath(lastMap.lines, lastMap.start, lastMap.goal), index: 0 };
    }
  },
  step(input: BotInput): Command {
    if (lastMap && lastMap !== input.map) {
      lastMap = input.map;
      resetState();
    }

    const target = nextTarget(input);
    const toTarget = { x: target.x - input.self.pos.x, y: target.y - input.self.pos.y };
    const distance = Math.hypot(toTarget.x, toTarget.y);

    let dir = normalize(toTarget);
    const gravity = input.world.gravity;
    const gAdjust = 0.12;
    dir = normalize({ x: dir.x - gravity.x * gAdjust, y: dir.y - gravity.y * gAdjust });

    const throttle = computeThrottle(input, dir, distance);
    return { throttle, dir };
  }
};
