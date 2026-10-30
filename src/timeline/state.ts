// Recording of the user's drive, and the timeline playhead shared by the drive and the plan tracks.
import { DEG } from "../core/math";
import { P } from "../params";
import { PLAN } from "../planner/client";
import { centerOf, clearanceOf, fp, st } from "../sim/world";
import type { Sample } from "../trajectory";

export const REC = { samples: [] as Sample[], t0: 0, version: 0, wasMoving: false };

export type Track = "drive" | "plan";
export const TL = { head: null as number | null, playing: false, rate: 1, collapsed: false, card: false, track: "drive" as Track };

function recSample(dir: number): Sample {
  const c = centerOf(st.pose), cl = clearanceOf(fp(st.pose), st.pose);
  return {
    s: st.driven, t: (performance.now() - REC.t0) / 1000, x: st.pose.x, y: st.pose.y, th: st.pose.th,
    delta: st.delta, dir, cx: c[0], cy: c[1], clr: cl.d, part: cl.part,
  };
}

/** Start a new recording from the current car state. */
export function recStart(): void {
  REC.t0 = performance.now();
  REC.samples = [recSample(0)];
  REC.version++; REC.wasMoving = false;
  TL.head = null; TL.playing = false;
}

/** Append a sample when the car moved 2 cm, stopped, or the wheel turned while standing. */
export function recFrame(): void {
  const arr = REC.samples, last = arr[arr.length - 1];
  const moved = st.driven - last.s, dsteer = Math.abs(st.delta - last.delta);
  const stopped = REC.wasMoving && !st.moving;
  if (moved >= 0.02 || (stopped && moved > 1e-4)) arr.push(recSample(st.lastDir));
  else if (moved <= 1e-4 && dsteer >= 0.5 * DEG) arr.push(recSample(0));
  else { REC.wasMoving = st.moving; return; }
  REC.wasMoving = st.moving;
  if (arr.length > 40000) arr.splice(1, arr.length - 40000);
  REC.version++;
}

function recountGears(): void {
  let last = 0, n = 0;
  for (const smp of REC.samples) if (smp.dir) { if (last && smp.dir !== last) n++; last = smp.dir; }
  st.gearChanges = n; st.lastDir = last;
}

export const xOf = (smp: Sample): number => P.tlAxis === "t" ? smp.t : smp.s;
export const trk = (): Sample[] => TL.track === "plan" && PLAN.samples ? PLAN.samples : REC.samples;
export const xMax = (): number => { const a = trk(); return a.length ? xOf(a[a.length - 1]) : 0; };

export interface SampleAt extends Sample { idx: number; f: number }

/** Interpolated sample at position x along the active track; idx is the sample just before. */
export function sampleAt(x: number): SampleAt | null {
  const a = trk();
  if (!a.length) return null;
  let lo = 0, hi = a.length - 1;
  if (x <= xOf(a[0])) return { ...a[0], idx: 0, f: 0 };
  if (x >= xOf(a[hi])) return { ...a[hi], idx: hi, f: 0 };
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xOf(a[m]) <= x) lo = m; else hi = m; }
  const A = a[lo], B = a[hi], span = xOf(B) - xOf(A);
  const f = span > 1e-9 ? (x - xOf(A)) / span : 0;
  const L = (k: "s" | "t" | "x" | "y" | "th" | "cx" | "cy") => A[k] + (B[k] - A[k]) * f;
  return {
    s: L("s"), t: L("t"), x: L("x"), y: L("y"), th: L("th"), delta: A.delta + (B.delta - A.delta) * f, dir: B.dir,
    cx: L("cx"), cy: L("cy"), clr: Math.min(A.clr, B.clr), part: A.clr <= B.clr ? A.part : B.part, idx: lo, f,
  };
}

export function setTrack(t: Track): void { TL.track = t; TL.head = null; TL.playing = false; }
export function tlLive(): void { TL.head = null; TL.playing = false; }

export function tlTogglePlay(): void {
  if (trk().length < 2) return;
  if (TL.playing) { TL.playing = false; return; }
  if (TL.head === null || TL.head >= xMax() - 1e-6) TL.head = 0;
  TL.playing = true;
}

/** Put the car at the playhead. On the drive track the recording is cut there; on the plan track a new recording starts. */
export function tlContinue(): void {
  if (TL.head === null) return;
  const g = sampleAt(TL.head);
  if (!g) return;
  if (TL.track === "plan") {
    st.pose = { x: g.x, y: g.y, th: g.th }; st.delta = g.delta;
    st.driven = 0; st.gearChanges = 0; st.lastDir = 0;
    recStart(); setTrack("drive");
    return;
  }
  const keep = REC.samples.slice(0, g.idx + 1);
  if (xOf(g) > xOf(keep[keep.length - 1]) + 1e-9) {
    const { idx: _i, f: _f, ...rest } = g;
    keep.push(rest);
  }
  REC.samples = keep;
  st.pose = { x: g.x, y: g.y, th: g.th }; st.delta = g.delta; st.driven = g.s;
  REC.t0 = performance.now() - g.t * 1000;
  recountGears();
  REC.version++;
  tlLive();
}

export function tlAdvance(dt: number): void {
  if (!TL.playing || TL.head === null) return;
  const v = P.tlAxis === "t" ? 1 : Math.max(0.2, P.speed);
  TL.head += dt * TL.rate * v;
  if (TL.head >= xMax()) { TL.head = xMax(); TL.playing = false; }
}
