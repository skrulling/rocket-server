import { describe, it, expect } from "vitest";
import { parseMap } from "../../src/sim/map.js";
import { collidesWithWalls } from "../../src/sim/collision.js";

describe("collidesWithWalls", () => {
  it("detects collision with wall tile", () => {
    const map = parseMap(`
#####
#S#G#
#####
`);

    expect(collidesWithWalls(map, { x: 2.5, y: 1.5 }, 0.4)).toBe(true);
    expect(collidesWithWalls(map, { x: 1.5, y: 1.5 }, 0.4)).toBe(false);
  });
});
