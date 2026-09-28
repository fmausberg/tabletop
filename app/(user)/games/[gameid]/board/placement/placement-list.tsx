import type { BoardData } from "../board-model";
import { participantColor } from "../participant-color";

type Props = { data: BoardData; selectedId: string | null; pending: boolean; onSelect: (id: string) => void };

export function PlacementList({ data, selectedId, pending, onSelect }: Props) {
  const figures = data.figures.filter((figure) => !figure.removed);
  return (
    <section aria-labelledby="placement-title">
      <h2 id="placement-title" className="mb-2 font-semibold">Figuren aufstellen</h2>
      <p className="mb-3 text-sm text-zinc-500">Figur auswählen, dann per Rechtsklick aufstellen. Der Klickpunkt ist die Mitte der Base.</p>
      <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
        {data.participants.map((participant, index) => (
          <ul key={participant.id} aria-label={`Figuren von ${participant.name}`} className="min-w-0 space-y-2">
            {figures.filter((figure) => figure.participantId === participant.id).map((figure) => <li key={figure.id}><button
            type="button" disabled={pending} aria-pressed={selectedId === figure.id}
            aria-label={`${figure.name}, ${participant.name}, ${figure.position ? "Platziert" : "Noch nicht platziert"}`}
            title={figure.position ? "Platziert" : "Noch nicht platziert"}
            style={{ backgroundColor: participantColor(index, figure.position ? 0.07 : 0.25) }}
            className="w-full break-words rounded-md border border-transparent p-2 text-left text-sm hover:border-zinc-400 aria-pressed:border-black aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-black disabled:opacity-50"
            onClick={() => onSelect(figure.id)}
          >
            {figure.name}
          </button></li>)}
          </ul>
        ))}
      </div>
      {!figures.length && <p className="text-sm text-zinc-500">Noch keine Figuren im Spiel.</p>}
    </section>
  );
}
