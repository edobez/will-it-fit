// Scene builders. Coordinates in metres; the driving aisle runs along +x with y = 0 at its far edge.
import { bbox, orect, rect, type Pt } from "../core/geometry";
import { DEG, clamp } from "../core/math";
import type { CarGeom } from "../core/vehicle";
import type { RawObstacle, RawScene, ScenarioParams, Scene } from "./types";

const BLUE = "#2f6fb3", GREY = "#6b7280";
const n = (sp: ScenarioParams, k: string): number => Number(sp[k]);

function parkedCar(cx: number, cy: number, th: number, sp: ScenarioParams): RawObstacle {
  const len = n(sp, "parkedLength"), wid = n(sp, "parkedWidth");
  return { kind: "car", poly: orect(cx, cy, th, len, wid), pose: { x: cx, y: cy, th }, len, wid };
}

export function buildGarage(sp: ScenarioParams, car: CarGeom): RawScene {
  const L = Math.max(10, n(sp, "tunnelLength")), Wt = Math.max(1, n(sp, "tunnelWidth")), t = Math.max(0, n(sp, "wallThickness"));
  const gw = Math.max(0.5, n(sp, "garageWidth")), gd = Math.max(0.5, n(sp, "garageDepth"));
  const gx = clamp(n(sp, "garageX"), 0.5, L - gw - 0.5);
  const dw = Math.min(Math.max(0.3, n(sp, "doorWidth")), gw);
  const doff = clamp(n(sp, "doorOffset"), 0, gw - dw);
  const dx0 = gx + doff, dx1 = dx0 + dw, T = 1.5;
  const gy0 = Wt + t, gy1 = Wt + t + gd;
  const wall = (poly: Pt[]): RawObstacle => ({ kind: "wall", poly });
  return {
    floor: [rect(0, 0, L, Wt), rect(dx0, Wt - 0.001, dx1, gy0 + 0.001), rect(gx, gy0, gx + gw, gy1)],
    obstacles: [
      wall(rect(-T, -T, L + T, 0)), wall(rect(-T, 0, 0, Wt)), wall(rect(L, 0, L + T, Wt)),
      wall(rect(-T, Wt, dx0, gy0)), wall(rect(dx1, Wt, L + T, gy0)),
      wall(rect(gx - T, gy0, gx, gy1 + T)), wall(rect(gx + gw, gy0, gx + gw + T, gy1 + T)), wall(rect(gx, gy1, gx + gw, gy1 + T)),
    ],
    lines: [],
    target: { kind: "garage", poly: rect(gx, gy0, gx + gw, gy1), rect: { x0: gx, y0: gy0, x1: gx + gw, y1: gy1 }, doorLine: [[dx0, gy0], [dx1, gy0]] },
    labels: [
      { text: `garage ${gw.toFixed(2)} × ${gd.toFixed(2)} m`, x: gx + gw / 2, y: gy1 - 0.35, color: BLUE },
      { text: `door ${dw.toFixed(2)} m`, x: (dx0 + dx1) / 2, y: gy0 + 0.3, color: BLUE },
      { text: `tunnel ${Wt.toFixed(2)} m`, x: 1.0, y: Wt / 2, align: "left", color: GREY },
    ],
    bounds: [-1, -1, L + 1, gy1 + 1],
    start: { x: 2 + car.ro, y: Wt * 0.5, th: 0 },
    targetDir: Math.PI / 2, noseDir: Math.PI / 2,
  };
}

