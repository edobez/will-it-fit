export const fmtM = (v: number): string => v >= 10 ? v.toFixed(1) + " m" : v.toFixed(2) + " m";

/** Steering angle as a driver would say it: straight, N% left/right, full lock. */
export function steerText(delta: number, dmax: number): string {
  const pct = Math.round(Math.abs(delta) / dmax * 100);
  if (pct < 5) return "straight";
  const side = delta > 0 ? "left" : "right";
  return pct >= 95 ? `full lock ${side}` : `${pct}% ${side}`;
}

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el as T;
};
