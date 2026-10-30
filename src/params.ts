// User-editable parameters, persisted in localStorage. P holds global settings, PS one record per scenario.
import { SCENARIOS } from "./scenes";
import type { ScenarioParams } from "./scenes";
import type { Field } from "./schema";

export const CAR_SCHEMA: Field[] = [
  { k: "carLength", label: "Length", unit: "m", v: 4.43, step: 0.01 },
  { k: "carWidth", label: "Width (body, no mirrors)", unit: "m", v: 1.86, step: 0.01 },
  { k: "mirrorWidth", label: "Width with mirrors", unit: "m", v: 2.03, step: 0.01 },
  { k: "mirrorFromFront", label: "Mirrors, distance from front", unit: "m", v: 1.85, step: 0.01 },
  { k: "wheelbase", label: "Wheelbase", unit: "m", v: 2.70, step: 0.01 },
  { k: "frontOverhang", label: "Front overhang", unit: "m", v: 0.90, step: 0.01 },
  { k: "track", label: "Track width", unit: "m", v: 1.60, step: 0.01 },
  { k: "turningCircle", label: "Turning circle, curb to curb", unit: "m", v: 11.4, step: 0.1 },
];
export const SIM_SCHEMA: Field[] = [
  { k: "speed", label: "Driving speed", unit: "m/s", v: 0.8, step: 0.1 },
  { k: "steerRate", label: "Steering rate (wheel angle)", unit: "°/s", v: 30, step: 1 },
  { k: "projLen", label: "Projection length", unit: "m", v: 6, step: 0.5 },
];
export const REACH_SCHEMA: Field[] = [
  { k: "reachHorizon", label: "Max distance driven", unit: "m", v: 14, step: 1 },
];
export const PLAN_SCHEMA: Field[] = [
  { k: "planMargin", label: "Safety margin around the car", unit: "m", v: 0.10, step: 0.01 },
  { k: "planDirPenalty", label: "Cost of a direction change", unit: "m", v: 4, step: 0.5 },
  { k: "planStopPenalty", label: "Cost of stopping to steer", unit: "m", v: 1.5, step: 0.25 },
  { k: "planSteerCost", label: "Cost of steering while moving, per full lock", unit: "m", v: 1.5, step: 0.25 },
  { k: "planRevFactor", label: "Reverse distance factor", unit: "×", v: 1.2, step: 0.05 },
  { k: "planClrWeight", label: "Prefer clearance (0 = off)", unit: "", v: 1, step: 0.25 },
  { k: "planSoftClr", label: "Clearance considered comfortable", unit: "m", v: 0.3, step: 0.05 },
  { k: "planTime", label: "Time limit", unit: "s", v: 30, step: 5 },
];

export type ViewMode = "both" | "top" | "driver";
export type ProjMode = "stop" | "pass";
export type ReachMode = "off" | "fwd" | "rev";
export type Orient = "any" | "fwd" | "rev";
export type PlanRes = "normal" | "fine";
export type Axis = "s" | "t";

export interface Params {
  // car
  carLength: number; carWidth: number; mirrorWidth: number; mirrorFromFront: number;
  wheelbase: number; frontOverhang: number; track: number; turningCircle: number; mirrorsFolded: boolean;
  // simulation and projection
  speed: number; steerRate: number; projLen: number; projMode: ProjMode;
  showCorners: boolean; showMirrorPaths: boolean;
  // reachability
  reachMode: ReachMode; reachHorizon: number;
  // planner
  planMargin: number; planDirPenalty: number; planStopPenalty: number; planSteerCost: number;
  planRevFactor: number; planClrWeight: number; planSoftClr: number; planTime: number;
  planOrient: Orient; planRes: PlanRes;
  // view and timeline
  viewMode: ViewMode; follow: boolean; tlAxis: Axis;
  scenario: string;
}

const GLOBAL_DEFAULTS = {
  mirrorsFolded: false, showCorners: true, showMirrorPaths: false, follow: false,
  viewMode: "both", projMode: "pass", reachMode: "off", scenario: "garage", tlAxis: "s", planOrient: "any", planRes: "normal",
};

const STORE_KEY = "willItFit.v1";

export const P = {} as Params;
export const PS: Record<string, ScenarioParams> = {};
// numeric/boolean access by key for generic panel code
export const store = (o: object) => o as Record<string, number | boolean | string>;

export function setDefaults(): void {
  for (const f of [...CAR_SCHEMA, ...SIM_SCHEMA, ...REACH_SCHEMA, ...PLAN_SCHEMA]) store(P)[f.k] = f.v;
  Object.assign(P, GLOBAL_DEFAULTS);
  for (const id in SCENARIOS) {
    PS[id] = {};
    for (const f of SCENARIOS[id].schema) PS[id][f.k] = f.v;
  }
}

export function load(): void {
  setDefaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved) {
      Object.assign(P, saved.P || {});
      for (const id in saved.PS || {}) if (PS[id]) Object.assign(PS[id], saved.PS[id]);
      if (!SCENARIOS[P.scenario]) P.scenario = "garage";
    }
  } catch { /* storage unavailable or corrupt: keep defaults */ }
}

export function save(): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ P, PS })); } catch { /* ignore */ }
}

/** Parameters of the current scenario. */
export const SP = (): ScenarioParams => PS[P.scenario];
