import type { Vec } from "../shared/types.js";

export const vec = {
  add(a: Vec, b: Vec): Vec {
    return { x: a.x + b.x, y: a.y + b.y };
  },
  sub(a: Vec, b: Vec): Vec {
    return { x: a.x - b.x, y: a.y - b.y };
  },
  scale(a: Vec, s: number): Vec {
    return { x: a.x * s, y: a.y * s };
  },
  lenSq(a: Vec): number {
    return a.x * a.x + a.y * a.y;
  },
  len(a: Vec): number {
    return Math.hypot(a.x, a.y);
  },
  normalize(a: Vec): Vec {
    const l = Math.hypot(a.x, a.y);
    if (l === 0) return { x: 0, y: 0 };
    return { x: a.x / l, y: a.y / l };
  },
  clampLen(a: Vec, maxLen: number): Vec {
    const l = Math.hypot(a.x, a.y);
    if (l <= maxLen || l === 0) return a;
    const s = maxLen / l;
    return { x: a.x * s, y: a.y * s };
  },
  distance(a: Vec, b: Vec): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
};
