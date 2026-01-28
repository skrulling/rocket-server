import { describe, it, expect } from "vitest";
import { parseMap } from "../../src/sim/map.js";
import { Run } from "../../src/sim/run.js";

describe("Run", () => {
  it("crashes when hitting a wall", () => {
    const map = parseMap(`
#####
#S#G#
#####
`);

    const run = new Run(map, {
      gravity: { x: 0, y: 0 },
      maxThrust: 1,
      damping: 0,
      maxSpeed: 10,
      maxLandingSpeed: 3,
      shipRadius: 0.4,
      goalRadius: 0.4
    });

    const ship = run.addPlayer("p1", "bot");
    run.setCommand(ship.id, { throttle: 1, dir: { x: 1, y: 0 } });
    run.step(1);

    const updated = run.getShips()[0];
    expect(updated.status).toBe("crashed");
  });

  it("finishes when entering the goal", () => {
    const map = parseMap(`
#####
#SG.#
#####
`);

    const run = new Run(map, {
      gravity: { x: 0, y: 0 },
      maxThrust: 0.5,
      damping: 0,
      maxSpeed: 10,
      maxLandingSpeed: 3,
      shipRadius: 0.2,
      goalRadius: 0.6
    });

    const ship = run.addPlayer("p1", "bot");
    run.setCommand(ship.id, { throttle: 1, dir: { x: 1, y: 0 } });
    run.step(1);

    const updated = run.getShips()[0];
    expect(updated.status).toBe("finished");
  });

  it("crashes on hard landing when exceeding max landing speed", () => {
    const map = parseMap(`
#####
#SG.#
#####
`);

    const run = new Run(map, {
      gravity: { x: 0, y: 0 },
      maxThrust: 10,
      damping: 0,
      maxSpeed: 20,
      maxLandingSpeed: 3,
      shipRadius: 0.2,
      goalRadius: 0.6
    });

    const ship = run.addPlayer("p1", "bot");
    run.setCommand(ship.id, { throttle: 1, dir: { x: 1, y: 0 } });
    run.step(1);

    const updated = run.getShips()[0];
    expect(updated.status).toBe("crashed");
  });
});
