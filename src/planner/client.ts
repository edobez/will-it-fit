// Runs the planner in a Web Worker and keeps the latest plan.
import type { Pose } from "../core/kinematics";
import { P } from "../params";
import { st, world } from "../sim/world";
import type { Sample, Step } from "../trajectory";
import { toTrajectory } from "./to-trajectory";
import type { PlanMessage, PlanRequest } from "./types";

export const PLAN = {
  samples: null as Sample[] | null,
  steps: null as Step[] | null,
  ends: [] as Pose[],
  summary: "",
  version: 0,
  sceneVersion: -1,
  carVersion: -1,
  worker: null as Worker | null,
  running: false,
};

export const planValid = (): boolean =>
  !!PLAN.samples && PLAN.sceneVersion === world.sceneVersion && PLAN.carVersion === world.carVersion;

export interface PlanCallbacks {
  status: (html: string) => void;
  found: () => void;
}

export function cancelPlan(cb: PlanCallbacks, msg?: string): void {
  if (PLAN.worker) { PLAN.worker.terminate(); PLAN.worker = null; }
  if (PLAN.running && msg) cb.status(msg);
  PLAN.running = false;
}

export function buildRequest(): PlanRequest {
  const S = world.scene;
  return {
    car: world.car,
    obstacles: S.obstacles,
    target: { poly: S.target.poly, noseDir: S.noseDir },
    bounds: S.bounds,
    start: { ...st.pose },
    startDelta: st.delta,
    opts: {
      margin: Math.max(0, P.planMargin), dirPenalty: Math.max(0, P.planDirPenalty), stopPenalty: Math.max(0, P.planStopPenalty),
      steerCost: Math.max(0, P.planSteerCost), revFactor: Math.max(1, P.planRevFactor),
      clrWeight: Math.max(0, P.planClrWeight), softClr: Math.max(0.01, P.planSoftClr),
      orient: P.planOrient, res: P.planRes, maxTime: Math.max(1, P.planTime),
    },
  };
}

export function startPlan(cb: PlanCallbacks): void {
  cancelPlan(cb);
  let w: Worker;
  try {
    w = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  } catch (err) {
    cb.status(`<span style="color:var(--bad)">Could not start the planner worker: ${(err as Error).message}</span>`);
    return;
  }
  PLAN.worker = w; PLAN.running = true;
  const req = buildRequest();
  const sv = world.sceneVersion, cv = world.carVersion, car = world.car, obstacles = world.scene.obstacles;
  cb.status("Preparing…");
  w.onmessage = (e: MessageEvent<PlanMessage>) => {
    const r = e.data;
    if (r.type === "progress") {
      cb.status(`Searching… ${r.expanded.toLocaleString()} states, ${(r.ms / 1000).toFixed(1)} s${Number.isFinite(r.h) ? ", " + r.h.toFixed(1) + " m from the space" : ""}`);
      return;
    }
    PLAN.running = false; w.terminate(); PLAN.worker = null;
    if (r.type === "fail") { cb.status(`<span style="color:var(--bad)">${r.reason}</span>`); return; }
    if (!r.prims.length) { cb.status("The car is already inside the space with the requested orientation."); return; }
    const tr = toTrajectory(car, obstacles, req.start, req.startDelta, r.prims, P.speed);
    Object.assign(PLAN, { samples: tr.samples, steps: tr.steps, ends: tr.ends, summary: tr.summary, sceneVersion: sv, carVersion: cv });
    PLAN.version++;
    cb.status(`<span style="color:var(--good)">Found:</span> ${tr.summary}. ${r.expanded.toLocaleString()} states in ${(r.ms / 1000).toFixed(1)} s.`);
    cb.found();
  };
  w.onerror = e => { PLAN.running = false; cb.status(`<span style="color:var(--bad)">Planner crashed: ${e.message}</span>`); };
  w.postMessage(req);
}
