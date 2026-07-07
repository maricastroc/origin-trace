import { REGISTRY } from "./registry";
import { SNAPSHOTS } from "./snapshots.generated";
import type { Investigation } from "./types";

export type { Investigation, PhenomenonId } from "./types";
export { PHENOMENA, phenomenonById } from "./phenomena";

// Registry (editorial) ⋈ snapshots (engine output). A seed with no pinned
// snapshot is dropped rather than shown empty — run `npm run investigations:build`.
export const investigations: Investigation[] = REGISTRY.filter(
  (seed) => SNAPSHOTS[seed.slug],
).map((seed) => ({ ...seed, ...SNAPSHOTS[seed.slug] }));

export function investigationBySlug(slug: string): Investigation | undefined {
  return investigations.find((inv) => inv.slug === slug);
}
