import { bbox, bbOverlap, polysIntersect, polyDistance, pointInPoly, type BBox, type Poly, type Pt } from "./geometry";
import { toWorld, type Pose } from "./kinematics";
import { partsLocal, wheelsLocal, type CarGeom } from "./vehicle";

export type ObstacleKind = "wall" | "curb" | "pillar" | "car";

export interface Obstacle {
  kind: ObstacleKind;
  poly: Poly;
  /** Low obstacles (curbs) only collide with the wheels: bumpers and mirrors overhang them. */
  low: boolean;
  bb: BBox;
  pose?: Pose; len?: number; wid?: number; // parked cars, for drawing
}

/** World-space footprint of the car: body and mirrors, plus tyres for low obstacles. */
export interface Footprint { parts: Poly[]; wheels: Poly[] }

export function footprint(g: CarGeom, p: Pose, inflate = 0): Footprint {
  const tf = (poly: Poly): Poly => poly.map(([x, y]) => toWorld(p, x, y));
  return { parts: partsLocal(g, inflate).map(tf), wheels: wheelsLocal(g, inflate).map(tf) };
}

export function collides(fp: Footprint, obstacles: Obstacle[]): boolean {
  const bbs = fp.parts.map(bbox), wbbs = fp.wheels.map(bbox);
  for (const o of obstacles) {
    const set = o.low ? fp.wheels : fp.parts, sb = o.low ? wbbs : bbs;
    for (let i = 0; i < set.length; i++) if (bbOverlap(sb[i], o.bb) && polysIntersect(set[i], o.poly)) return true;
  }
  return false;
}

export function pointInObstacle(pt: Pt, obstacles: Obstacle[]): boolean {
  for (const o of obstacles) {
    if (o.low) continue;
    const b = o.bb;
    if (pt[0] > b[0] && pt[0] < b[2] && pt[1] > b[1] && pt[1] < b[3] && pointInPoly(pt, o.poly)) return true;
  }
  return false;
}

export interface Clearance { d: number; p: Pt | null; q: Pt | null; part: string }

const WHEEL_NAMES = ["rear left wheel", "rear right wheel", "front left wheel", "front right wheel"];

/** Name the part of the car a point belongs to. pi: 0 body, 1/2 mirrors, 10+ wheels. */
export function partLabel(g: CarGeom, pi: number, pt: Pt, pose: Pose): string {
  if (pi >= 10) return WHEEL_NAMES[pi - 10];
  if (pi === 1) return "left mirror";
  if (pi === 2) return "right mirror";
  const c = Math.cos(pose.th), s = Math.sin(pose.th), dx = pt[0] - pose.x, dy = pt[1] - pose.y;
  const lx = c * dx + s * dy, ly = -s * dx + c * dy;
  const fr = lx > g.xf - 0.35 ? "front" : lx < -g.ro + 0.35 ? "rear" : "";
  const sd = ly > g.w2 - 0.08 ? "left" : ly < -g.w2 + 0.08 ? "right" : "";
  if (fr && sd) return `${fr} ${sd} corner`;
  if (fr) return fr + " bumper";
  if (sd) return sd + " side";
  return "body";
}

/** Smallest gap between the car and any obstacle, with the closest points and the part involved. */
export function clearance(g: CarGeom, fp: Footprint, pose: Pose, obstacles: Obstacle[]): Clearance {
  let best = { d: Infinity, p: null as Pt | null, q: null as Pt | null, pi: -1 };
  for (const o of obstacles) {
    const set = o.low ? fp.wheels : fp.parts, off = o.low ? 10 : 0;
    for (let k = 0; k < set.length; k++) {
      if (polysIntersect(set[k], o.poly)) return { d: 0, p: null, q: null, part: "contact" };
      const r = polyDistance(set[k], o.poly);
      if (r.d < best.d) best = { ...r, pi: k + off };
    }
  }
  return { d: best.d, p: best.p, q: best.q, part: best.pi >= 0 && best.p ? partLabel(g, best.pi, best.p, pose) : "" };
}
