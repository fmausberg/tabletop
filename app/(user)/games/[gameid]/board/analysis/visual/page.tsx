import { loadBoardData } from "../../board-data";
import { BoardScreen } from "../../board-screen";
import { BoardViewer } from "../../board-viewer";

export default async function VisualPage({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const snapshot = await loadBoardData(gameid);
  return <BoardScreen snapshot={snapshot} readOnly>
    <h2 className="mb-3 text-xl font-semibold">Visuelle Analyse · Vorschau</h2>
    <p className="mb-4 text-sm text-zinc-500">Die historische Spielwiedergabe ist noch nicht implementiert. Das Spielfeld zeigt ausschließlich den aktuellen gespeicherten Stand ohne Bearbeitung.</p>
    <BoardViewer data={snapshot.data} interaction="READ_ONLY" />
  </BoardScreen>;
}
