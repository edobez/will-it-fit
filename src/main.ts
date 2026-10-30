import "./style.css";
import { onParamsChanged, resetCar } from "./app";
import { load, P } from "./params";
import { applyViewMode, drawWorld, egoV, fitEgo, fitView, initViews, topV } from "./render/views";
import { update } from "./sim/drive";
import { project } from "./sim/projection";
import { RE, reachInvalidate, reachKey, reachRestart, reachStep } from "./sim/reach";
import { centerOf, clearanceOf, fp, st, world } from "./sim/world";
import { collides } from "./core/collision";
import { initPlot, drawTimeline } from "./timeline/plot";
import { recFrame, sampleAt, tlAdvance, TL } from "./timeline/state";
import { updateCard } from "./timeline/steps";
import { initControls, input, isDragging, syncControls } from "./ui/controls";
import { updateHud } from "./ui/hud";

load();
initViews();
onParamsChanged();
initControls();
initPlot();
applyViewMode();
fitView(); fitEgo();
resetCar();

let lastT = performance.now();
function frame(t: number): void {
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  update(dt, input);
  if (P.follow && !isDragging()) { const c = centerOf(st.pose); topV.x = c[0]; topV.y = c[1]; }
  const f = fp(st.pose);
  const colliding = collides(f, world.scene.obstacles);
  const cl = clearanceOf(f, st.pose);
  recFrame();
  tlAdvance(dt);
  const ghost = TL.head !== null ? sampleAt(TL.head) : null;
  const fwd = project(1, colliding), rev = project(-1, colliding);
  // reachability: restart on pose or scene change, compute only while the car is still
  const key = reachKey();
  if (key !== RE.key && !st.moving && !isDragging()) reachRestart(key);
  else if (key !== RE.key) reachInvalidate();
  if (!st.moving) reachStep(8);
  const data = { colliding, cl, fwd, rev, ghost };
  drawWorld(topV, data);
  drawWorld(egoV, data);
  updateHud(colliding, cl, fwd, rev, f);
  drawTimeline(ghost);
  updateCard(ghost);
  syncControls();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
