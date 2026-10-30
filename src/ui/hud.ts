import type { Clearance, Footprint } from "../core/collision";
import { pointInPoly } from "../core/geometry";
import { DEG } from "../core/math";
import { P } from "../params";
import type { Projection } from "../sim/projection";
import { RE } from "../sim/reach";
import { st, world } from "../sim/world";
import { $, fmtM } from "./format";

export function updateHud(colliding: boolean, cl: Clearance, fwd: Projection, rev: Projection, f: Footprint): void {
  const g = world.car, S = world.scene;
  const deg = st.delta / DEG, pct = Math.abs(st.delta) / g.dmax * 100;
  const dirTxt = Math.abs(deg) < 0.05 ? "straight" : (deg > 0 ? "left" : "right");
  const R = Math.abs(st.delta) > 1e-6 ? g.wb / Math.tan(Math.abs(st.delta)) : Infinity;
  const pts = f.parts.flat();
  const tp = S.target.poly;
  const inCount = pts.filter(v => pointInPoly(v, tp)).length;
  let status: string;
  if (colliding) status = '<span class="bad">Overlapping an obstacle (placed by hand). Drive out.</span>';
  else if (inCount === pts.length) {
    const t = S.target, r = t.rect;
    if ((t.kind === "garage" || t.kind === "rect") && r) {
      const xs = pts.map(v => v[0]), ys = pts.map(v => v[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      if (t.kind === "garage") {
        status = `<span class="good">Fully in garage, door can close</span><br>` +
          `<span class="k">behind door line</span> ${fmtM(minY - r.y0)} · <span class="k">front gap</span> ${fmtM(r.y1 - maxY)}<br>` +
          `<span class="k">side gaps</span> L ${fmtM(minX - r.x0)} · R ${fmtM(r.x1 - maxX)}`;
      } else {
        status = `<span class="good">Inside the slot</span><br>` +
          `<span class="k">slot ends</span> rear ${fmtM(minX - r.x0)} · front ${fmtM(r.x1 - maxX)}<br>` +
          `<span class="k">to curb/wall side</span> ${r.y1 - maxY >= 0 ? fmtM(r.y1 - maxY) : "overhangs " + fmtM(maxY - r.y1)}`;
      }
    } else status = '<span class="good">Inside the bay lines</span>';
  } else if (inCount > 0) status = '<span class="warn">Partly in the space</span>';
  else status = '<span class="k">Outside the space</span>';
  const clTxt = colliding ? '<span class="bad">contact</span>' :
    `<span class="${cl.d < 0.05 ? "bad" : cl.d < 0.15 ? "warn" : ""}">${(cl.d * 100).toFixed(0)} cm</span>`;
  const freeTxt = (pr: Projection) => pr.hit ? `<span class="${pr.free < 0.3 ? "bad" : "warn"}">${fmtM(pr.free)}</span>` : `&gt; ${fmtM(P.projLen)}`;
  let reach = "";
  if (P.reachMode !== "off") {
    const dirName = P.reachMode === "fwd" ? "forward only" : "reverse only";
    if (RE.key === "") reach = `<span class="k">space ${dirName}</span> updates when the car stops`;
    else if (RE.found) reach = `<span class="k">space ${dirName}</span> <span class="good">reachable, ${fmtM(RE.found.d)} path</span>`;
    else if (!RE.done) reach = `<span class="k">space ${dirName}</span> searching…`;
    else reach = `<span class="k">space ${dirName}</span> <span class="warn">not within ${fmtM(P.reachHorizon)}</span>`;
    reach += "<br>";
  }
  $("hud").innerHTML =
    `<span class="k">wheel</span> ${Math.abs(deg).toFixed(1)}° ${dirTxt} (${pct.toFixed(0)}% of ${(g.dmax / DEG).toFixed(1)}°)<br>` +
    `<span class="k">radius at rear axle</span> ${Number.isFinite(R) ? fmtM(R) : "∞"}<br>` +
    `<span class="k">free travel</span> fwd ${freeTxt(fwd)} · rev ${freeTxt(rev)}<br>` +
    `<span class="k">min clearance</span> ${clTxt}${st.blockedT > 0 ? ' <span class="bad">blocked</span>' : ""}<br>` +
    `<span class="k">driven</span> ${fmtM(st.driven)} · <span class="k">direction changes</span> ${st.gearChanges}<br>` +
    reach + status;
}
