import { CombatPanel } from "./combat-panel";
import type { CombatData } from "./combat-model";

export function CombatSection({ data }: { data: CombatData }) {
  if (data.phase !== "COMBAT") return null;
  return <CombatPanel data={data} />;
}