export function buildParallelStreet(sp: ScenarioParams, car: CarGeom): RawScene {
  const Wa = Math.max(2, n(sp, "roadWidth")), dep = Math.max(1.5, n(sp, "slotDepth")), S = Math.max(2, n(sp, "slotLength"));
  const cl = n(sp, "parkedLength"), cw = n(sp, "parkedWidth"), L = 40, xs = 18, T = 1.5;
  const yTop = Wa + dep, cy = Math.max(Wa + cw / 2, yTop - Math.max(0, n(sp, "curbGap")) - cw / 2);
  const obstacles: RawObstacle[] = [
    { kind: "curb", poly: rect(-T, yTop, L + T, yTop + T) },
    { kind: "curb", poly: rect(-T, -T, L + T, 0) },
    { kind: "wall", poly: rect(-T, 0, 0, yTop) }, { kind: "wall", poly: rect(L, 0, L + T, yTop) },
  ];
  const gap2 = 1.0;
  for (const x of [xs - cl / 2, xs - cl * 1.5 - gap2, xs + S + cl / 2, xs + S + cl * 1.5 + gap2])
    if (x - cl / 2 > 0 && x + cl / 2 < L) obstacles.push(parkedCar(x, cy, 0, sp));
  return {
    floor: [rect(0, 0, L, yTop)],
    obstacles,
    lines: [[[0, Wa], [L, Wa]]],
    // bodywork may overhang the curb by up to 0.3 m, so the target extends past it
    target: { kind: "rect", poly: rect(xs, Wa, xs + S, yTop + 0.3), rect: { x0: xs, y0: Wa, x1: xs + S, y1: yTop } },
    labels: [
      { text: `gap ${S.toFixed(2)} m`, x: xs + S / 2, y: Wa + dep / 2, color: BLUE },
      { text: `road ${Wa.toFixed(2)} m`, x: 1.0, y: Wa / 2, align: "left", color: GREY },
    ],
    bounds: [-1, -1.5, L + 1, yTop + 1.5],
    start: { x: 2 + car.ro, y: Math.max(car.w2 + 0.3, Wa - 0.8 - car.w2), th: 0 },
    targetDir: Math.PI / 2, noseDir: 0,
  };
}

export function buildParallelUnderground(sp: ScenarioParams, car: CarGeom): RawScene {
  const Wa = Math.max(2, n(sp, "aisleWidth")), dep = Math.max(1.5, n(sp, "slotDepth")), S = Math.max(2, n(sp, "slotLength"));
  const p = Math.max(0, n(sp, "pillarSize")), cl = n(sp, "parkedLength"), cw = n(sp, "parkedWidth");
  const L = 40, xs = 18, T = 1.5, yTop = Wa + dep;
  const obstacles: RawObstacle[] = [
    { kind: "wall", poly: rect(-T, yTop, L + T, yTop + T) }, { kind: "wall", poly: rect(-T, -T, L + T, 0) },
    { kind: "wall", poly: rect(-T, 0, 0, yTop) }, { kind: "wall", poly: rect(L, 0, L + T, yTop) },
  ];
  const lines: [Pt, Pt][] = [[[0, Wa], [L, Wa]]];
  for (let i = -3; i <= 4; i++) {
    const xb = xs + i * S;
    if (xb <= 0 || xb >= L) continue;
    lines.push([[xb, Wa], [xb, yTop]]);
    if (p > 0) obstacles.push({ kind: "pillar", poly: rect(xb - p / 2, yTop - p, xb + p / 2, yTop) });
  }
  if (sp.neighborCars) {
    const cy = yTop - Math.min(0.3, Math.max(0.05, dep - cw)) - cw / 2;
    for (const i of [-2, -1, 1, 2]) {
      const cx = xs + i * S + S / 2;
      if (cx - cl / 2 > 0 && cx + cl / 2 < L) obstacles.push(parkedCar(cx, cy, 0, sp));
    }
  }
  return {
    floor: [rect(0, 0, L, yTop)],
    obstacles, lines,
    target: { kind: "rect", poly: rect(xs, Wa, xs + S, yTop), rect: { x0: xs, y0: Wa, x1: xs + S, y1: yTop } },
    labels: [
      { text: `slot ${S.toFixed(2)} × ${dep.toFixed(2)} m`, x: xs + S / 2, y: Wa + dep / 2, color: BLUE },
      { text: `aisle ${Wa.toFixed(2)} m`, x: 1.0, y: Wa / 2, align: "left", color: GREY },
    ],
    bounds: [-1, -1, L + 1, yTop + 1],
    start: { x: 2 + car.ro, y: Wa * 0.5, th: 0 },
    targetDir: Math.PI / 2, noseDir: 0,
  };
}

