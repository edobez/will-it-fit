// Manoeuvre steps: instructions derived from a recorded drive, and the steps card.
import { PLAN } from "../planner/client";
import type { Sample, Step } from "../trajectory";
import { $, fmtM, steerText } from "../ui/format";
import { world } from "../sim/world";
import { REC, TL, trk, xOf, type SampleAt } from "./state";

interface DriveMove extends Step { from: number; to: number; lo: number; hi: number; mn: number; mnPart: string }

/** Summarise a recorded drive as steps. Steering changes while moving are described as "from X via Y to Z". */
export function driveSteps(a: Sample[], dmax: number): Step[] {
  const st = (d: number) => steerText(d, dmax);
  const steps: (Step | DriveMove)[] = [];
  if (a.length < 2) return [];
  if (Math.abs(a[0].delta) / dmax >= 0.05) steps.push({ kind: "init", i0: 0, i1: 0, text: `Start with the wheel ${st(a[0].delta)}` });
  for (let i = 1; i < a.length;) {
    const d = a[i].dir;
    let j = i; while (j + 1 < a.length && a[j + 1].dir === d) j++;
    const A = a[i - 1], B = a[j];
    if (d === 0) {
      if (Math.abs(B.delta - A.delta) / dmax >= 0.05) steps.push({ kind: "stop", i0: i - 1, i1: j, text: `Stop, turn the wheel to ${st(B.delta)}` });
    } else {
      let mn = Infinity, mnPart = "", lo = Infinity, hi = -Infinity;
      for (let k = i - 1; k <= j; k++) {
        if (a[k].clr < mn) { mn = a[k].clr; mnPart = a[k].part; }
        lo = Math.min(lo, a[k].delta); hi = Math.max(hi, a[k].delta);
      }
      const prev = steps[steps.length - 1] as DriveMove | undefined;
      if (prev && prev.kind === "move" && prev.dir === d) { // merge two moves split by a negligible stop
        prev.len! += B.s - A.s; prev.i1 = j; prev.to = B.delta; prev.lo = Math.min(prev.lo, lo); prev.hi = Math.max(prev.hi, hi);
        if (mn < prev.mn) { prev.mn = mn; prev.mnPart = mnPart; }
      } else steps.push({ kind: "move", dir: d, len: B.s - A.s, i0: i - 1, i1: j, text: "", from: A.delta, to: B.delta, lo, hi, mn, mnPart });
    }
    i = j + 1;
  }
  for (const s of steps) {
    if (s.kind !== "move") continue;
    const m = s as DriveMove;
    const steady = (m.hi - m.lo) / dmax < 0.12;
    let wheel: string;
    if (steady) wheel = `wheel ${st((m.lo + m.hi) / 2)}`;
    else {
      const via = [m.lo, m.hi].find(v => Math.abs(v - m.from) / dmax > 0.12 && Math.abs(v - m.to) / dmax > 0.12);
      wheel = `wheel from ${st(m.from)}${via !== undefined ? " via " + st(via) : ""} to ${st(m.to)}`;
    }
    const cls = m.mn < 0.05 ? "bad" : m.mn < 0.15 ? "warn" : "";
    const minTxt = m.mn >= 1 ? "" : ` <span class="m">· min <span class="${cls}">${m.mn === 0 ? "contact" : (m.mn * 100).toFixed(0) + " cm"}</span>${m.mnPart && m.mn > 0 ? " (" + m.mnPart + ")" : ""}</span>`;
    m.text = `<b>${m.dir! > 0 ? "Forward" : "Reverse"} ${m.len!.toFixed(2)} m</b>, ${wheel}${minTxt}`;
  }
  return steps.filter(s => s.kind !== "move" || s.len! >= 0.03).map(({ kind, i0, i1, text, dir, len }) => ({ kind, i0, i1, text, dir, len }));
}

let cardKey = "";
let cardSteps: Step[] = [];
let cardEls: HTMLLIElement[] = [];

export function updateCard(ghost: SampleAt | null): void {
  if (!TL.card) return;
  const body = $("cardBody");
  const isPlan = TL.track === "plan" && !!PLAN.samples;
  const key = `${isPlan ? "p" + PLAN.version : "d" + REC.version}`;
  if (cardKey !== key) {
    cardKey = key;
    $("cardTitle").textContent = isPlan ? "Planned manoeuvre" : "Your drive";
    cardSteps = isPlan ? (PLAN.steps ?? []) : driveSteps(REC.samples, world.car.dmax);
    const moves = cardSteps.filter(s => s.kind === "move");
    const changes = moves.reduce((n, m, i) => n + (i && m.dir !== moves[i - 1].dir ? 1 : 0), 0);
    body.innerHTML = cardSteps.length
      ? `<div class="note" style="margin-bottom:6px">${moves.length} moves, ${changes} direction changes, ${fmtM(moves.reduce((n, m) => n + (m.len ?? 0), 0))} driven. Click a step to jump there.</div><ol>${cardSteps.map(s => `<li>${s.text}</li>`).join("")}</ol>`
      : `<div class="note">${TL.track === "plan" ? "No plan yet, or the car is already inside the space." : "Nothing recorded yet. Drive the car and the steps appear here."}</div>`;
    cardEls = [...body.querySelectorAll("li")];
    cardEls.forEach((li, k) => li.onclick = () => { TL.head = xOf(trk()[cardSteps[k].i0]); TL.playing = false; });
  }
  const a = trk();
  const hx = ghost ? xOf(ghost) : null;
  cardEls.forEach((li, k) => {
    const s = cardSteps[k], x0 = xOf(a[s.i0]), x1 = xOf(a[s.i1]);
    li.classList.toggle("cur", hx !== null && hx >= x0 - 1e-9 && (hx < x1 || (k === cardSteps.length - 1 && hx <= x1 + 1e-9)));
  });
}
