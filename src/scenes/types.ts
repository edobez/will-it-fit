import type { Obstacle, ObstacleKind } from "../core/collision";
import type { Poly, Pt } from "../core/geometry";
import type { Pose } from "../core/kinematics";
import type { CarGeom } from "../core/vehicle";
import type { Field } from "../schema";

export type TargetKind = "garage" | "rect" | "bay";

export interface Target {
  kind: TargetKind;
  /** The car counts as parked when every corner of body and mirrors is inside this polygon. */
  poly: Poly;
  /** Axis aligned extent of the space (garage and parallel slots), for gap readouts. */
  rect?: { x0: number; y0: number; x1: number; y1: number };
  doorLine?: [Pt, Pt];
}

export interface SceneLabel { text: string; x: number; y: number; color?: string; align?: CanvasTextAlign }

export interface Scene {
  floor: Poly[];
  obstacles: Obstacle[];
  lines: [Pt, Pt][];
  target: Target;
  labels: SceneLabel[];
  bounds: [number, number, number, number];
  start: Pose;
  /** Direction pointing into the space, used by the driver view compass. */
  targetDir: number;
  /** Heading that counts as "forwards" for the planner's orientation goal. */
  noseDir: number;
}

/** Obstacle before bounding boxes and flags are filled in by finalize(). */
export type RawObstacle = Omit<Obstacle, "bb" | "low"> & { kind: ObstacleKind };
export type RawScene = Omit<Scene, "obstacles"> & { obstacles: RawObstacle[] };

export type ScenarioParams = Record<string, number | boolean>;

export interface ScenarioDef {
  name: string;
  schema: Field[];
  build: (sp: ScenarioParams, car: CarGeom) => RawScene;
}
