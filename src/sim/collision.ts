import type { Vec } from "../shared/types.js";
import type { MapData } from "./map.js";
import { isWall } from "./map.js";

export function circleIntersectsAabb(
  pos: Vec,
  radius: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  const clampedX = Math.max(minX, Math.min(pos.x, maxX));
  const clampedY = Math.max(minY, Math.min(pos.y, maxY));
  const dx = pos.x - clampedX;
  const dy = pos.y - clampedY;
  return dx * dx + dy * dy <= radius * radius;
}

export function collidesWithWalls(
  map: MapData,
  pos: Vec,
  radius: number
): boolean {
  const minX = Math.floor(pos.x - radius);
  const maxX = Math.floor(pos.x + radius);
  const minY = Math.floor(pos.y - radius);
  const maxY = Math.floor(pos.y + radius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!isWall(map, x, y)) continue;
      if (circleIntersectsAabb(pos, radius, x, y, x + 1, y + 1)) return true;
    }
  }

  return false;
}
