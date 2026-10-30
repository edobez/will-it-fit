import { describe, expect, it } from "vitest";
import { clearance, collides, footprint, type Obstacle } from "../src/core/collision";
import { bbox, rect } from "../src/core/geometry";
import { defaultCar } from "./helpers";

const obstacle = (kind: Obstacle["kind"], poly = rect(0, 1.0, 10, 2)): Obstacle => ({ kind, poly, bb: bbox(poly), low: kind === "curb" });

describe("curbs are low obstacles", () => {
  const car = defaultCar();
  // car along +x with its left side 0.05 m over the obstacle edge at y = 1.0: body overlaps, wheels do not
  const pose = { x: 2, y: 1.0 - car.w2 + 0.05, th: 0 };

  it("a wall at the same place collides with the body", () => {
    expect(collides(footprint(car, pose), [obstacle("wall")])).toBe(true);
  });

  it("a curb lets the bodywork overhang and only stops the wheels", () => {
    expect(collides(footprint(car, pose), [obstacle("curb")])).toBe(false);
    const onCurb = { ...pose, y: 1.0 - (car.trackHalf - 0.11) + 0.05 };
    expect(collides(footprint(car, onCurb), [obstacle("curb")])).toBe(true);
  });

  it("clearance names a wheel as the closest part for a curb", () => {
    expect(clearance(car, footprint(car, pose), pose, [obstacle("curb")]).part).toMatch(/left wheel/);
  });
});

describe("clearance", () => {
  const car = defaultCar();
  it("reports the gap to the nearest obstacle and which part is closest", () => {
    const pose = { x: 2, y: 0, th: 0 };
    const gap = 0.3;
    const wall = obstacle("wall", rect(-1, car.mw2 + gap, 10, car.mw2 + gap + 1));
    const c = clearance(car, footprint(car, pose), pose, [wall]);
    expect(c.d).toBeCloseTo(gap, 6);
    expect(c.part).toBe("left mirror");
  });

  it("reports contact when overlapping", () => {
    const pose = { x: 2, y: 0, th: 0 };
    expect(clearance(car, footprint(car, pose), pose, [obstacle("wall", rect(2.5, -0.5, 3.5, 0.5))]).part).toBe("contact");
  });
});
