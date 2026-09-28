"use client";

import type { CombatCommand, CombatData, CombatEntry } from "./combat-model";

const inputClass = "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

export function CombatResultForm({ data, combat, correcting, onCommand, onCancel, cancelLabel = "Abbrechen" }: {
  data: CombatData;
  combat: CombatEntry;
  correcting: boolean;
  onCommand: (command: CombatCommand, success: string) => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const figures = data.figures.filter((figure) => combat.figureIds.includes(figure.id));
  const sides = data.participants.filter((participant) => figures.some((figure) => figure.participantId === participant.id));
  const validSides = sides.length === 2 && figures.length === combat.figureIds.length && figures.every((figure) => !figure.removed);

  return <form className="space-y-4 rounded-md border border-zinc-300 p-4 dark:border-zinc-700" onSubmit={(event) => {
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
    <h4 className="font-semibold">{correcting ? "Auswertung korrigieren" : "Nahkampf auswerten"}</h4>
    <p className="text-sm text-zinc-500">Nutze das Würfelpanel frei und trage das Ergebnis selbst ein. Für jede Figur werden die verbleibenden Lebenspunkte gespeichert.</p>
    {!validSides && <p className="text-sm text-amber-700 dark:text-amber-400">Zur Auswertung müssen verfügbare Figuren von genau zwei gegnerischen Spielern zugeordnet sein.</p>}
    <label className="block text-sm">Siegerseite
      <select name="winner" required defaultValue={combat.winnerParticipantId ?? ""} className={inputClass}>
        <option value="">Spieler auswählen</option>
        {sides.map((side) => <option key={side.id} value={side.id}>{side.name}</option>)}
      </select>
    </label>
    <div className="grid gap-3 sm:grid-cols-2">
      {figures.map((figure) => {
        const wound = combat.wounds.find((entry) => entry.figureId === figure.id);
        const before = correcting ? wound?.woundsBefore : figure.wounds;
        return <label key={figure.id} className="block text-sm">
          {figure.name} · {data.participants.find((entry) => entry.id === figure.participantId)?.name}
          <span className="block text-xs text-zinc-500">Vor Nahkampf: {before ?? "unbekannt"} LP · Verbleibende LP</span>
          <input className={inputClass} name={`wounds-${figure.id}`} type="number" min={0} max={before}
            step={1} required defaultValue={correcting ? wound?.woundsAfter ?? figure.wounds : figure.wounds} />
        </label>;
      })}
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={!validSides} className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {correcting ? "Korrektur speichern" : "Auswertung speichern"}
      </button>
      <button type="button" onClick={onCancel} className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">{cancelLabel}</button>
    </div>
  </form>;
}
