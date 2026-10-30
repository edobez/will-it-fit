// A view maps world metres to screen pixels with a centre, a scale and a rotation.
// Drawing helpers operate on the current view, selected with useView().
import type { Poly, Pt } from "../core/geometry";

export interface View {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pane: HTMLElement;
  W: number; H: number;   // CSS pixels
  x: number; y: number;   // world point at the centre of the canvas
  scale: number;          // px per metre
  rot: number;            // rotation applied to the world (driver view)
  ego: boolean;
}

export function makeView(cv: HTMLCanvasElement, ego: boolean): View {
  return { cv, ctx: cv.getContext("2d")!, pane: cv.parentElement!, W: 0, H: 0, x: 15, y: 5, scale: 30, rot: 0, ego };
}

export let V: View;
export let ctx: CanvasRenderingContext2D;
export let W = 0, H = 0;

export function useView(v: View): void { V = v; ctx = v.ctx; W = v.W; H = v.H; }

export function resizeView(v: View): void {
  const dpr = window.devicePixelRatio || 1;
  v.W = v.cv.clientWidth; v.H = v.cv.clientHeight;
  v.cv.width = Math.round(v.W * dpr); v.cv.height = Math.round(v.H * dpr);
  v.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** World to screen in the current view. */
export function P2(x: number, y: number): Pt {
  const dx = x - V.x, dy = y - V.y, c = Math.cos(V.rot), s = Math.sin(V.rot);
  return [V.W / 2 + (c * dx - s * dy) * V.scale, V.H / 2 - (s * dx + c * dy) * V.scale];
}

export function screenToWorld(v: View, px: number, py: number): { x: number; y: number } {
  const rx = (px - v.W / 2) / v.scale, ry = (v.H / 2 - py) / v.scale, c = Math.cos(v.rot), s = Math.sin(v.rot);
  return { x: v.x + c * rx + s * ry, y: v.y - s * rx + c * ry };
}

/** Set the canvas transform so drawing can use world coordinates directly (used for the heatmap). */
export function setWorldTransform(): void {
  const dpr = window.devicePixelRatio || 1, k = V.scale, c = Math.cos(V.rot), s = Math.sin(V.rot);
  const a = c * k, b = -s * k, cc = -s * k, d = -c * k;
  const e = V.W / 2 - (a * V.x + cc * V.y), f = V.H / 2 - (b * V.x + d * V.y);
  ctx.setTransform(dpr * a, dpr * b, dpr * cc, dpr * d, dpr * e, dpr * f);
}
export function resetTransform(): void { const dpr = window.devicePixelRatio || 1; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }

export function pathPoly(poly: Poly): void {
  ctx.beginPath(); poly.forEach(([x, y], i) => i ? ctx.lineTo(...P2(x, y)) : ctx.moveTo(...P2(x, y))); ctx.closePath();
}
export function pathLine(pts: Pt[]): void {
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(...P2(x, y)) : ctx.moveTo(...P2(x, y)));
}

/** Polyline split into runs by flag; flagged runs drawn in the "bad" colour. */
export function drawRuns(pts: Pt[], flags: boolean[], color: string, bad: string): void {
  let i = 0;
  while (i < pts.length - 1) {
    const f = !!flags[i + 1];
    ctx.strokeStyle = f ? bad : color;
    ctx.beginPath(); ctx.moveTo(...P2(...pts[i]));
    let j = i + 1;
    while (j < pts.length && !!flags[j] === f) { ctx.lineTo(...P2(...pts[j])); j++; }
    if (j < pts.length) ctx.lineTo(...P2(...pts[j]));
    ctx.stroke();
    i = j;
  }
}

export interface LabelOpts { bold?: boolean; align?: CanvasTextAlign; bg?: string; color?: string; dy?: number }

export function label(text: string, x: number, y: number, opts: LabelOpts = {}): void {
  ctx.save();
  ctx.font = (opts.bold ? "600 " : "") + "11.5px system-ui, sans-serif";
  ctx.textAlign = opts.align || "center"; ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width, q = P2(x, y), dy = opts.dy || 0;
  if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(q[0] - (ctx.textAlign === "center" ? w / 2 : 0) - 3, q[1] + dy - 8, w + 6, 16); }
  ctx.fillStyle = opts.color || "#3a3f47";
  ctx.fillText(text, q[0], q[1] + dy);
  ctx.restore();
}
