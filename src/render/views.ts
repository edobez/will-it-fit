// The two views (top view and driver view) and the per-frame drawing of each.
import type { Clearance } from "../core/collision";
import { P } from "../params";
import type { Projection } from "../sim/projection";
import { centerOf, st, world } from "../sim/world";
import type { SampleAt } from "../timeline/state";
import { $ } from "../ui/format";
import { drawCar, drawClearanceLine, drawCompass, drawFoundPath, drawGhost, drawHeat, drawPlan, drawProjection, drawScene, drawTrail } from "./draw";
import { makeView, resizeView, useView, type View } from "./view";

export let topV: View, egoV: View;

export function initViews(): void {
  topV = makeView($<HTMLCanvasElement>("cv"), false);
  egoV = makeView($<HTMLCanvasElement>("cv2"), true);
  resizeView(topV); resizeView(egoV);
}

export function fitView(): void {
  const v = topV, [x0, y0, x1, y1] = world.scene.bounds;
  v.x = (x0 + x1) / 2; v.y = (y0 + y1) / 2;
  v.scale = Math.min(v.W / (x1 - x0), v.H / (y1 - y0)) * 0.92 || 30;
}
export function fitEgo(): void { egoV.scale = (Math.min(egoV.W, egoV.H) / 11) || 40; }

export function applyViewMode(): void {
  const m = P.viewMode || "both";
  topV.pane.style.display = m === "driver" ? "none" : "";
  egoV.pane.style.display = m === "top" ? "none" : "";
}

export interface FrameData { colliding: boolean; cl: Clearance; fwd: Projection; rev: Projection; ghost: SampleAt | null }

export function drawWorld(v: View, data: FrameData): void {
  const { colliding, cl, fwd, rev, ghost } = data;
  if (v.cv.clientWidth === 0 || v.cv.clientHeight === 0) return;
  if (v.W !== v.cv.clientWidth || v.H !== v.cv.clientHeight) { resizeView(v); if (v.ego) fitEgo(); else fitView(); }
  if (v.ego) {
    const vp = ghost || st.pose;   // the driver view follows the replay ghost when there is one
    const c = centerOf(vp);
    v.x = c[0]; v.y = c[1]; v.rot = Math.PI / 2 - vp.th;
  }
  useView(v);
  drawScene();
  drawHeat();
  drawTrail(ghost);
  drawFoundPath();
  drawPlan();
  drawProjection(rev, "#c7781a");
  drawProjection(fwd, "#1f9d6b");
  drawCar(colliding);
  if (!colliding && cl.p && cl.q && cl.d < 1.0) drawClearanceLine(cl.p, cl.q, cl.d);
  if (ghost) drawGhost(ghost);
  if (v.ego) drawCompass(v);
}
