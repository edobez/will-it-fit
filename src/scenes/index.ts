import type { Field } from "../schema";
import { buildBays, buildGarage, buildParallelStreet, buildParallelUnderground, finalize } from "./builders";
import type { ScenarioDef, ScenarioParams, Scene } from "./types";
import type { CarGeom } from "../core/vehicle";

export type { Scene, Target, ScenarioDef, ScenarioParams } from "./types";

const PARKED: Field[] = [
  { k: "parkedLength", label: "Parked car length", unit: "m", v: 4.6, step: 0.05 },
  { k: "parkedWidth", label: "Parked car width", unit: "m", v: 1.85, step: 0.01 },
];

export const SCENARIOS: Record<string, ScenarioDef> = {
  garage: {
    name: "Garage off a tunnel",
    schema: [
      { k: "tunnelWidth", label: "Tunnel width", unit: "m", v: 5.5, step: 0.05 },
      { k: "tunnelLength", label: "Tunnel length shown", unit: "m", v: 30, step: 1 },
      { k: "wallThickness", label: "Wall thickness at door", unit: "m", v: 0.25, step: 0.01 },
      { k: "garageX", label: "Garage position along tunnel", unit: "m", v: 15, step: 0.1 },
      { k: "garageWidth", label: "Garage inner width", unit: "m", v: 2.7, step: 0.01 },
      { k: "garageDepth", label: "Garage inner depth", unit: "m", v: 5.5, step: 0.01 },
      { k: "doorWidth", label: "Door opening width", unit: "m", v: 2.4, step: 0.01 },
      { k: "doorOffset", label: "Door offset from left inner wall", unit: "m", v: 0.15, step: 0.01 },
    ],
    build: buildGarage,
  },
  parallelStreet: {
    name: "Parallel parking, street",
    schema: [
      { k: "roadWidth", label: "Driving width of the road", unit: "m", v: 6.0, step: 0.05 },
      { k: "slotLength", label: "Gap between parked cars", unit: "m", v: 6.0, step: 0.05 },
      { k: "slotDepth", label: "Parking lane width", unit: "m", v: 2.1, step: 0.05 },
      { k: "curbGap", label: "Parked cars' distance from curb", unit: "m", v: 0.2, step: 0.05 },
      ...PARKED,
    ],
    build: buildParallelStreet,
  },
  parallelUnderground: {
    name: "Parallel parking, underground",
    schema: [
      { k: "aisleWidth", label: "Aisle width", unit: "m", v: 3.5, step: 0.05 },
      { k: "slotLength", label: "Slot length", unit: "m", v: 5.6, step: 0.05 },
      { k: "slotDepth", label: "Slot depth", unit: "m", v: 2.3, step: 0.05 },
      { k: "pillarSize", label: "Pillar size at slot ends (0 = none)", unit: "m", v: 0.5, step: 0.05 },
      { k: "neighborCars", label: "Cars in neighboring slots", type: "bool", v: true },
      ...PARKED,
    ],
    build: buildParallelUnderground,
  },
  bays90: {
    name: "Perpendicular bays (90°)",
    schema: [
      { k: "angle", label: "Bay angle to aisle", unit: "°", v: 90, step: 1 },
      { k: "aisleWidth", label: "Aisle width", unit: "m", v: 6.0, step: 0.05 },
      { k: "bayWidth", label: "Bay width", unit: "m", v: 2.5, step: 0.01 },
      { k: "bayDepth", label: "Bay depth (perpendicular to aisle)", unit: "m", v: 5.0, step: 0.05 },
      { k: "pillarSize", label: "Pillars beside the bay (0 = none)", unit: "m", v: 0, step: 0.05 },
      { k: "pillarInset", label: "Pillar distance from aisle", unit: "m", v: 0.8, step: 0.05 },
      { k: "neighborCars", label: "Cars in neighboring bays", type: "bool", v: true },
      ...PARKED,
    ],
    build: buildBays,
  },
  bays45: {
    name: "Angled bays (45°)",
    schema: [
      { k: "angle", label: "Bay angle to aisle", unit: "°", v: 45, step: 1 },
      { k: "aisleWidth", label: "Aisle width", unit: "m", v: 3.8, step: 0.05 },
      { k: "bayWidth", label: "Bay width", unit: "m", v: 2.5, step: 0.01 },
      { k: "bayDepth", label: "Bay depth (perpendicular to aisle)", unit: "m", v: 5.0, step: 0.05 },
      { k: "pillarSize", label: "Pillars beside the bay (0 = none)", unit: "m", v: 0, step: 0.05 },
      { k: "pillarInset", label: "Pillar distance from aisle", unit: "m", v: 0.8, step: 0.05 },
      { k: "neighborCars", label: "Cars in neighboring bays", type: "bool", v: true },
      ...PARKED,
    ],
    build: buildBays,
  },
};

export function buildScene(id: string, sp: ScenarioParams, car: CarGeom): Scene {
  return finalize(SCENARIOS[id].build(sp, car));
}
