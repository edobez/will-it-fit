// Settings panel, buttons, keyboard, on-screen pad and pointer interaction with the views.
import { onParamsChanged, planCallbacks, resetCar } from "../app";
import { pointInPoly } from "../core/geometry";
import { DEG, clamp } from "../core/math";
import { CAR_SCHEMA, P, PLAN_SCHEMA, REACH_SCHEMA, SIM_SCHEMA, SP, save, setDefaults, store, type Axis } from "../params";
import { cancelPlan, startPlan } from "../planner/client";
import { applyViewMode, egoV, fitEgo, fitView, topV } from "../render/views";
import { screenToWorld, type View } from "../render/view";
import { SCENARIOS } from "../scenes";
import type { Field } from "../schema";
import type { DriveInput } from "../sim/drive";
import { fp, st } from "../sim/world";
import { TL, recStart, sampleAt, setTrack, tlContinue, tlLive, tlTogglePlay, trk, xOf, type Track } from "../timeline/state";
import { $ } from "./format";

export const input: DriveInput = { fwd: false, back: false, left: false, right: false, fine: false };
let dragging = false;
export const isDragging = (): boolean => dragging;

// ---------- settings panel ----------
function buildRows(container: HTMLElement, schema: Field[], target: object, onChange: () => void): void {
  const s = store(target);
  container.innerHTML = "";
  for (const f of schema) {
    if (f.type === "bool") {
      const l = document.createElement("label"); l.className = "chk";
      l.innerHTML = `<input type="checkbox"> ${f.label}`;
      const cb = l.querySelector("input")!; cb.checked = !!s[f.k];
      cb.onchange = () => { s[f.k] = cb.checked; onChange(); };
      container.appendChild(l);
      continue;
    }
    const row = document.createElement("div"); row.className = "row";
    row.innerHTML = `<label>${f.label}</label><input type="number" step="${f.step}" value="${s[f.k]}"><span class="u">${f.unit}</span>`;
    container.appendChild(row);
    row.querySelector("input")!.addEventListener("input", e => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      if (Number.isFinite(v)) { s[f.k] = v; onChange(); }
    });
  }
}

function buildPanel(): void {
  $<HTMLSelectElement>("scenario").value = P.scenario;
  buildRows($("scnFields"), SCENARIOS[P.scenario].schema, SP(), onParamsChanged);
  buildRows($("carFields"), CAR_SCHEMA, P, onParamsChanged);
  buildRows($("simFields"), SIM_SCHEMA, P, onParamsChanged);
  buildRows($("reachFields"), REACH_SCHEMA, P, onParamsChanged);
  buildRows($("planFields"), PLAN_SCHEMA, P, save);
  for (const k of ["mirrorsFolded", "showCorners", "showMirrorPaths", "follow"]) {
    const el = $<HTMLInputElement>(k); el.checked = !!store(P)[k];
    el.onchange = () => { store(P)[k] = el.checked; onParamsChanged(); };
  }
  for (const k of ["planOrient", "planRes"]) {
    const el = $<HTMLSelectElement>(k); el.value = String(store(P)[k]);
    el.onchange = () => { store(P)[k] = el.value; save(); };
  }
  for (const k of ["projMode", "reachMode", "viewMode"]) {
    const el = $<HTMLSelectElement>(k); el.value = String(store(P)[k]);
    el.onchange = () => { store(P)[k] = el.value; applyViewMode(); onParamsChanged(); };
  }
}

function cycle(key: "viewMode" | "projMode" | "reachMode", values: string[]): void {
  const s = store(P);
  s[key] = values[(values.indexOf(String(s[key])) + 1) % values.length];
  $<HTMLSelectElement>(key).value = String(s[key]);
  applyViewMode(); save();
}

// ---------- pointer: drag the car, pan, zoom ----------
function attachPointer(v: View): void {
  const cv = v.cv, pts = new Map<number, { x: number; y: number }>();
  type Drag = { mode: "car"; ox: number; oy: number } | { mode: "pan"; sx: number; sy: number; cx: number; cy: number } | { mode: "pinch"; d0: number; s0: number };
  let dg: Drag | null = null;
  cv.addEventListener("pointerdown", e => {
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    $("panel").classList.remove("open");
    if (pts.size === 1) {
      const w = screenToWorld(v, e.offsetX, e.offsetY);
      if (!v.ego && pointInPoly([w.x, w.y], fp(st.pose).parts[0])) dg = { mode: "car", ox: w.x - st.pose.x, oy: w.y - st.pose.y };
      else if (!v.ego) dg = { mode: "pan", sx: e.offsetX, sy: e.offsetY, cx: v.x, cy: v.y };
      else dg = null;
      if (dg) cv.style.cursor = "grabbing";
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      dg = { mode: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y), s0: v.scale };
    }
    dragging = !!dg;
  });
  cv.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (!dg) return;
    if (dg.mode === "car") {
      const w = screenToWorld(v, e.offsetX, e.offsetY);
      st.pose.x = w.x - dg.ox; st.pose.y = w.y - dg.oy;
    } else if (dg.mode === "pan") {
      v.x = dg.cx - (e.offsetX - dg.sx) / v.scale;
      v.y = dg.cy + (e.offsetY - dg.sy) / v.scale;
      if (P.follow) { P.follow = false; $<HTMLInputElement>("follow").checked = false; save(); }
    } else if (dg.mode === "pinch" && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      v.scale = clamp(dg.s0 * Math.hypot(a.x - b.x, a.y - b.y) / (dg.d0 || 1), 5, 600);
    }
  });
  const end = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (dg && dg.mode === "car") recStart();
    dg = null; dragging = false; cv.style.cursor = v.ego ? "default" : "grab";
  };
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  cv.addEventListener("wheel", e => {
    e.preventDefault();
    if (v.ego) { v.scale = clamp(v.scale * Math.exp(-e.deltaY * 0.0015), 5, 600); return; }
    const before = screenToWorld(v, e.offsetX, e.offsetY);
    v.scale = clamp(v.scale * Math.exp(-e.deltaY * 0.0015), 5, 600);
    const after = screenToWorld(v, e.offsetX, e.offsetY);
    v.x += before.x - after.x; v.y += before.y - after.y;
  }, { passive: false });
}

