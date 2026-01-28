import { describe, it, expect } from "vitest";
import { parseMap } from "../../src/sim/map.js";

describe("parseMap", () => {
  it("parses width/height and start/goal", () => {
    const map = parseMap(`
#####
#S..#
#..G#
#####
`);

    expect(map.width).toBe(5);
    expect(map.height).toBe(4);
    expect(map.start).toEqual({ x: 1.5, y: 1.5 });
    expect(map.goal).toEqual({ x: 3.5, y: 2.5 });
  });
});
