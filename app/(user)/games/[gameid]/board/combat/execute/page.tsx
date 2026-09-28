import { redirect } from "next/navigation";
import { loadBoardData } from "../../board-data";
import { BoardScreen } from "../../board-screen";
import { CombatSection } from "../combat-section";

export default async function Page({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const snapshot = await loadBoardData(gameid, "COMBAT");
  if (!snapshot.combatData?.assignmentsLocked) redirect(`/games/${gameid}/board/combat/assign`);
  return <BoardScreen snapshot={snapshot}>
    {snapshot.combatData && <CombatSection data={snapshot.combatData} boardData={snapshot.data} />}
  </BoardScreen>;
}
