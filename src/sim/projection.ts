// Where the car goes if it keeps the current steering, forward or reverse.
import { pointInObstacle } from "../core/collision";
import type { Pt } from "../core/geometry";
import { stepPose, toWorld, type Pose } from "../core/kinematics";
import { bodyLocal, centerLocal } from "../core/vehicle";
import { P } from "../params";
import { collidesAt, st, world } from "./world";

export interface Projection {
  center: Pt[]; cflag: boolean[];        // centre path and whether the car overlaps something there
  corners: Pt[][]; kflag: boolean[][];   // body corner paths, flagged where a corner is inside an obstacle
  mirrors: Pt[][]; mflag: boolean[][];
  hit: Pose | null;                      // first pose in contact
  endPose: Pose | null;
  free: number;                          // distance before first contact
}

export function project(dir: 1 | -1, startColliding: boolean): Projection {
  const g = world.car, obs = world.scene.obstacles;
  const ds = 0.04, N = Math.ceil(Math.max(0.5, P.projLen) / ds);
  const pass = P.projMode === "pass";
  const cl = centerLocal(g), corners = bodyLocal(g);
  const mirrorTips: Pt[] = [[g.mx + 0.12, g.mw2], [g.mx + 0.12, -g.mw2]];
  const out: Projection = {
    center: [], cflag: [], corners: corners.map(() => []), kflag: corners.map(() => []),
    mirrors: mirrorTips.map(() => []), mflag: mirrorTips.map(() => []), hit: null, endPose: null, free: P.projLen,
  };
  let p: Pose = { ...st.pose };
  for (let i = 0; i <= N; i++) {
    const coll = i > 0 && !startColliding && collidesAt(p);
    if (coll && !out.hit) { out.hit = p; out.free = (i - 1) * ds; if (!pass) break; }
    out.center.push(toWorld(p, ...cl)); out.cflag.push(coll);
    corners.forEach((c, j) => { const w = toWorld(p, c[0], c[1]); out.corners[j].push(w); out.kflag[j].push(pass && pointInObstacle(w, obs)); });
    mirrorTips.forEach((c, j) => { const w = toWorld(p, c[0], c[1]); out.mirrors[j].push(w); out.mflag[j].push(pass && pointInObstacle(w, obs)); });
    out.endPose = p;
    p = stepPose(p, dir * ds, st.delta, g.wb);
  }
  return out;
}
