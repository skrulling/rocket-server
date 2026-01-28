import type { MapInfo, Vec } from "../shared/types.js";

export type MapData = MapInfo & {
  walls: boolean[];
};

export function parseMap(input: string): MapData {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("Map is empty");
  }

  const width = lines[0].length;
  const height = lines.length;
  if (!lines.every((l) => l.length === width)) {
    throw new Error("Map lines must have equal width");
  }

  let start: Vec | null = null;
  let goal: Vec | null = null;
  const walls: boolean[] = new Array(width * height).fill(false);

  for (let y = 0; y < height; y += 1) {
    const line = lines[y];
    for (let x = 0; x < width; x += 1) {
      const ch = line[x];
      const idx = y * width + x;
      if (ch === "#") walls[idx] = true;
      if (ch === "S") start = { x: x + 0.5, y: y + 0.5 };
      if (ch === "G") goal = { x: x + 0.5, y: y + 0.5 };
    }
  }

  if (!start) throw new Error("Map missing start (S)");
  if (!goal) throw new Error("Map missing goal (G)");

  return { width, height, lines, walls, start, goal };
}

export function isWall(map: MapData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
  const idx = y * map.width + x;
  return map.walls[idx] ?? false;
}