/** A row of bays at an angle to the aisle; the target is the middle one. Depth is measured perpendicular to the aisle. */
export function buildBays(sp: ScenarioParams, car: CarGeom): RawScene {
  const a = clamp(n(sp, "angle"), 30, 90) * DEG, sa = Math.sin(a), ca = Math.cos(a);
  const Wa = Math.max(2, n(sp, "aisleWidth")), w = Math.max(1.5, n(sp, "bayWidth")), d = Math.max(2.5, n(sp, "bayDepth"));
  const p = Math.max(0, n(sp, "pillarSize")), inset = Math.max(0, n(sp, "pillarInset"));
  const cl = n(sp, "parkedLength"), cw = n(sp, "parkedWidth"), N = 7, ti = 3, bw = w / sa, x0 = 8, T = 1.5;
  const ls = d / sa; // stall line length
  const L = x0 + N * bw + ls * ca + 8, yb = Wa + d;
  const u: Pt = [ca, sa];
  const obstacles: RawObstacle[] = [
    { kind: "wall", poly: rect(-T, yb, L + T, yb + T) }, { kind: "wall", poly: rect(-T, -T, L + T, 0) },
    { kind: "wall", poly: rect(-T, 0, 0, yb) }, { kind: "wall", poly: rect(L, 0, L + T, yb) },
  ];
  const lines: [Pt, Pt][] = [];
  for (let i = 0; i <= N; i++) {
    const P0: Pt = [x0 + i * bw, Wa];
    lines.push([P0, [P0[0] + ls * u[0], P0[1] + ls * u[1]]]);
  }
  lines.push([[x0, Wa], [x0 + N * bw, Wa]]);
  if (sp.neighborCars) {
    const along = Math.max(cl / 2 * sa, (d - 0.25 - (cw / 2) * ca) / sa - cl / 2);
    for (let i = 0; i < N; i++) {
      if (i === ti) continue;
      const bx = x0 + i * bw + bw / 2;
      obstacles.push(parkedCar(bx + along * u[0], Wa + along * u[1], a, sp));
    }
  }
  if (p > 0) {
    for (const i of [ti, ti + 1]) {
      const P0: Pt = [x0 + i * bw, Wa], s = inset + p / 2;
      obstacles.push({ kind: "pillar", poly: orect(P0[0] + s * u[0], P0[1] + s * u[1], a, p, p) });
    }
  }
  const B0: Pt = [x0 + ti * bw, Wa], B1: Pt = [B0[0] + bw, Wa];
  const tpoly: Pt[] = [B0, B1, [B1[0] + ls * u[0], B1[1] + ls * u[1]], [B0[0] + ls * u[0], B0[1] + ls * u[1]]];
  const mid: Pt = [B0[0] + bw / 2 + ls / 2 * u[0], Wa + ls / 2 * u[1]];
  return {
    floor: [rect(0, 0, L, yb)],
    obstacles, lines,
    target: { kind: "bay", poly: tpoly },
    labels: [
      { text: `bay ${w.toFixed(2)} × ${d.toFixed(2)} m`, x: mid[0], y: mid[1] + 0.3, color: BLUE },
      { text: `${(a / DEG).toFixed(0)}°`, x: mid[0], y: mid[1] - 0.3, color: BLUE },
      { text: `aisle ${Wa.toFixed(2)} m`, x: 1.0, y: Wa / 2, align: "left", color: GREY },
    ],
    bounds: [-1, -1, L + 1, yb + 1],
    start: { x: 2 + car.ro, y: Wa * 0.5, th: 0 },
    targetDir: a, noseDir: a,
  };
}

/** Fill in bounding boxes and the low flag (curbs collide with wheels only). */
export function finalize(raw: RawScene): Scene {
  return { ...raw, obstacles: raw.obstacles.map(o => ({ ...o, bb: bbox(o.poly), low: o.kind === "curb" })) };
}
