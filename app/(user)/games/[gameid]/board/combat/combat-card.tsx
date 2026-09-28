"use client";

import { useState } from "react";
import { isCombatResolved, type CombatCommand, type CombatData, type CombatEntry } from "./combat-model";
import { CombatResultForm } from "./combat-result-form";
import { participantColor } from "../participant-color";
import { useBoardSelection } from "../board-selection";
import { CombatDragHandle } from "./combat-assignment-drag";

const buttonClass = "rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function CombatCard({ data, combat, number, evaluating, onCommand }: {
  data: CombatData;
  combat: CombatEntry;
  number: number;
  evaluating: boolean;
  onCommand: (command: CombatCommand, success: string) => void;
}) {
  const [showResult, setShowResult] = useState(false);
  const { selectedIds, selectMany } = useBoardSelection();
  const resolved = isCombatResolved(combat);
  const editingResult = evaluating && (showResult || !resolved);
  const figures = data.figures.filter((figure) => combat.figureIds.includes(figure.id));
  const sideIds = [...new Set(figures.map((figure) => figure.participantId))];
  const headingId = `combat-${combat.id}`;

  return <article aria-labelledby={headingId} className="space-y-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={headingId} className="text-sm font-semibold">
        <button type="button" onClick={() => selectMany(combat.figureIds)}
          title="Alle Figuren dieses Nahkampfs auswählen"
          className="rounded text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
          Nahkampf {number}
        </button>
      </h3>
      <div className="ml-auto flex items-center gap-2">
        <span className={resolved ? "text-sm font-medium text-green-700 dark:text-green-400" : "text-sm text-zinc-500"}>{resolved ? "Ausgewertet" : "Offen"}</span>
        {!resolved && !evaluating && <button type="button"
          aria-label={`Nahkampf ${number} löschen`} title="Nahkampf löschen"
          className="rounded p-1 text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
          onClick={() => {
            if (window.confirm("Diesen offenen Nahkampf löschen? Seine Figuren werden wieder frei zuordenbar.")) {
              onCommand({ type: "delete", combatId: combat.id }, "Nahkampf gelöscht.");
            }
          }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 10v7M14 10v7" />
          </svg>
        </button>}
      </div>
    </header>
    {resolved && <p className="text-sm">Siegerseite: <strong>{data.participants.find((entry) => entry.id === combat.winnerParticipantId)?.name ?? "Nicht gespeichert"}</strong></p>}
    {!resolved && sideIds.length !== 2 && <p className="text-sm text-zinc-500">Dieser offene Nahkampf hat {sideIds.length} Spieler-Seiten. Du kannst ihn weiter bearbeiten; zur Auswertung werden genau zwei benötigt.</p>}
    {!editingResult && <div className="grid gap-2 md:grid-cols-2">
      {sideIds.map((participantId) => <section key={participantId} aria-label={data.participants.find((entry) => entry.id === participantId)?.name ?? "Unbekannter Spieler"}>
        <ul className="space-y-1">
          {figures.filter((figure) => figure.participantId === participantId).map((figure) => {
            const participantIndex = data.participants.findIndex((entry) => entry.id === participantId);
            return <li key={figure.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2 py-1.5 ${selectedIds.has(figure.id) ? "ring-2 ring-inset ring-black" : ""}`}
              style={{ backgroundColor: participantIndex < 0 ? undefined : participantColor(participantIndex, 0.15) }}
              title={data.participants[participantIndex]?.name}>
              {!resolved && !evaluating
                ? <CombatDragHandle figureId={figure.id} name={figure.name} />
                : <p className="min-w-0 flex-1 break-words text-sm font-medium">{figure.name}{figure.removed ? " (entfernt)" : ""}</p>}

            </li>;
          })}
        </ul>
      </section>)}
    </div>}
    {!figures.length && <p className="text-sm text-zinc-500">Noch keine Figuren zugeordnet.</p>}
    {editingResult
      ? <CombatResultForm data={data} combat={combat} correcting={resolved} onCommand={onCommand} onCancel={resolved ? () => setShowResult(false) : undefined} />
      : evaluating && resolved && <button type="button" className={buttonClass} onClick={() => setShowResult(true)}>Auswertung korrigieren</button>}
    {resolved && <button type="button" className={`${buttonClass} ml-2`} onClick={() => {
      if (window.confirm("Auswertung zurücksetzen? Die Lebenspunkte vor diesem Nahkampf werden wiederhergestellt, seine Wundänderungen und der Sieger entfernt. Der Nahkampf wird wieder offen.")) {
        onCommand({ type: "reset", combatId: combat.id }, "Auswertung zurückgesetzt. Der Nahkampf ist wieder offen.");
      }
    }}>Auswertung zurücksetzen</button>}
  </article>;
}
