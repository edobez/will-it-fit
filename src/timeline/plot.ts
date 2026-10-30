// Timeline plot: steering and clearance against distance (or time), with direction bands and the playhead.
import { clamp } from "../core/math";
import { P } from "../params";
import { PLAN } from "../planner/client";
import { st, world } from "../sim/world";
import { $, fmtM, steerText } from "../ui/format";
import { TL, trk, xMax, xOf, type SampleAt } from "./state";

const M = { L: 52, R: 12, T: 8, B: 18, gap: 10 };
let cv: HTMLCanvasElement, c: CanvasRenderingContext2D;

function niceStep(range: number, target: number): number {
  const raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

function geom() {
  const w = cv.clientWidth, h = cv.clientHeight;
  const ph = Math.max(20, (h - M.T - M.B - M.gap) / 2);
  const xmax = Math.max(xMax(), P.tlAxis === "t" ? 5 : 1);
  return {
    w, h, ph, xmax,
    X: (v: number) => M.L + v / xmax * (w - M.L - M.R),
    Xinv: (px: number) => (px - M.L) / (w - M.L - M.R) * xmax,
    s0: M.T, c0: M.T + ph + M.gap,
  };
}

export function initPlot(): void {
  cv = $<HTMLCanvasElement>("tlcv");
  c = cv.getContext("2d")!;
  let dragging = false;
  const scrub = (e: PointerEvent) => {
    if (trk().length < 2) return;
    TL.head = clamp(geom().Xinv(e.offsetX), 0, xMax()); TL.playing = false;
  };
  cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); dragging = true; scrub(e); });
  cv.addEventListener("pointermove", e => { if (dragging) scrub(e); });
  const up = () => { dragging = false; };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
}

