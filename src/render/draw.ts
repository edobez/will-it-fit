// Everything drawn in the top view and the driver view.
import type { Pt } from "../core/geometry";
import { toWorld, type Pose } from "../core/kinematics";
import { hasMirrors } from "../core/vehicle";
import { P } from "../params";
import { PLAN, planValid } from "../planner/client";
import type { Projection } from "../sim/projection";
import { R_CELL, RE, foundPath, heatBuckets, heatColor } from "../sim/reach";
import { centerOf, fp, st, world } from "../sim/world";
import { REC, trk, type SampleAt } from "../timeline/state";
import { H, P2, V, W, ctx, drawRuns, label, pathLine, pathPoly, resetTransform, screenToWorld, setWorldTransform, type View } from "./view";

const BAD = "#cf3f3f";

function drawGrid(): void {
  const cs = ([[0, 0], [W, 0], [0, H], [W, H]] as Pt[]).map(([a, b]) => screenToWorld(V, a, b));
  const x0 = Math.min(...cs.map(p => p.x)), x1 = Math.max(...cs.map(p => p.x));
  const y0 = Math.min(...cs.map(p => p.y)), y1 = Math.max(...cs.map(p => p.y));
  const step = V.scale > 60 ? 0.5 : 1;
  ctx.lineWidth = 1;
  const line = (ax: number, ay: number, bx: number, by: number, major: boolean) => {
    ctx.strokeStyle = major ? "rgba(0,0,0,.12)" : "rgba(0,0,0,.05)";
    ctx.beginPath(); ctx.moveTo(...P2(ax, ay)); ctx.lineTo(...P2(bx, by)); ctx.stroke();
  };
  for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) line(x, y0, x, y1, Math.abs(x % 5) < 1e-6);
  for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) line(x0, y, x1, y, Math.abs(y % 5) < 1e-6);
}

export function drawScene(): void {
  const S = world.scene;
  ctx.fillStyle = "#3a3e45"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ebe8e2";
  S.floor.forEach(r => { pathPoly(r); ctx.fill(); });
  ctx.save(); ctx.beginPath();
  S.floor.forEach(r => { r.forEach(([x, y], i) => i ? ctx.lineTo(...P2(x, y)) : ctx.moveTo(...P2(x, y))); ctx.closePath(); });
  ctx.clip(); drawGrid(); ctx.restore();
  // target
  ctx.fillStyle = "rgba(47,111,179,.10)"; pathPoly(S.target.poly); ctx.fill();
  // paint lines
  ctx.strokeStyle = "#d1a92e"; ctx.lineWidth = Math.max(1.5, 0.1 * V.scale);
  S.lines.forEach(l => { pathLine(l); ctx.stroke(); });
  if (S.target.doorLine) {
    ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = "#2f6fb3"; ctx.lineWidth = 1.5;
    pathLine(S.target.doorLine); ctx.stroke(); ctx.restore();
  }
  // obstacles
  for (const o of S.obstacles) {
    if (o.kind === "wall") { ctx.fillStyle = "#3a3e45"; pathPoly(o.poly); ctx.fill(); }
    else if (o.kind === "curb") { ctx.fillStyle = "#a9aeb5"; pathPoly(o.poly); ctx.fill(); }
    else if (o.kind === "pillar") { ctx.fillStyle = "#2a2d33"; pathPoly(o.poly); ctx.fill(); }
    else if (o.kind === "car" && o.pose && o.len && o.wid) {
      ctx.fillStyle = "#9aa1ab"; ctx.strokeStyle = "#646a73"; ctx.lineWidth = 1;
      pathPoly(o.poly); ctx.fill(); ctx.stroke();
      const p = o.pose, l = o.len / 2, w = o.wid / 2;
      const ws = ([[l - 1.3, -w + 0.12], [l - 0.9, -w + 0.18], [l - 0.9, w - 0.18], [l - 1.3, w - 0.12]] as Pt[]).map(([x, y]) => toWorld(p, x, y));
      ctx.fillStyle = "rgba(255,255,255,.45)"; pathPoly(ws); ctx.fill();
    }
  }
  S.labels.forEach(l => label(l.text, l.x, l.y, { color: l.color, align: l.align }));
}

