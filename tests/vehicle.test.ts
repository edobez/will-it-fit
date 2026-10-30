import { describe, expect, it } from "vitest";
import { deriveCar } from "../src/core/vehicle";
import { defaultCar } from "./helpers";

describe("deriveCar", () => {
  it("derives the max wheel angle so the outer front wheel traces the turning circle", () => {
    const g = defaultCar({ turningCircle: 11.4 });
    const Rrear = g.wb / Math.tan(g.dmax);
    const outerFront = Math.hypot(Rrear + g.trackHalf, g.wb);
    expect(outerFront).toBeCloseTo(11.4 / 2, 6);
  });

  it("computes overhangs from length, wheelbase and front overhang", () => {
    const g = defaultCar({ carLength: 4.5, wheelbase: 2.7, frontOverhang: 0.9 });
    expect(g.ro).toBeCloseTo(0.9); expect(g.xf).toBeCloseTo(3.6);
  });

  it("warns and clamps an impossible geometry", () => {
    const base = { carLength: 4, carWidth: 1.8, mirrorWidth: 2, mirrorFromFront: 1.8, wheelbase: 3.5, frontOverhang: 1, track: 1.5, turningCircle: 11, mirrorsFolded: false };
    const { geom, warnings } = deriveCar(base);
    expect(geom.ro).toBe(0.05);
    expect(warnings.length).toBe(1);
  });

  it("folding the mirrors narrows the car to roughly the body", () => {
    expect(defaultCar({ mirrorsFolded: true }).mw2).toBeCloseTo(defaultCar().w2 + 0.05);
  });
});
