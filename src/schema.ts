/** Description of one editable parameter, used to build the settings panel. */
export interface NumberField { k: string; label: string; unit: string; v: number; step: number; type?: "number" }
export interface BoolField { k: string; label: string; v: boolean; type: "bool" }
export type Field = NumberField | BoolField;
export type ParamStore = Record<string, number | boolean | string>;

export function defaultsOf(schema: Field[]): ParamStore {
  const out: ParamStore = {};
  for (const f of schema) out[f.k] = f.v;
  return out;
}
