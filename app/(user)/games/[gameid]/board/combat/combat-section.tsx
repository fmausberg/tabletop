import type { BoardData } from "../board-model";
import { CombatPanel } from "./combat-panel";
import type { CombatData } from "./combat-model";

export function CombatSection({ data, boardData }: { data: CombatData; boardData?: BoardData }) {
  if (data.phase !== "COMBAT") return null;
  return <CombatPanel data={data} boardData={boardData} />;
}
