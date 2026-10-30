// The shared trajectory format: recorded drives and planned manoeuvres are both lists of samples.

export interface Sample {
  s: number;      // distance driven (m)
  t: number;      // time (s)
  x: number; y: number; th: number; // rear axle pose
  delta: number;  // wheel angle
  dir: number;    // 1 forward, -1 reverse, 0 standing (steering only)
  cx: number; cy: number; // car centre, for drawing
  clr: number;    // smallest clearance (m)
  part: string;   // closest part of the car
}

/** One instruction of a manoeuvre, spanning samples i0..i1. */
export interface Step {
  kind: "init" | "stop" | "move";
  i0: number; i1: number;
  text: string;   // HTML
  dir?: number;
  len?: number;
}
