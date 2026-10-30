// Hybrid A* manoeuvre planner.
//
// State (x, y, heading, direction) on a lattice; motion primitives are arcs at a few steering
// levels, forward and reverse. Costs: distance (reverse weighted), direction changes, stopping to
// steer, small steering changes while moving, and a soft penalty for being closer than a
// comfortable clearance. A 2D distance-to-goal grid around the obstacles is the heuristic. The goal
// is a region: the whole car inside the space, optionally with an orientation constraint.
//
// Pure function: runs in the worker and in tests.

import { collides as collidesFp, footprint } from "../core/collision";
import { pointInPoly, segDist, type Pt } from "../core/geometry";
import { stepPose, toWorld, type Pose } from "../core/kinematics";
import { hasMirrors, partsLocal } from "../core/vehicle";
import { Heap } from "./heap";
import type { PlanMessage, PlanRequest, Prim } from "./types";

const HEUR_CELL = 0.1;
const HW = 1.4; // weighted A*: much faster, slightly suboptimal

export function plan(req: PlanRequest, post: (m: PlanMessage) => void, now: () => number = Date.now): void {
  const t0 = now();
  const { car, target, bounds, start, startDelta, opts } = req;
  const OBS = req.obstacles;
  const wb = car.wb, dmax = car.dmax, m = opts.margin;
  const PR = partsLocal(car, 0);
  const collides = (p: Pose) => collidesFp(footprint(car, p, m), OBS);
  const cosLim = 0.5;
  function isGoal(p: Pose): boolean {
    if (opts.orient !== "any") {
      const c = Math.cos(p.th - target.noseDir);
      if (opts.orient === "fwd" && c < cosLim) return false;
      if (opts.orient === "rev" && c > -cosLim) return false;
    }
    for (const lp of PR) for (const v of lp) if (!pointInPoly(toWorld(p, v[0], v[1]), target.poly)) return false;
    return true;
  }

  // ---- distance fields and 2D heuristic on a 0.1 m grid ----
  const g = HEUR_CELL, bx0 = bounds[0], by0 = bounds[1];
  const nx = Math.ceil((bounds[2] - bx0) / g), ny = Math.ceil((bounds[3] - by0) / g);
  // df: distance to tall obstacles (body and mirrors), dlo: distance to low ones (wheels only)
  const df = new Float32Array(nx * ny), dlo = new Float32Array(nx * ny);
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const px = bx0 + (ix + 0.5) * g, py = by0 + (iy + 0.5) * g;
    for (const low of [false, true]) {
      let best = Infinity;
      for (const o of OBS) {
        if (o.low !== low) continue;
        const b = o.bb, ddx = Math.max(b[0] - px, 0, px - b[2]), ddy = Math.max(b[1] - py, 0, py - b[3]);
        if (Math.hypot(ddx, ddy) >= best) continue;
        if (ddx === 0 && ddy === 0 && pointInPoly([px, py], o.poly)) { best = 0; break; }
        for (let i = 0; i < o.poly.length; i++) best = Math.min(best, segDist(px, py, o.poly[i], o.poly[(i + 1) % o.poly.length]));
      }
      (low ? dlo : df)[iy * nx + ix] = best;
    }
  }
  const dfAt = (x: number, y: number) => {
    const ix = Math.floor((x - bx0) / g), iy = Math.floor((y - by0) / g);
    return ix < 0 || iy < 0 || ix >= nx || iy >= ny ? 0 : df[iy * nx + ix];
  };
  const wheelHalf = car.trackHalf - 0.11 + 0.13;
  const passMin = car.w2 + m - 0.07; // the car's centre can never be closer than half its width to an obstacle
  const passLow = wheelHalf + m - 0.07;
  const passable = (k: number) => df[k] >= passMin && dlo[k] >= passLow;
  const hg = new Float64Array(nx * ny).fill(Infinity);
  const hh = new Heap();
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const k = iy * nx + ix;
    if (passable(k) && pointInPoly([bx0 + (ix + 0.5) * g, by0 + (iy + 0.5) * g], target.poly)) { hg[k] = 0; hh.push(0, k); }
  }
  const NB: [number, number, number][] = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (hh.size) {
    const k = hh.pop(), ix = k % nx, iy = (k - ix) / nx, d0 = hg[k];
    if (hh.topF > d0 + 1e-12) continue; // stale entry
    for (const [ddx, ddy, w] of NB) {
      const jx = ix + ddx, jy = iy + ddy;
      if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue;
      const j = jy * nx + jx;
      if (!passable(j)) continue;
      const nd = d0 + w * g;
      if (nd < hg[j]) { hg[j] = nd; hh.push(nd, j); }
    }
  }
  const ccx = (car.xf - car.ro) / 2;
  const hAt = (p: Pose) => {
    const c = toWorld(p, ccx, 0), ix = Math.floor((c[0] - bx0) / g), iy = Math.floor((c[1] - by0) / g);
    return ix < 0 || iy < 0 || ix >= nx || iy >= ny ? Infinity : hg[iy * nx + ix];
  };
  // points used for the soft clearance cost
  const CP: Pt[] = [[-car.ro, -car.w2], [car.xf, -car.w2], [car.xf, car.w2], [-car.ro, car.w2], [car.wb / 2, car.w2], [car.wb / 2, -car.w2]];
  if (hasMirrors(car)) CP.push([car.mx, car.mw2], [car.mx, -car.mw2]);
  const clrCost = (p: Pose) => {
    if (opts.clrWeight <= 0) return 0;
    let c = 0;
    for (const v of CP) { const w = toWorld(p, v[0], v[1]); const d = dfAt(w[0], w[1]); if (d < opts.softClr) c += (opts.softClr - d) / opts.softClr; }
    return opts.clrWeight * c / CP.length;
  };

  // ---- search ----
  const fine = opts.res === "fine";
  const CELL = fine ? 0.1 : 0.15, NTH = fine ? 180 : 120, STEP = fine ? 0.3 : 0.5, SUB = fine ? 3 : 4;
  const LV = (fine ? [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1] : [-1, -0.5, 0, 0.5, 1]).map(f => f * dmax);
  const keyOf = (p: Pose, dir: number) => {
    const ix = Math.round(p.x / CELL) + 5000, iy = Math.round(p.y / CELL) + 5000;
    const it = ((Math.round(p.th / (2 * Math.PI / NTH)) % NTH) + NTH) % NTH;
    return ((ix * 10000 + iy) * NTH + it) * 3 + (dir > 0 ? 1 : dir < 0 ? 2 : 0);
  };
  // node storage as parallel arrays
  const X: number[] = [], Y: number[] = [], TH: number[] = [], G: number[] = [], PAR: number[] = [];
  const DIR: number[] = [], LVI: number[] = [], LEN: number[] = [], GOAL: boolean[] = [];
  const add = (p: Pose, gg: number, par: number, dir: number, lvi: number, len: number, goal: boolean) => {
    X.push(p.x); Y.push(p.y); TH.push(p.th); G.push(gg); PAR.push(par); DIR.push(dir); LVI.push(lvi); LEN.push(len); GOAL.push(goal);
    return X.length - 1;
  };
  const done = (i: number, expanded: number) => {
    const prims: Prim[] = [];
    for (let k = i; PAR[k] >= 0; k = PAR[k]) prims.push({ dir: DIR[k] as 1 | -1, lv: LVI[k], delta: LV[LVI[k]], len: LEN[k] });
    prims.reverse();
    post({ type: "done", prims, expanded, ms: now() - t0, cost: G[i], levels: LV.length });
  };

  if (collides(start)) {
    post({ type: "fail", reason: "The car is already closer to an obstacle than the safety margin. Move it a little or lower the margin." });
    return;
  }
  if (isGoal(start)) { post({ type: "done", prims: [], expanded: 0, ms: now() - t0, cost: 0, levels: LV.length }); return; }
  let lv0 = 0;
  LV.forEach((v, i) => { if (Math.abs(v - startDelta) < Math.abs(LV[lv0] - startDelta)) lv0 = i; });
  const best = new Map<number, number>();
  const heap = new Heap();
  const h0 = hAt(start);
  if (!Number.isFinite(h0)) {
    post({ type: "fail", reason: "The space is not reachable even ignoring the turning radius: something blocks every route, or the space is narrower than the car plus margin." });
    return;
  }
  const root = add(start, 0, -1, 0, lv0, 0, false);
  best.set(keyOf(start, 0), 0);
  heap.push(HW * h0, root);
  let expanded = 0, lastPost = now();
  const maxMs = opts.maxTime * 1000;
  while (heap.size) {
    const i = heap.pop();
    if (GOAL[i]) { done(i, expanded); return; }
    const pose: Pose = { x: X[i], y: Y[i], th: TH[i] };
    if (G[i] > (best.get(keyOf(pose, DIR[i])) ?? Infinity) + 1e-9) continue;
    expanded++;
    if ((expanded & 255) === 0) {
      const t = now();
      if (t - t0 > maxMs) {
        post({ type: "fail", expanded, reason: `No solution within the ${opts.maxTime} s time limit (${expanded} states explored). Try a smaller margin, the fine resolution, a longer limit, or another start position.` });
        return;
      }
      if (t - lastPost > 150) { lastPost = t; post({ type: "progress", expanded, ms: t - t0, h: hAt(pose) }); }
    }
    const pd = DIR[i], pl = LVI[i];
    for (const dir of [1, -1] as const) for (let li = 0; li < LV.length; li++) {
      const dl = Math.abs(li - pl);
      let cost: number;
      if (pd === 0) cost = 0.05 * dl;                                              // at the start we are standing still
      else if (pd !== dir) cost = opts.dirPenalty + 0.05 * dl;                     // direction change: stop, any steering
      else if (dl <= 1) cost = opts.steerCost * Math.abs(LV[li] - LV[pl]) / dmax;  // small steering change while moving
      else cost = opts.stopPenalty + 0.05 * dl;                                    // stop to turn the wheel a lot
      const delta = LV[li], fac = dir < 0 ? opts.revFactor : 1;
      const end = stepPose(pose, dir * STEP, delta, wb);
      const gEnd = G[i] + cost + STEP * fac;
      const k = keyOf(end, dir);
      const bk = best.get(k);
      if (bk !== undefined && bk <= gEnd) continue;
      let ok = true, goalHit = 0, gp: Pose | null = null;
      for (let s = 1; s <= SUB; s++) {
        const p = s === SUB ? end : stepPose(pose, dir * STEP * s / SUB, delta, wb);
        if (collides(p)) { ok = false; break; }
        if (isGoal(p)) { goalHit = s; gp = p; break; }
      }
      if (goalHit && gp) {
        const len = STEP * goalHit / SUB;
        const gg = G[i] + cost + len * fac;
        heap.push(gg, add(gp, gg, i, dir, li, len, true));
        continue;
      }
      if (!ok) continue;
      const h = hAt(end);
      if (!Number.isFinite(h)) continue;
      const gg = gEnd + STEP * clrCost(end);
      if (bk !== undefined && bk <= gg) continue;
      best.set(k, gg);
      heap.push(gg + HW * h, add(end, gg, i, dir, li, STEP, false));
    }
  }
  post({ type: "fail", expanded, reason: `No manoeuvre exists on this search lattice (${expanded} states explored). Try a smaller margin or the fine resolution.` });
}
