// Kinematic bicycle model with the reference point at the middle of the rear axle.

export interface Pose { x: number; y: number; th: number }

/** Advance a pose by signed arc length ds at steering angle delta. Exact arc integration. */
export function stepPose(p: Pose, ds: number, delta: number, wheelbase: number): Pose {
  if (Math.abs(delta) < 1e-6) return { x: p.x + Math.cos(p.th) * ds, y: p.y + Math.sin(p.th) * ds, th: p.th };
  const R = wheelbase / Math.tan(delta), th2 = p.th + ds / R;
  return { x: p.x + R * (Math.sin(th2) - Math.sin(p.th)), y: p.y - R * (Math.cos(th2) - Math.cos(p.th)), th: th2 };
}

/** Transform a point from the car frame (x forward, y left) to the world frame. */
export function toWorld(p: Pose, lx: number, ly: number): [number, number] {
  const c = Math.cos(p.th), s = Math.sin(p.th);
  return [p.x + c * lx - s * ly, p.y + s * lx + c * ly];
}
