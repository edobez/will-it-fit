import { describe, expect, it } from "vitest";
import { collides, footprint } from "../src/core/collision";
import { pointInPoly } from "../src/core/geometry";
import { partsLocal } from "../src/core/vehicle";
import { toWorld } from "../src/core/kinematics";
import { plan } from "../src/planner/search";
import { toTrajectory } from "../src/planner/to-trajectory";
import type { PlanMessage, PlanOptions } from "../src/planner/types";
import { defaultCar, defaultScene } from "./helpers";

const OPTS: PlanOptions = {
  margin: 0.1, dirPenalty: 4, stopPenalty: 1.5, steerCost: 1.5, revFactor: 1.2,
  clrWeight: 1, softClr: 0.3, orient: "any", res: "normal",
  maxTime: 300, // generous: CI machines are slower; the expected runs take 1 to 20 s
};

// Upper bounds on the number of moves, from the current planner; tighten when the planner improves.
const CASES: [string, number][] = [
  ["garage", 2],
  ["bays90", 1],
  ["bays45", 1],
  ["parallelStreet", 4],
  ["parallelUnderground", 6],
];

describe.each(CASES)("planner on %s", (id, maxMoves) => {
  it(`finds a collision free manoeuvre into the space in at most ${maxMoves} moves`, () => {
    const car = defaultCar(), S = defaultScene(id, car);
    let result: PlanMessage | null = null;
    plan({ car, obstacles: S.obstacles, target: { poly: S.target.poly, noseDir: S.noseDir }, bounds: S.bounds, start: S.start, startDelta: 0, opts: OPTS },
      m => { if (m.type !== "progress") result = m; });
    expect(result).not.toBeNull();
    const r = result as unknown as PlanMessage;
    if (r.type !== "done") throw new Error(r.type === "fail" ? r.reason : "no result");

    const tr = toTrajectory(car, S.obstacles, S.start, 0, r.prims, 0.8);
    expect(tr.moves).toBeLessThanOrEqual(maxMoves);

    // every sample keeps the safety margin (small tolerance for sampling between lattice checks)
    for (const smp of tr.samples) expect(collides(footprint(car, smp, OPTS.margin - 0.02), S.obstacles)).toBe(false);

    // the final pose has the whole car, mirrors included, inside the target
    const end = tr.samples[tr.samples.length - 1];
    for (const part of partsLocal(car)) for (const v of part) expect(pointInPoly(toWorld(end, v[0], v[1]), S.target.poly)).toBe(true);
  });
});

describe("planner orientation goal", () => {
  it("parks nose in when asked, in the 90° bays", () => {
    const car = defaultCar(), S = defaultScene("bays90", car);
    let r: PlanMessage | null = null;
    plan({ car, obstacles: S.obstacles, target: { poly: S.target.poly, noseDir: S.noseDir }, bounds: S.bounds, start: S.start, startDelta: 0, opts: { ...OPTS, orient: "fwd" } },
      m => { if (m.type !== "progress") r = m; });
    const res = r as unknown as PlanMessage;
    if (res.type !== "done") throw new Error("no plan");
    const tr = toTrajectory(car, S.obstacles, S.start, 0, res.prims, 0.8);
    const end = tr.samples[tr.samples.length - 1];
    expect(Math.cos(end.th - S.noseDir)).toBeGreaterThan(0.5);
  });

  it("reports failure clearly when the space is too narrow", () => {
    const car = defaultCar(), S = defaultScene("bays90", car);
    const narrow = [[S.target.poly[0][0] + 0.6, S.target.poly[0][1]], [S.target.poly[1][0] - 0.6, S.target.poly[1][1]], [S.target.poly[2][0] - 0.6, S.target.poly[2][1]], [S.target.poly[3][0] + 0.6, S.target.poly[3][1]]] as [number, number][];
    let r: PlanMessage | null = null;
    plan({ car, obstacles: S.obstacles, target: { poly: narrow, noseDir: S.noseDir }, bounds: S.bounds, start: S.start, startDelta: 0, opts: OPTS },
      m => { if (m.type !== "progress") r = m; });
    expect((r as unknown as PlanMessage).type).toBe("fail");
  });
});
