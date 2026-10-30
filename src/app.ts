// Application-level actions shared by the controls and the main loop.
import { save } from "./params";
import { PLAN, planValid, type PlanCallbacks } from "./planner/client";
import { rebuild, st, world } from "./sim/world";
import { TL, recStart, setTrack } from "./timeline/state";
import { $ } from "./ui/format";

export function resetCar(): void {
  st.pose = { ...world.scene.start };
  st.delta = 0; st.driven = 0; st.gearChanges = 0; st.lastDir = 0;
  recStart();
}

export function planStatus(html: string): void { $("planStatus").innerHTML = html; }

export function onParamsChanged(): void {
  rebuild();
  $("warn").textContent = world.warnings.join(" ");
  if (PLAN.samples && !planValid()) planStatus("The scene or car changed: the plan shown dashed is out of date. Plan again.");
  save();
}

export const planCallbacks: PlanCallbacks = {
  status: planStatus,
  found: () => {
    setTrack("plan"); TL.head = 0;
    TL.card = true; $("card").classList.add("open");
  },
};
