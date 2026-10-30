import { describe, expect, it } from "vitest";
import { stepPose } from "../src/core/kinematics";

const wb = 2.7;

describe("stepPose", () => {
  it("drives straight when the wheel is centred", () => {
    const p = stepPose({ x: 0, y: 0, th: 0 }, 3, 0, wb);
    expect(p.x).toBeCloseTo(3); expect(p.y).toBeCloseTo(0); expect(p.th).toBe(0);
  });

  it("turns left for positive steering, on a circle of radius wb / tan(delta)", () => {
    const delta = 0.5, R = wb / Math.tan(delta);
    const p = stepPose({ x: 0, y: 0, th: 0 }, (Math.PI / 2) * R, delta, wb);
    expect(p.x).toBeCloseTo(R); expect(p.y).toBeCloseTo(R); expect(p.th).toBeCloseTo(Math.PI / 2);
  });

  it("is exact: many small steps equal one big step", () => {
    let p = { x: 1, y: 2, th: 0.3 };
    for (let i = 0; i < 100; i++) p = stepPose(p, 0.05, -0.4, wb);
    const q = stepPose({ x: 1, y: 2, th: 0.3 }, 5, -0.4, wb);
    expect(p.x).toBeCloseTo(q.x, 9); expect(p.y).toBeCloseTo(q.y, 9); expect(p.th).toBeCloseTo(q.th, 9);
  });

  it("reversing the same distance returns to the start", () => {
    const a = { x: 0, y: 0, th: 1 };
    const b = stepPose(stepPose(a, 2.5, 0.3, wb), -2.5, 0.3, wb);
    expect(b.x).toBeCloseTo(a.x, 9); expect(b.y).toBeCloseTo(a.y, 9); expect(b.th).toBeCloseTo(a.th, 9);
  });
});
