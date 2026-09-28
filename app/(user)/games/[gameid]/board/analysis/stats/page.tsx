import { loadBoardData } from "../../board-data";
import { BoardScreen } from "../../board-screen";

export default async function StatsPage({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const snapshot = await loadBoardData(gameid);
  return <BoardScreen snapshot={snapshot} readOnly>
    <h2 className="mb-3 text-xl font-semibold">Statistiken · in Vorbereitung</h2>
    <p className="text-sm text-zinc-500">Für diese Ansicht sind noch keine statistischen Auswertungen implementiert.</p>
  </BoardScreen>;
}
