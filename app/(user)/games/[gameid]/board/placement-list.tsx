import type { BoardData } from "./board-model";

type Props = { data: BoardData; selectedId: string | null; pending: boolean; onSelect: (id: string) => void };

export function PlacementList({ data, selectedId, pending, onSelect }: Props) {
  const figures = data.figures.filter((figure) => !figure.removed);
  return (
    <section aria-labelledby="placement-title">
      <h2 id="placement-title" className="mb-2 font-semibold">Figuren aufstellen</h2>
      <p className="mb-3 text-sm text-zinc-500">Figur auswählen, dann per Rechtsklick aufstellen. Der Klickpunkt ist die Mitte der Base.</p>
      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {figures.map((figure) => {
          const participant = data.participants.find((player) => player.id === figure.participantId);
          return <li key={figure.id}><button
            type="button" disabled={pending} aria-pressed={selectedId === figure.id}
            className="w-full rounded-md border border-zinc-300 p-2 text-left text-sm hover:bg-zinc-100 aria-pressed:border-blue-500 aria-pressed:ring-1 aria-pressed:ring-blue-500 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={() => onSelect(figure.id)}
          >
            <span className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: participant?.color }} />{figure.name}</span>
            <span className="mt-1 block text-xs text-zinc-500">{participant?.name} · {figure.position ? "Platziert" : "Noch nicht platziert"}</span>
          </button></li>;
        })}
      </ul>
      {!figures.length && <p className="text-sm text-zinc-500">Noch keine Figuren im Spiel.</p>}
    </section>
  );
}
