import { describe, expect, it } from "vitest";
import { driveSteps } from "../src/timeline/steps";
import type { Sample } from "../src/trajectory";

const dmax = 0.6;
const smp = (s: number, delta: number, dir: number): Sample => ({ s, t: s, x: s, y: 0, th: 0, delta, dir, cx: s, cy: 0, clr: 2, part: "" });

describe("driveSteps", () => {
  it("splits a drive at direction changes and stops with steering", () => {
    const a: Sample[] = [smp(0, 0, 0)];
    for (let i = 1; i <= 10; i++) a.push(smp(i * 0.2, 0, 1));          // forward 2 m straight
    a.push(smp(2, dmax, 0));                                           // stop, full lock left
    for (let i = 1; i <= 5; i++) a.push(smp(2 + i * 0.2, dmax, -1));   // reverse 1 m
    const steps = driveSteps(a, dmax);
    expect(steps.map(s => s.kind)).toEqual(["move", "stop", "move"]);
    expect(steps[0].text).toContain("Forward 2.00 m");
    expect(steps[0].text).toContain("straight");
    expect(steps[1].text).toContain("full lock left");
    expect(steps[2].text).toContain("Reverse 1.00 m");
  });

  it("returns nothing for an empty recording", () => {
    expect(driveSteps([smp(0, 0, 0)], dmax)).toEqual([]);
  });
});
