// Reachability heatmap: every position the car centre can reach in one move without changing
// direction, with any steering along the way. Breadth-first search on a hybrid lattice, time sliced
// so it runs across animation frames.
import { pointInPoly, type Pt } from "../core/geometry";
import { stepPose, type Pose } from "../core/kinematics";
import { P } from "../params";
import { centerOf, collidesAt, fp, st, world } from "./world";

interface ReachNode extends Pose { d: number; parent: ReachNode | null }

export const R_CELL = 0.15;
const R_TH = 120, R_STEP = 0.5, R_SUB = 4;
export const HEAT_BUCKETS = 10;

export const RE = {
  key: "", q: [] as ReachNode[], head: 0, visited: new Set<number>(), cells: new Map<number, number>(),
  found: null as ReachNode | null, done: false, buckets: null as number[][] | null, dirty: false,
};

export function reachKey(): string {
  if (P.reachMode === "off") return "off";
  const p = st.pose;
  return [P.reachMode, p.x.toFixed(3), p.y.toFixed(3), p.th.toFixed(4), world.sceneVersion, world.carVersion, P.reachHorizon].join("|");
}

function stateKey(p: Pose): number {
  const ix = Math.round(p.x / R_CELL) + 1000, iy = Math.round(p.y / R_CELL) + 1000;
  const it = ((Math.round(p.th / (2 * Math.PI / R_TH)) % R_TH) + R_TH) % R_TH;
  return (ix * 2000 + iy) * R_TH + it;
}

export function reachRestart(key: string): void {
  RE.key = key; RE.q = []; RE.head = 0; RE.visited = new Set(); RE.cells = new Map(); RE.found = null; RE.done = key === "off"; RE.dirty = true;
  if (key === "off") return;
  if (collidesAt(st.pose)) { RE.done = true; return; }
  const n: ReachNode = { x: st.pose.x, y: st.pose.y, th: st.pose.th, d: 0, parent: null };
  RE.q.push(n); RE.visited.add(stateKey(n));
  recordCell(n);
}

/** Pause the search while the car moves; it restarts when the car stops. */
export function reachInvalidate(): void {
  RE.cells = new Map(); RE.found = null; RE.dirty = true; RE.done = true; RE.key = "";
}

function recordCell(n: ReachNode): void {
  const c = centerOf(n);
  const k = Math.round(c[0] / R_CELL) * 100000 + Math.round(c[1] / R_CELL);
  const prev = RE.cells.get(k);
  if (prev === undefined || n.d < prev) { RE.cells.set(k, n.d); RE.dirty = true; }
  const tp = world.scene.target.poly;
  if (!RE.found && pointInPoly(c, tp)) {
    if (fp(n).parts.every(pp => pp.every(v => pointInPoly(v, tp)))) RE.found = n;
  }
}

export function reachStep(budgetMs: number): void {
  if (RE.done) return;
  const t0 = performance.now();
  const dir = P.reachMode === "rev" ? -1 : 1;
  const g = world.car;
  const steers = [-1, -0.5, 0, 0.5, 1].map(f => f * g.dmax);
  const H = Math.max(1, P.reachHorizon);
  while (RE.head < RE.q.length) {
    const n = RE.q[RE.head++];
    if (n.d + R_STEP <= H) {
      for (const s of steers) {
        const end = stepPose(n, dir * R_STEP, s, g.wb);
        const k = stateKey(end);
        if (RE.visited.has(k)) continue;
        RE.visited.add(k);
        // check the arc at sub-steps, keep the intermediate poses for the heatmap
        const sub: Pose[] = [];
        let ok = true;
        for (let i = 1; i <= R_SUB; i++) {
          const p = stepPose(n, dir * R_STEP * i / R_SUB, s, g.wb);
          if (collidesAt(p)) { ok = false; break; }
          sub.push(p);
        }
        if (!ok) continue;
        const m: ReachNode = { x: end.x, y: end.y, th: end.th, d: n.d + R_STEP, parent: n };
        for (let i = 0; i < sub.length - 1; i++) recordCell({ ...sub[i], d: n.d + R_STEP * (i + 1) / R_SUB, parent: n });
        RE.q.push(m);
        recordCell(m);
      }
    }
    if ((RE.head & 31) === 0 && performance.now() - t0 > budgetMs) return;
  }
  RE.done = true;
}

/** Cell centres grouped by distance bucket, as flat [x0, y0, x1, y1, ...] arrays. */
export function heatBuckets(): number[][] {
  if (!RE.dirty && RE.buckets) return RE.buckets;
  const H = Math.max(1, P.reachHorizon);
  const b: number[][] = Array.from({ length: HEAT_BUCKETS }, () => []);
  for (const [k, d] of RE.cells) {
    const ix = Math.round(k / 100000), iy = k - ix * 100000;
    b[Math.min(HEAT_BUCKETS - 1, Math.floor(d / H * HEAT_BUCKETS))].push(ix * R_CELL, iy * R_CELL);
  }
  RE.buckets = b; RE.dirty = false;
  return b;
}

export function heatColor(i: number): string {
  const t = i / (HEAT_BUCKETS - 1);
  const c0 = [11, 122, 117], c1 = [127, 183, 230];
  const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * t));
  return `rgba(${c[0]},${c[1]},${c[2]},${0.55 - 0.25 * t})`;
}

export function foundPath(): Pt[] {
  const pts: Pt[] = [];
  for (let n = RE.found; n; n = n.parent) pts.push(centerOf(n));
  return pts.reverse();
}
