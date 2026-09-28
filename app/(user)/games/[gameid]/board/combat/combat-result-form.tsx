"use client";

import type { CombatCommand, CombatData, CombatEntry } from "./combat-model";
import { participantColor } from "../participant-color";
import { useBoardSelection } from "../board-selection";

const inputClass = "min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export function CombatResultForm({ data, combat, correcting, onCommand, onCancel, cancelLabel = "Abbrechen" }: {
  data: CombatData;
  combat: CombatEntry;
  correcting: boolean;
  onCommand: (command: CombatCommand, success: string) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const { selectedIds } = useBoardSelection();
  const figures = data.figures.filter((figure) => combat.figureIds.includes(figure.id));
  const sides = data.participants.filter((participant) => figures.some((figure) => figure.participantId === participant.id));
  const validSides = sides.length === 2 && figures.length === combat.figureIds.length && figures.every((figure) => !figure.removed);

  return <form className="space-y-3" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (correcting && !window.confirm("Auswertung korrigieren? Sieger und verbleibende Lebenspunkte werden ersetzt; die ursprünglichen Lebenspunkte vor dem Nahkampf bleiben erhalten.")) return;
    onCommand({
      type: correcting ? "correct" : "resolve",
      combatId: combat.id,
      winnerParticipantId: String(form.get("winner") ?? ""),
      wounds: figures.map((figure) => ({ figureId: figure.id, woundsAfter: Number(form.get(`wounds-${figure.id}`)) })),
    }, correcting ? "Auswertung korrigiert." : "Nahkampf ausgewertet.");
  }}>
    {correcting && <h4 className="text-sm font-semibold">Auswertung korrigieren</h4>}

    {!validSides && <p className="text-sm text-amber-700 dark:text-amber-400">Zur Auswertung müssen verfügbare Figuren von genau zwei gegnerischen Spielern zugeordnet sein.</p>}
    <label className="flex items-center gap-2 text-sm">Siegerseite
      <select name="winner" required defaultValue={combat.winnerParticipantId ?? ""} className={`${inputClass} flex-1`}>
        <option value="">Spieler auswählen</option>
        {sides.map((side) => <option key={side.id} value={side.id}>{side.name}</option>)}
      </select>
    </label>
    <div className="grid grid-cols-2 gap-2">
      {sides.map((side) => <section key={side.id} aria-label={side.name} className="min-w-0 space-y-1.5">
      {figures.filter((figure) => figure.participantId === side.id).map((figure) => {
        const wound = combat.wounds.find((entry) => entry.figureId === figure.id);
        const before = correcting ? wound?.woundsBefore : figure.wounds;
        const participantIndex = data.participants.findIndex((entry) => entry.id === figure.participantId);
        return <label key={figure.id} className={`block rounded-md px-2 py-1.5 text-sm ${selectedIds.has(figure.id) ? "ring-2 ring-inset ring-black" : ""}`}
          style={{ backgroundColor: participantIndex < 0 ? undefined : participantColor(participantIndex, 0.15) }}>
          <span className="block break-words font-medium">{figure.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-xs text-zinc-500">LP ({before ?? "unbekannt"}):</span>
          <input className={`${inputClass} w-14`} name={`wounds-${figure.id}`} type="number" min={0} max={before}
            step={1} required defaultValue={correcting ? wound?.woundsAfter ?? figure.wounds : figure.wounds} />
          </span>
        </label>;
      })}
      </section>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={!validSides} className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {correcting ? "Korrektur speichern" : "Auswertung speichern"}
      </button>
      {onCancel && <button type="button" onClick={onCancel} className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">{cancelLabel}</button>}
    </div>
  </form>;
}