// ---------- keyboard and pad ----------
const KEYMAP: Record<string, keyof DriveInput> = {
  ArrowUp: "fwd", KeyW: "fwd", ArrowDown: "back", KeyS: "back", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};
const isTyping = (e: Event) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
};

function initKeyboard(): void {
  window.addEventListener("keydown", e => {
    if (isTyping(e)) return;
    if (e.key === "Shift") input.fine = true;
    const k = KEYMAP[e.code];
    if (k) { input[k] = true; e.preventDefault(); return; }
    if (e.code === "KeyC") st.delta = 0;
    else if (e.code === "KeyR") resetCar();
    else if (e.code === "KeyF") { fitView(); fitEgo(); }
    else if (e.code === "KeyV") cycle("viewMode", ["both", "top", "driver"]);
    else if (e.code === "KeyP") cycle("projMode", ["stop", "pass"]);
    else if (e.code === "KeyH") cycle("reachMode", ["off", "fwd", "rev"]);
    else if (e.code === "KeyQ") { st.pose.th += 5 * DEG; recStart(); }
    else if (e.code === "KeyE") { st.pose.th -= 5 * DEG; recStart(); }
    else if (e.code === "Space") { e.preventDefault(); tlTogglePlay(); }
    else if (e.code === "Escape") tlLive();
    else if (e.code === "Enter") tlContinue();
  });
  window.addEventListener("keyup", e => {
    if (e.key === "Shift") input.fine = false;
    const k = KEYMAP[e.code]; if (k) input[k] = false;
  });
  window.addEventListener("blur", () => { for (const k of Object.keys(input) as (keyof DriveInput)[]) input[k] = false; });

  document.querySelectorAll<HTMLButtonElement>("#pad button").forEach(b => {
    const k = b.dataset.k!;
    if (k === "center") { b.addEventListener("pointerdown", e => { e.preventDefault(); st.delta = 0; }); return; }
    if (k === "fine") { b.addEventListener("pointerdown", e => { e.preventDefault(); input.fine = !input.fine; b.classList.toggle("on", input.fine); }); return; }
    const key = k as keyof DriveInput;
    const on = (e: PointerEvent) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); input[key] = true; b.classList.add("on"); };
    const off = () => { input[key] = false; b.classList.remove("on"); };
    b.addEventListener("pointerdown", on);
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
    b.addEventListener("lostpointercapture", off);
    b.addEventListener("contextmenu", e => e.preventDefault());
  });
}

// ---------- buttons ----------
function initButtons(): void {
  const scn = $<HTMLSelectElement>("scenario");
  for (const id in SCENARIOS) { const o = document.createElement("option"); o.value = id; o.textContent = SCENARIOS[id].name; scn.appendChild(o); }
  scn.onchange = () => { P.scenario = scn.value; buildPanel(); onParamsChanged(); resetCar(); fitView(); fitEgo(); };

  $("bReset").onclick = () => resetCar();
  $("bTrail").onclick = () => recStart();
  $("bFit").onclick = () => { fitView(); fitEgo(); };
  $("bDefaults").onclick = () => { setDefaults(); buildPanel(); applyViewMode(); onParamsChanged(); resetCar(); fitView(); fitEgo(); };
  $("toggle").onclick = () => $("panel").classList.toggle("open");

  $("bPlan").onclick = () => startPlan(planCallbacks);
  $("tPlan").onclick = () => startPlan(planCallbacks);
  $("bPlanCancel").onclick = () => cancelPlan(planCallbacks, "Cancelled.");

  $("tStart").onclick = () => { if (trk().length > 1) { TL.head = 0; TL.playing = false; } };
  $("tPlay").onclick = () => tlTogglePlay();
  $<HTMLSelectElement>("tRate").onchange = e => { const t = e.target as HTMLSelectElement; TL.rate = parseFloat(t.value); t.blur(); };
  const axis = $<HTMLSelectElement>("tAxis");
  axis.value = P.tlAxis;
  axis.onchange = () => {
    const g = TL.head !== null ? sampleAt(TL.head) : null;
    P.tlAxis = axis.value as Axis; save(); axis.blur();
    if (g) TL.head = xOf(g);
  };
  $("tCont").onclick = () => tlContinue();
  $("tLive").onclick = () => tlLive();
  $<HTMLSelectElement>("tTrack").onchange = e => { const t = e.target as HTMLSelectElement; setTrack(t.value as Track); t.blur(); };
  $("tCard").onclick = () => { TL.card = !TL.card; $("card").classList.toggle("open", TL.card); };
  $("tFold").onclick = e => {
    TL.collapsed = !TL.collapsed;
    $("timeline").classList.toggle("collapsed", TL.collapsed);
    (e.target as HTMLElement).textContent = TL.collapsed ? "▴" : "▾";
  };
}

/** Keep controls that the code can change in sync with the state. */
export function syncControls(): void {
  const tr = $<HTMLSelectElement>("tTrack");
  if (tr.value !== TL.track) tr.value = TL.track;
}

export function initControls(): void {
  initButtons();
  buildPanel();
  initKeyboard();
  attachPointer(topV); attachPointer(egoV);
}