export function drawHeat(): void {
  if (P.reachMode === "off" || RE.cells.size === 0) return;
  const b = heatBuckets();
  setWorldTransform();
  const h = R_CELL / 2;
  for (let i = 0; i < b.length; i++) {
    const arr = b[i]; if (!arr.length) continue;
    ctx.fillStyle = heatColor(i);
    ctx.beginPath();
    for (let j = 0; j < arr.length; j += 2) ctx.rect(arr[j] - h, arr[j + 1] - h, R_CELL, R_CELL);
    ctx.fill();
  }
  resetTransform();
}

export function drawFoundPath(): void {
  if (!RE.found || P.reachMode === "off") return;
  ctx.save();
  ctx.strokeStyle = "#8e44ad"; ctx.lineWidth = 2.5; ctx.setLineDash([7, 4]);
  pathLine(foundPath()); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(142,68,173,.8)"; ctx.lineWidth = 1.5;
  fp(RE.found).parts.forEach(pp => { pathPoly(pp); ctx.stroke(); });
  ctx.restore();
}

export function drawPlan(): void {
  if (!PLAN.samples) return;
  const valid = planValid(), a = PLAN.samples;
  ctx.save();
  ctx.strokeStyle = valid ? "#d6336c" : "rgba(214,51,108,.35)"; ctx.lineWidth = 2.5;
  if (!valid) ctx.setLineDash([6, 5]);
  ctx.beginPath(); a.forEach((p, i) => i ? ctx.lineTo(...P2(p.cx, p.cy)) : ctx.moveTo(...P2(p.cx, p.cy))); ctx.stroke();
  ctx.setLineDash([]);
  if (valid) {
    ctx.strokeStyle = "rgba(214,51,108,.6)"; ctx.lineWidth = 1.2;
    PLAN.ends.forEach((p, k) => {
      pathPoly(fp(p).parts[0]); ctx.stroke();
      const c = centerOf(p);
      label(String(k + 1), c[0], c[1], { bg: "rgba(214,51,108,.9)", color: "#fff", bold: true });
    });
  }
  ctx.restore();
}