export function drawTimeline(ghost: SampleAt | null): void {
  const dmax = world.car.dmax;
  const read = $("tlread");
  if (ghost) {
    read.textContent = `@ ${fmtM(ghost.s)} · ${ghost.t.toFixed(1)} s · wheel ${steerText(ghost.delta, dmax)} · clearance ${ghost.clr >= 1 ? "> 1 m" : (ghost.clr * 100).toFixed(0) + " cm"}${ghost.part ? " (" + ghost.part + ")" : ""}`;
  } else if (TL.track === "plan" && PLAN.samples) read.textContent = `plan · ${PLAN.summary}`;
  else read.textContent = `live · recorded ${fmtM(st.driven)} · ${st.gearChanges} direction changes`;
  const play = $<HTMLButtonElement>("tPlay");
  play.textContent = TL.playing ? "❚❚ Pause" : "▶ Play";
  play.classList.toggle("on", TL.playing);
  $<HTMLButtonElement>("tLive").disabled = TL.head === null;
  $<HTMLButtonElement>("tCont").disabled = TL.head === null;
  if (TL.collapsed || cv.clientHeight === 0) return;

  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(cv.clientWidth * dpr) || cv.height !== Math.round(cv.clientHeight * dpr)) {
    cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const G = geom(), a = trk();
  c.clearRect(0, 0, G.w, G.h);
  c.font = "10.5px system-ui, sans-serif"; c.textBaseline = "middle";
  const x0 = M.L, x1 = G.w - M.R;
  // panel frames
  c.fillStyle = "#fafaf8";
  c.fillRect(x0, G.s0, x1 - x0, G.ph); c.fillRect(x0, G.c0, x1 - x0, G.ph);
  // direction bands
  for (let i = 1; i < a.length;) {
    const d = a[i].dir;
    let j = i; while (j + 1 < a.length && a[j + 1].dir === d) j++;
    if (d) {
      c.fillStyle = d > 0 ? "rgba(31,157,107,.13)" : "rgba(199,120,26,.17)";
      const bx0 = G.X(xOf(a[i - 1])), bx1 = G.X(xOf(a[j]));
      c.fillRect(bx0, G.s0, Math.max(1, bx1 - bx0), G.ph); c.fillRect(bx0, G.c0, Math.max(1, bx1 - bx0), G.ph);
    }
    i = j + 1;
  }
  // steering panel
  const sMid = G.s0 + G.ph / 2, sK = (G.ph / 2 - 4) / dmax, SY = (d: number) => sMid - d * sK;
  c.strokeStyle = "rgba(0,0,0,.18)"; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x0, sMid); c.lineTo(x1, sMid); c.stroke();
  c.setLineDash([3, 3]);
  for (const v of [dmax, -dmax]) { c.beginPath(); c.moveTo(x0, SY(v)); c.lineTo(x1, SY(v)); c.stroke(); }
  c.setLineDash([]);
  c.fillStyle = "#6b7280"; c.textAlign = "right";
  c.fillText("lock L", x0 - 5, SY(dmax)); c.fillText("0", x0 - 5, sMid); c.fillText("lock R", x0 - 5, SY(-dmax));
  if (a.length > 1) {
    c.strokeStyle = "#2f6fb3"; c.lineWidth = 1.8;
    c.beginPath(); a.forEach((p, i) => i ? c.lineTo(G.X(xOf(p)), SY(p.delta)) : c.moveTo(G.X(xOf(p)), SY(p.delta))); c.stroke();
  }
  // clearance panel (clipped at 1 m: tight spots are what matter)
  const CMAX = 1.0, cB = G.c0 + G.ph, CY = (d: number) => cB - Math.min(d, CMAX) / CMAX * (G.ph - 3);
  c.strokeStyle = "rgba(207,63,63,.6)"; c.setLineDash([3, 3]);
  c.beginPath(); c.moveTo(x0, CY(0.05)); c.lineTo(x1, CY(0.05)); c.stroke();
  c.strokeStyle = "rgba(199,120,26,.6)";
  c.beginPath(); c.moveTo(x0, CY(0.15)); c.lineTo(x1, CY(0.15)); c.stroke();
  c.setLineDash([]);
  c.fillStyle = "#6b7280";
  c.fillText("≥1 m", x0 - 5, CY(1) + 4); c.fillText("15 cm", x0 - 5, CY(0.15)); c.fillText("0", x0 - 5, cB - 2);
  if (a.length > 1) {
    c.lineWidth = 1.8;
    const cls = (d: number) => d < 0.05 ? "#cf3f3f" : d < 0.15 ? "#c7781a" : "#3a3f47";
    for (let i = 1; i < a.length;) {
      const col = cls(a[i].clr);
      c.strokeStyle = col; c.beginPath(); c.moveTo(G.X(xOf(a[i - 1])), CY(a[i - 1].clr));
      let j = i; while (j < a.length && cls(a[j].clr) === col) { c.lineTo(G.X(xOf(a[j])), CY(a[j].clr)); j++; }
      c.stroke(); i = j;
    }
    // label the tightest local minima with the closest part
    const mins: number[] = [];
    for (let i = 0; i < a.length; i++) {
      const v = a[i].clr; if (!(v < 0.4)) continue;
      let isMin = true;
      for (let k = i - 1; k >= 0 && a[i].s - a[k].s < 0.4; k--) if (a[k].clr < v) { isMin = false; break; }
      if (isMin) for (let k = i + 1; k < a.length && a[k].s - a[i].s < 0.4; k++) if (a[k].clr <= v) { isMin = false; break; }
      if (isMin) mins.push(i);
    }
    mins.sort((p, q) => a[p].clr - a[q].clr);
    const placed: number[] = [];
    c.textAlign = "center";
    for (const i of mins) {
      const px = G.X(xOf(a[i])); if (placed.some(q => Math.abs(q - px) < 90)) continue;
      placed.push(px); if (placed.length > 6) break;
      const py = CY(a[i].clr);
      c.fillStyle = a[i].clr < 0.05 ? "#cf3f3f" : "#c7781a";
      c.beginPath(); c.arc(px, py, 3, 0, Math.PI * 2); c.fill();
      const txt = a[i].clr === 0 ? "contact" : `${(a[i].clr * 100).toFixed(0)} cm · ${a[i].part}`;
      const tw = c.measureText(txt).width;
      const tx = clamp(px, x0 + tw / 2 + 2, x1 - tw / 2 - 2), ty = Math.max(G.c0 + 7, py - 10);
      c.fillStyle = "rgba(255,255,255,.85)"; c.fillRect(tx - tw / 2 - 2, ty - 6, tw + 4, 12);
      c.fillStyle = "#1d2128"; c.fillText(txt, tx, ty);
    }
  } else {
    c.fillStyle = "#6b7280"; c.textAlign = "center";
    c.fillText(TL.track === "plan" ? "No plan yet. Press Plan to compute one from the current position." : "Drive to record a manoeuvre. Click or drag here afterwards to replay it.", (x0 + x1) / 2, G.s0 + G.ph);
  }
  // panel titles
  c.textAlign = "left"; c.fillStyle = "#6b7280";
  c.fillText("steering", x0 + 4, G.s0 + 8); c.fillText("clearance", x0 + 4, G.c0 + 8);
  // x axis
  const unit = P.tlAxis === "t" ? "s" : "m", step = niceStep(G.xmax, Math.max(3, Math.floor((x1 - x0) / 80)));
  c.textAlign = "center"; c.fillStyle = "#6b7280"; c.strokeStyle = "rgba(0,0,0,.08)";
  for (let v = 0; v <= G.xmax + 1e-9; v += step) {
    const px = G.X(v);
    c.beginPath(); c.moveTo(px, G.s0); c.lineTo(px, cB); c.stroke();
    c.fillText(`${+v.toFixed(2)} ${unit}`, px, cB + 9);
  }
  // playhead
  if (TL.head !== null) {
    const px = G.X(TL.head);
    c.strokeStyle = "#8e44ad"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(px, G.s0 - 4); c.lineTo(px, cB + 2); c.stroke();
    c.fillStyle = "#8e44ad"; c.beginPath(); c.moveTo(px - 5, G.s0 - 6); c.lineTo(px + 5, G.s0 - 6); c.lineTo(px, G.s0); c.fill();
  }
}
