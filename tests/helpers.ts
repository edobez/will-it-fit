import { deriveCar, type CarGeom, type CarParams } from "../src/core/vehicle";
import { CAR_SCHEMA } from "../src/params";
import { SCENARIOS, buildScene, type Scene } from "../src/scenes";
import { defaultsOf } from "../src/schema";

export function defaultCar(overrides: Partial<CarParams> = {}): CarGeom {
  const p = { ...(defaultsOf(CAR_SCHEMA) as unknown as CarParams), mirrorsFolded: false, ...overrides };
  return deriveCar(p).geom;
}

export function defaultScene(id: string, car: CarGeom = defaultCar()): Scene {
  return buildScene(id, defaultsOf(SCENARIOS[id].schema) as Record<string, number | boolean>, car);
}
