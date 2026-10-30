import { describe, expect, it } from "vitest";
import { bbox, orect, pointInPoly, polyDistance, polysIntersect, rect } from "../src/core/geometry";

describe("polysIntersect", () => {
  it("detects overlap", () => expect(polysIntersect(rect(0, 0, 2, 2), rect(1, 1, 3, 3))).toBe(true));
  it("treats touching edges as not intersecting", () => expect(polysIntersect(rect(0, 0, 1, 1), rect(1, 0, 2, 1))).toBe(false));
  it("separates disjoint boxes", () => expect(polysIntersect(rect(0, 0, 1, 1), rect(2, 2, 3, 3))).toBe(false));
  it("handles rotated rectangles that only overlap along a diagonal", () => {
    // a 45° square whose corner pokes into the box, while the bounding boxes overlap more widely
    expect(polysIntersect(rect(0, 0, 1, 1), orect(1.6, 0.5, Math.PI / 4, 1, 1))).toBe(true);
    expect(polysIntersect(rect(0, 0, 1, 1), orect(1.8, 0.5, Math.PI / 4, 1, 1))).toBe(false);
  });
});

describe("pointInPoly", () => {
  it("works for convex polygons", () => {
    expect(pointInPoly([0.5, 0.5], rect(0, 0, 1, 1))).toBe(true);
    expect(pointInPoly([1.5, 0.5], rect(0, 0, 1, 1))).toBe(false);
  });
});

describe("polyDistance", () => {
  it("returns the gap and the closest points", () => {
    const r = polyDistance(rect(0, 0, 1, 1), rect(3, 0, 4, 1));
    expect(r.d).toBeCloseTo(2);
    expect(r.p![0]).toBeCloseTo(1);
    expect(r.q![0]).toBeCloseTo(3);
  });
});

describe("orect and bbox", () => {
  it("build an oriented rectangle with the expected extent", () => {
    const b = bbox(orect(0, 0, Math.PI / 2, 4, 2));
    expect(b[0]).toBeCloseTo(-1); expect(b[2]).toBeCloseTo(1);
    expect(b[1]).toBeCloseTo(-2); expect(b[3]).toBeCloseTo(2);
  });
});
