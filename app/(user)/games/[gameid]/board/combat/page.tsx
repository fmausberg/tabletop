import { loadBoardData } from "../board-data";
import { BoardScreen } from "../board-screen";
import { BoardViewer } from "../board-viewer";
import { CombatSection } from "./combat-section";

export default async function Page({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const snapshot = await loadBoardData(gameid, "COMBAT");
  return (
    <BoardScreen snapshot={snapshot}>
      <BoardViewer data={snapshot.data} interaction="COMBAT" />
      {snapshot.combatData && <CombatSection data={snapshot.combatData} />}
    </BoardScreen>
  );
}
