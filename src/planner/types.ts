import type { Obstacle } from "../core/collision";
import type { Poly } from "../core/geometry";
import type { Pose } from "../core/kinematics";
import type { CarGeom } from "../core/vehicle";
import type { Orient, PlanRes } from "../params";

export interface PlanOptions {
  margin: number;       // safety margin around the car (m)
  dirPenalty: number;   // cost of a direction change, in metres of driving
  stopPenalty: number;  // cost of stopping to turn the wheel a lot
  steerCost: number;    // cost of steering while moving, per full lock change
  revFactor: number;    // reverse distance multiplier
  clrWeight: number;    // weight of the soft clearance penalty
  softClr: number;      // clearance considered comfortable (m)
  orient: Orient;
  res: PlanRes;
  maxTime: number;      // s
}

export interface PlanRequest {
  car: CarGeom;
  obstacles: Obstacle[];
  target: { poly: Poly; noseDir: number };
  bounds: [number, number, number, number];
  start: Pose;
  startDelta: number;
  opts: PlanOptions;
}

/** A motion primitive: drive len metres in direction dir at steering level lv (wheel angle delta). */
export interface Prim { dir: 1 | -1; lv: number; delta: number; len: number }

export type PlanMessage =
  | { type: "progress"; expanded: number; ms: number; h: number }
  | { type: "done"; prims: Prim[]; expanded: number; ms: number; cost: number; levels: number }
  | { type: "fail"; reason: string; expanded?: number };
