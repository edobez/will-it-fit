// The current car geometry, scene and car state, plus helpers bound to them.
import { clearance, collides, footprint, type Clearance, type Footprint } from "../core/collision";
import { toWorld, type Pose } from "../core/kinematics";
import { clamp } from "../core/math";
import { centerLocal, deriveCar, type CarGeom } from "../core/vehicle";
import type { Pt } from "../core/geometry";
import { P, SP } from "../params";
import { buildScene, type Scene } from "../scenes";

export const world = {
  car: null as unknown as CarGeom,
  carVersion: 0,
  scene: null as unknown as Scene,
  sceneVersion: 0,
  warnings: [] as string[],
};

/** Rebuild car geometry and scene from the current parameters. */
export function rebuild(): void {
  const { geom, warnings } = deriveCar(P);
  world.car = geom; world.warnings = warnings; world.carVersion++;
  world.scene = buildScene(P.scenario, SP(), geom); world.sceneVersion++;
  st.delta = clamp(st.delta, -geom.dmax, geom.dmax);
}

export interface CarState {
  pose: Pose;
  delta: number;        // current wheel angle, positive = left
  driven: number;       // distance driven since the recording started
  gearChanges: number;
  lastDir: number;      // last direction of motion: 1, -1 or 0
  blockedT: number;     // seconds left to flash "blocked"
  moving: boolean;      // moved during the last update
}

export const st: CarState = { pose: { x: 0, y: 0, th: 0 }, delta: 0, driven: 0, gearChanges: 0, lastDir: 0, blockedT: 0, moving: false };

export const fp = (p: Pose): Footprint => footprint(world.car, p);
export const collidesAt = (p: Pose): boolean => collides(fp(p), world.scene.obstacles);
export const clearanceOf = (f: Footprint, p: Pose): Clearance => clearance(world.car, f, p, world.scene.obstacles);
export const centerOf = (p: Pose): Pt => toWorld(p, ...centerLocal(world.car));
