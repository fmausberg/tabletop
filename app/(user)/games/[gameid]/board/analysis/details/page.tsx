import { loadBoardData } from "../../board-data";
import { BoardScreen } from "../../board-screen";

export default async function DetailsPage({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const snapshot = await loadBoardData(gameid);
  return <BoardScreen snapshot={snapshot} readOnly>
    <h2 className="mb-3 text-xl font-semibold">Details · aktueller Spielstand</h2>
    <p className="mb-3 text-sm text-zinc-500">Grundlage für weitere Datentabellen. Angezeigt werden die aktuell gespeicherten Figuren.</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr><th className="p-2">Figur</th><th className="p-2">Spieler</th><th className="p-2">Lebenspunkte</th><th className="p-2">Position (cm)</th><th className="p-2">Status</th></tr></thead>
      <tbody>{snapshot.data.figures.map((figure) => <tr key={figure.id} className="border-t border-zinc-300">
        <td className="p-2">{figure.name}</td>
        <td className="p-2">{snapshot.data.participants.find((player) => player.id === figure.participantId)?.name ?? "–"}</td>
        <td className="p-2">{figure.wounds}</td>
        <td className="p-2">{figure.position ? `${figure.position.x.toFixed(1)} / ${figure.position.y.toFixed(1)}` : "–"}</td>
        <td className="p-2">{figure.removed ? "Entfernt" : figure.position ? "Auf dem Spielfeld" : "Nicht platziert"}</td>
      </tr>)}</tbody>
    </table></div>
    {!snapshot.data.figures.length && <p>Noch keine Figuren vorhanden.</p>}
  </BoardScreen>;
}
