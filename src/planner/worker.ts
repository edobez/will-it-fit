/// <reference lib="webworker" />
import { plan } from "./search";
import type { PlanMessage, PlanRequest } from "./types";

const post = (m: PlanMessage) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = (e: MessageEvent<PlanRequest>) => {
  try { plan(e.data, post); }
  catch (err) { post({ type: "fail", reason: "Planner error: " + (err as Error).message }); }
};
