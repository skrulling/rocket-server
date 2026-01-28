import type { BotInput, Command, Vec } from "../src/shared/types.js";

let path: Vec[] | null = null;
let index = 0;

function isWall(lines: string[], x: number, y: number): boolean {
  if (y < 0 || y >= lines.length) return true;
  if (x < 0 || x >= lines[0].length) return true;
  return lines[y][x] === "#";
}

function findPath(lines: string[], start: Vec, goal: Vec): Vec[] | null {
  const width = lines[0].length;
  const height = lines.length;
  const startX = Math.floor(start.x);
  const startY = Math.floor(start.y);
  const goalX = Math.floor(goal.x);
  const goalY = Math.floor(goal.y);

  const visited = new Array(width * height).fill(false);
  const prev = new Array(width * height).fill(-1);
  const queue: number[] = [];
  const startIdx = startY * width + startX;
  const goalIdx = goalY * width + goalX;

  queue.push(startIdx);
  visited[startIdx] = true;

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    if (current === goalIdx) break;
    const cx = current % width;
    const cy = Math.floor(current / width);

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isWall(lines, nx, ny)) continue;
      const ni = ny * width + nx;
      if (visited[ni]) continue;
      visited[ni] = true;
      prev[ni] = current;
      queue.push(ni);
    }
  }

  if (!visited[goalIdx]) return null;

  const tiles: Vec[] = [];
  let cur = goalIdx;
  while (cur !== startIdx && cur !== -1) {
    const x = cur % width;
    const y = Math.floor(cur / width);
    tiles.push({ x: x + 0.5, y: y + 0.5 });
    cur = prev[cur];
  }
  tiles.reverse();
  return tiles;
}

export function step(input: BotInput): Command {
  if (!path) {
    path = findPath(input.map.lines, input.map.start, input.map.goal);
    index = 0;
  }

  const target = path && path[index] ? path[index] : input.map.goal;
  const dx = target.x - input.self.pos.x;
  const dy = target.y - input.self.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.25 && path && index < path.length - 1) {
    index += 1;
  }

  return {
    throttle: 1,
    dir: { x: dx, y: dy }
  };
}
