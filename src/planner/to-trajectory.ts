// Turn planner primitives into the shared trajectory format and driver instructions.
import { clearance, footprint, type Obstacle } from "../core/collision";
import { stepPose, toWorld, type Pose } from "../core/kinematics";
import { centerLocal, type CarGeom } from "../core/vehicle";
import type { Sample, Step } from "../trajectory";
import { fmtM, steerText } from "../ui/format";
import type { Prim } from "./types";

export interface PlannedTrajectory {
  samples: Sample[];
  steps: Step[];
  ends: Pose[];      // pose at the end of each move
  moves: number;
  changes: number;
  length: number;
  minClearance: number;
  summary: string;
}

interface Run { dir: 1 | -1; lv: number; delta: number; len: number }
interface MoveStep extends Step { phases: { delta: number; len: number }[] }

export function toTrajectory(car: CarGeom, obstacles: Obstacle[], start: Pose, startDelta: number, prims: Prim[], speed: number): PlannedTrajectory {
  const st = (d: number) => steerText(d, car.dmax);
  // merge consecutive primitives with the same direction and steering
  const runs: Run[] = [];
  for (const p of prims) {
    const r = runs[runs.length - 1];
    if (r && r.dir === p.dir && r.lv === p.lv) r.len += p.len;
    else runs.push({ ...p });
  }
  const samples: Sample[] = [], steps: (Step | MoveStep)[] = [], ends: Pose[] = [];
  let pose: Pose = { ...start }, s = 0, t = 0, delta = startDelta, prevDir = 0, prevLv: number | null = null;
  const v = Math.max(0.2, speed);
  const push = (dir: number) => {
    const c = toWorld(pose, ...centerLocal(car)), cl = clearance(car, footprint(car, pose), pose, obstacles);
    samples.push({ s, t, x: pose.x, y: pose.y, th: pose.th, delta, dir, cx: c[0], cy: c[1], clr: cl.d, part: cl.part });
  };
  push(0);
  let move: MoveStep | null = null;
  const closeMove = () => { if (move) { move.i1 = samples.length - 1; steps.push(move); ends.push({ ...pose }); move = null; } };
  for (const r of runs) {
    const dirChange = prevDir !== 0 && r.dir !== prevDir;
    const bigSteer = prevLv !== null && Math.abs(r.lv - prevLv) > 1;
    if (prevDir === 0 || dirChange || bigSteer) {
      closeMove();
      if (Math.abs(r.delta - delta) > 1e-6) {
        const i0 = samples.length - 1;
        delta = r.delta; t += 1.0; push(0);
        steps.push({ kind: "stop", i0, i1: samples.length - 1, text: prevDir === 0 ? `Before starting, turn the wheel to ${st(delta)}` : `Stop, turn the wheel to ${st(delta)}` });
      }
      move = { kind: "move", dir: r.dir, i0: samples.length - 1, i1: -1, text: "", phases: [] };
    }
    delta = r.delta;
    move!.phases.push({ delta: r.delta, len: r.len });
    const n = Math.max(1, Math.ceil(r.len / 0.05)), runStart = { ...pose };
    for (let k = 1; k <= n; k++) {
      pose = stepPose(runStart, r.dir * r.len * k / n, r.delta, car.wb);
      s += r.len / n; t += r.len / n / v;
      push(r.dir);
    }
    prevDir = r.dir; prevLv = r.lv;
  }
  closeMove();

  let moves = 0, changes = 0, lastDir = 0, total = 0;
  for (const step of steps) {
    if (step.kind !== "move") continue;
    const mv = step as MoveStep;
    moves++; if (lastDir && mv.dir !== lastDir) changes++; lastDir = mv.dir!;
    // merge phases that read the same ("50% left") for readability
    const ph: { delta: number; len: number }[] = [];
    for (const p of mv.phases) {
      const last = ph[ph.length - 1];
      if (last && st(last.delta) === st(p.delta)) last.len += p.len; else ph.push({ ...p });
    }
    const len = ph.reduce((a, p) => a + p.len, 0); total += len; mv.len = len;
    let mn = Infinity, mnPart = "";
    for (let k = mv.i0; k <= mv.i1; k++) if (samples[k].clr < mn) { mn = samples[k].clr; mnPart = samples[k].part; }
    const wheel = ph.length === 1 ? `, wheel ${st(ph[0].delta)}` : `: ${ph.map((p, k) => `${k ? "then " : ""}${st(p.delta)} for ${p.len.toFixed(2)} m`).join(", ")}`;
    const cls = mn < 0.05 ? "bad" : mn < 0.15 ? "warn" : "";
    const minTxt = mn >= 1 ? "" : ` <span class="m">· min <span class="${cls}">${(mn * 100).toFixed(0)} cm</span>${mnPart ? " (" + mnPart + ")" : ""}</span>`;
    mv.text = `<b>${mv.dir! > 0 ? "Forward" : "Reverse"} ${len.toFixed(2)} m</b>${wheel}${minTxt}`;
  }
  const minClearance = Math.min(...samples.map(x => x.clr));
  return {
    samples, steps: steps.map(({ kind, i0, i1, text, dir, len }) => ({ kind, i0, i1, text, dir, len })), ends,
    moves, changes, length: total, minClearance,
    summary: `${moves} moves, ${changes} direction changes, ${fmtM(total)}, min clearance ${(minClearance * 100).toFixed(0)} cm`,
  };
}