export function drawProjection(pr: Projection, color: string): void {
  ctx.save();
  if (P.showCorners) {
    ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2;
    pr.corners.forEach((c, j) => drawRuns(c, pr.kflag[j], color, BAD));
  }
  if (P.showMirrorPaths && hasMirrors(world.car)) {
    ctx.globalAlpha = 0.75; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    pr.mirrors.forEach((c, j) => drawRuns(c, pr.mflag[j], color, BAD));
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1; ctx.lineWidth = 2.5;
  drawRuns(pr.center, pr.cflag, color, BAD);
  if (pr.hit) {
    ctx.fillStyle = "rgba(207,63,63,.12)"; ctx.strokeStyle = BAD; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    fp(pr.hit).parts.forEach(pp => { pathPoly(pp); ctx.fill(); ctx.stroke(); });
    ctx.setLineDash([]);
    const hc = centerOf(pr.hit);
    ctx.fillStyle = BAD; ctx.beginPath(); ctx.arc(...P2(hc[0], hc[1]), 4, 0, Math.PI * 2); ctx.fill();
  }
  if (pr.endPose && (!pr.hit || P.projMode === "pass")) {
    ctx.strokeStyle = pr.cflag[pr.cflag.length - 1] ? BAD : color; ctx.globalAlpha = 0.4; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    pathPoly(fp(pr.endPose).parts[0]); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

/** Four wheels, the front ones steered with Ackermann geometry (visual only). */
function drawWheels(p: Pose, delta: number, color: string): void {
  const g = world.car, wl = 0.68, ww = 0.22, th = g.trackHalf;
  let dl = 0, dr = 0;
  if (Math.abs(delta) > 1e-6) { const R = g.wb / Math.tan(delta); dl = Math.atan(g.wb / (R - th)); dr = Math.atan(g.wb / (R + th)); }
  for (const [cx, cy, ang] of [[0, th - ww / 2, 0], [0, -th + ww / 2, 0], [g.wb, th - ww / 2, dl], [g.wb, -th + ww / 2, dr]]) {
    const c = Math.cos(ang), s = Math.sin(ang);
    pathPoly(([[-wl / 2, -ww / 2], [wl / 2, -ww / 2], [wl / 2, ww / 2], [-wl / 2, ww / 2]] as Pt[]).map(([x, y]) => toWorld(p, cx + c * x - s * y, cy + s * x + c * y)));
    ctx.fillStyle = color; ctx.fill();
  }
}

export function drawCar(colliding: boolean): void {
  const g = world.car, p = st.pose, parts = fp(p).parts, blocked = st.blockedT > 0;
  ctx.fillStyle = colliding ? "rgba(207,63,63,.85)" : "rgba(47,111,179,.9)";
  ctx.strokeStyle = colliding || blocked ? BAD : "#1d3f66"; ctx.lineWidth = colliding || blocked ? 3 : 1.5;
  pathPoly(parts[0]); ctx.fill(); ctx.stroke();
  for (let i = 1; i < parts.length; i++) { ctx.fillStyle = "#1d3f66"; pathPoly(parts[i]); ctx.fill(); }
  const ws = ([[g.wb - 0.35, -g.w2 + 0.12], [g.wb + 0.05, -g.w2 + 0.18], [g.wb + 0.05, g.w2 - 0.18], [g.wb - 0.35, g.w2 - 0.12]] as Pt[]).map(([x, y]) => toWorld(p, x, y));
  ctx.fillStyle = "rgba(255,255,255,.55)"; pathPoly(ws); ctx.fill();
  drawWheels(p, st.delta, "#15181d");
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(...P2(p.x, p.y), 2.5, 0, Math.PI * 2); ctx.fill();
}

export function drawTrail(ghost: SampleAt | null): void {
  const a = REC.samples;
  if (a.length < 2 && !ghost) return;
  ctx.save(); ctx.lineWidth = 1.5; ctx.setLineDash([2, 3]);
  ctx.strokeStyle = "rgba(60,60,60,.45)";
  ctx.beginPath(); a.forEach((p, i) => i ? ctx.lineTo(...P2(p.cx, p.cy)) : ctx.moveTo(...P2(p.cx, p.cy))); ctx.stroke();
  if (ghost) {
    const b = trk();
    ctx.setLineDash([]); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(142,68,173,.55)";
    ctx.beginPath();
    for (let i = 0; i <= ghost.idx; i++) { const p = b[i]; i ? ctx.lineTo(...P2(p.cx, p.cy)) : ctx.moveTo(...P2(p.cx, p.cy)); }
    ctx.lineTo(...P2(ghost.cx, ghost.cy)); ctx.stroke();
  }
  ctx.restore();
}

export function drawGhost(g: SampleAt): void {
  ctx.save();
  ctx.fillStyle = "rgba(142,68,173,.22)"; ctx.strokeStyle = "#8e44ad"; ctx.lineWidth = 2;
  fp(g).parts.forEach(pp => { pathPoly(pp); ctx.fill(); ctx.stroke(); });
  drawWheels(g, g.delta, "#5b2c6f");
  ctx.restore();
}

export function drawClearanceLine(p: Pt, q: Pt, d: number): void {
  ctx.strokeStyle = d < 0.05 ? BAD : "#c7781a"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(...P2(p[0], p[1])); ctx.lineTo(...P2(q[0], q[1])); ctx.stroke();
  label(`${(d * 100).toFixed(0)} cm`, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, { bg: "rgba(255,255,255,.9)", bold: true, color: "#1d2128", dy: -12 });
}

/** Compass in the driver view pointing into the target space. */
export function drawCompass(v: View): void {
  const cx = W - 34, cy = 64, r = 18;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.fill();
  const ang = world.scene.targetDir + v.rot; // world direction on screen
  const ux = Math.cos(ang), uy = -Math.sin(ang);
  ctx.strokeStyle = "#2f6fb3"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(cx - ux * r * 0.6, cy - uy * r * 0.6); ctx.lineTo(cx + ux * r * 0.6, cy + uy * r * 0.6); ctx.stroke();
  ctx.fillStyle = "#2f6fb3"; ctx.beginPath(); ctx.arc(cx + ux * r * 0.6, cy + uy * r * 0.6, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.font = "600 9px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("T", cx + ux * (r + 1), cy + uy * (r + 1));
  ctx.restore();
}
