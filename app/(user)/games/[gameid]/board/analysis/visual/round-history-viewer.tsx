"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BoardViewer } from "../../board-viewer";
import { BoardSelectionProvider } from "../../board-selection";
import type { loadRoundHistory } from "./history-data";

export function RoundHistoryViewer({ history }: { history: Awaited<ReturnType<typeof loadRoundHistory>> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [detailed, setDetailed] = useState(false);
  const ongoing = history.selectedRound === history.currentRound;
  // Keep the canvas mounted when history filters change so its camera survives.
  return <BoardSelectionProvider key={history.data.gameId} figureIds={history.data.figures.map((figure) => figure.id)}>
    <BoardViewer data={history.data} interaction="READ_ONLY" showDice={false} fadedFigureIds={history.fadedFigureIds}
      movementTrails={detailed ? history.movementTrails : history.roundMovementTrails}
      sidebar={<section className="space-y-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700" aria-busy={pending}>
        <h2 className="font-semibold">Rundenverlauf</h2>
        {(["from", "to"] as const).map((boundary) => <label key={boundary} className="flex items-center gap-2 text-sm">
          <span className="w-20">{boundary === "from" ? "Von Runde" : "Bis Runde"}</span>
          <select className="min-w-0 flex-1 rounded border border-zinc-300 bg-transparent p-1 dark:border-zinc-700"
            value={boundary === "from" ? history.fromRound : history.selectedRound} disabled={pending} onChange={(event) => {
              const round = Number(event.target.value);
              const from = boundary === "from" ? round : Math.min(history.fromRound, round);
              const to = boundary === "to" ? round : Math.max(history.selectedRound, round);
              startTransition(() => router.replace(`/games/${history.data.gameId}/board/analysis/visual?from=${from}&to=${to}`, { scroll: false }));
            }}>
            {history.rounds.map((round) => <option key={round} value={round} className="bg-white text-zinc-900">
              {round === 0 ? "Aufstellung (Runde 0)" : `Runde ${round}`}{round === history.currentRound ? " · laufend" : " · abgeschlossen"}
            </option>)}
          </select>
        </label>)}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={detailed} onChange={(event) => setDetailed(event.target.checked)} />
          Detailliert
        </label>
        <p className="text-sm">{history.fromRound === history.selectedRound ? `Bewegungen aus Runde ${history.fromRound}.` : `Bewegungen von Runde ${history.fromRound} bis ${history.selectedRound}.`}</p>
        <p className="text-sm">{ongoing ? "Aktuell gespeicherter Zwischenstand – diese Runde ist noch nicht abgeschlossen." : `Stand am Ende von Runde ${history.selectedRound}.`}</p>
        <p className="text-sm">Initiative: {history.initiativeWinnerName ?? "Nicht ausgewürfelt"}</p>
        <p className="text-xs text-zinc-500">Dünne Linien in Spielerfarben zeigen die Bewegungen im gewählten Zeitraum. Darin getötete Figuren bleiben matt am Todesort sichtbar. Überlebende stehen an ihrer Position am Ende des Zeitraums. Diese Ansicht verändert den Spielstand nicht.</p>
        <p role="status" className="text-sm text-zinc-500">{pending ? "Rundenstand wird geladen…" : ""}</p>
      </section>} />
  </BoardSelectionProvider>;
}
