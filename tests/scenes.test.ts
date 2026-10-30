import { describe, expect, it } from "vitest";
import { collides, footprint } from "../src/core/collision";
import { pointInPoly } from "../src/core/geometry";
import { SCENARIOS } from "../src/scenes";
import { defaultCar, defaultScene } from "./helpers";

describe.each(Object.keys(SCENARIOS))("scenario %s", id => {
  const car = defaultCar();
  const S = defaultScene(id, car);

  it("starts the car free of obstacles", () => {
    expect(collides(footprint(car, S.start), S.obstacles)).toBe(false);
  });

  it("starts outside the target space", () => {
    expect(pointInPoly([S.start.x, S.start.y], S.target.poly)).toBe(false);
  });

  it("has a target big enough for the default car", () => {
    // the car with mirrors fits inside the target's bounding box in at least one orientation
    const xs = S.target.poly.map(p => p[0]), ys = S.target.poly.map(p => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const L = car.xf + car.ro, Wm = 2 * car.mw2;
    expect((w >= L && h >= Wm) || (w >= Wm && h >= L)).toBe(true);
  });
});
