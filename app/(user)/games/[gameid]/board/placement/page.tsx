import { loadBoardData } from "../board-data";
import { BoardScreen } from "../board-screen";
import { BoardViewer } from "../board-viewer";

export default async function Page({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const snapshot = await loadBoardData(gameid, "PLACEMENT");
  return (
    <BoardScreen snapshot={snapshot}>
      <BoardViewer data={snapshot.data} interaction="PLACEMENT" showDice={false} />
    </BoardScreen>
  );
}
