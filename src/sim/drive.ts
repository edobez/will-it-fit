// Manual driving: steering persists, motion is blocked on contact.
import { stepPose } from "../core/kinematics";
import { DEG, clamp } from "../core/math";
import { P } from "../params";
import { TL, setTrack, tlLive } from "../timeline/state";
import { collidesAt, st, world } from "./world";

export interface DriveInput { fwd: boolean; back: boolean; left: boolean; right: boolean; fine: boolean }

export function update(dt: number, input: DriveInput): void {
  const g = world.car;
  const fine = input.fine ? 0.25 : 1;
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  if (steer) st.delta = clamp(st.delta + steer * P.steerRate * DEG * fine * dt, -g.dmax, g.dmax);
  const mv = (input.fwd ? 1 : 0) - (input.back ? 1 : 0);
  // touching the controls leaves replay and switches the timeline back to the drive
  if ((mv || steer) && TL.head !== null) tlLive();
  if ((mv || steer) && TL.track === "plan") setTrack("drive");
  st.moving = false;
  if (mv) {
    let dist = Math.max(0, P.speed) * fine * dt;
    const wasColliding = collidesAt(st.pose);   // a car placed overlapping something may drive out
    let moved = false;
    while (dist > 1e-9) {
      const ds = Math.min(0.01, dist);
      const np = stepPose(st.pose, mv * ds, st.delta, g.wb);
      if (!wasColliding && collidesAt(np)) { st.blockedT = 0.5; break; }
      st.pose = np; st.driven += ds; dist -= ds; moved = true;
    }
    if (moved) {
      if (st.lastDir && st.lastDir !== mv) st.gearChanges++;
      st.lastDir = mv; st.moving = true;
    }
  }
  st.blockedT = Math.max(0, st.blockedT - dt);
}
