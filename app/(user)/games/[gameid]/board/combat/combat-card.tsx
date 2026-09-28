"use client";

import { useState } from "react";
import { isCombatResolved, type CombatCommand, type CombatData, type CombatEntry } from "./combat-model";
import { CombatResultForm } from "./combat-result-form";

const buttonClass = "rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const selectClass = "rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export function CombatCard({ data, combat, number, evaluating, onBackToAssignment, onCommand }: {
  data: CombatData;
  combat: CombatEntry;
  number: number;
  evaluating: boolean;
  onBackToAssignment: () => void;
  onCommand: (command: CombatCommand, success: string) => void;
}) {
  const [showResult, setShowResult] = useState(false);
  const [splitIds, setSplitIds] = useState<string[]>([]);
  const resolved = isCombatResolved(combat);
  const figures = data.figures.filter((figure) => combat.figureIds.includes(figure.id));
  const sideIds = [...new Set(figures.map((figure) => figure.participantId))];
  const available = data.figures.filter((figure) => !figure.removed && figure.participantGameId === data.gameId
    && !data.combats.some((entry) => entry.figureIds.includes(figure.id)));
  const headingId = `combat-${combat.id}`;

  return <article aria-labelledby={headingId} className="space-y-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h3 id={headingId} className="text-lg font-semibold">Nahkampf {number}</h3>
      <span className={resolved ? "text-sm font-medium text-green-700 dark:text-green-400" : "text-sm text-zinc-500"}>{resolved ? "Ausgewertet" : "Offen"}</span>
    </header>
    {resolved && <p className="text-sm">Siegerseite: <strong>{data.participants.find((entry) => entry.id === combat.winnerParticipantId)?.name ?? "Nicht gespeichert"}</strong></p>}
    {!resolved && sideIds.length !== 2 && <p className="text-sm text-zinc-500">Dieser offene Nahkampf hat {sideIds.length} Spieler-Seiten. Du kannst ihn weiter bearbeiten; zur Auswertung werden genau zwei benötigt.</p>}
    <div className="grid gap-4 md:grid-cols-2">
      {sideIds.map((participantId) => <section key={participantId} className="space-y-2">
        <h4 className="font-medium">Seite: {data.participants.find((entry) => entry.id === participantId)?.name ?? "Unbekannter Spieler"}</h4>
        <ul className="space-y-3">
          {figures.filter((figure) => figure.participantId === participantId).map((figure) => {
            const wound = combat.wounds.find((entry) => entry.figureId === figure.id);
            return <li key={figure.id} className="space-y-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
              <p className="text-sm font-medium">{figure.name}{figure.removed ? " (entfernt)" : ""}</p>
              <p className="text-xs text-zinc-500">{wound ? `Auswertung: ${wound.woundsBefore} → ${wound.woundsAfter} LP · ` : ""}Aktuell: {figure.wounds} LP</p>
              {!resolved && !evaluating && <>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={splitIds.includes(figure.id)} onChange={(event) => {
                    setSplitIds((ids) => event.target.checked ? [...ids, figure.id] : ids.filter((id) => id !== figure.id));
                  }} />Zum Aufteilen auswählen
                </label>
                <label className="block text-sm">Zuordnung
                  <select className={`${selectClass} mt-1 block w-full`} value={combat.id} onChange={(event) => {
                    onCommand({ type: "assign", figureId: figure.id, fromCombatId: combat.id, toCombatId: event.target.value || null }, "Figurenzuordnung gespeichert.");
                  }}>
                    <option value="">Aus Nahkampf entfernen</option>
                    {data.combats.map((entry, index) => !isCombatResolved(entry) && <option key={entry.id} value={entry.id}>Nahkampf {index + 1}</option>)}
                  </select>
                </label>
              </>}
            </li>;
          })}
        </ul>
      </section>)}
    </div>
    {!figures.length && <p className="text-sm text-zinc-500">Noch keine Figuren zugeordnet.</p>}
    {!resolved && !evaluating && <>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        const figureId = String(new FormData(event.currentTarget).get("figure") ?? "");
        if (figureId) onCommand({ type: "assign", figureId, fromCombatId: null, toCombatId: combat.id }, "Figur hinzugefügt.");
      }}>
        <label className="min-w-0 flex-1 text-sm">Freie Figur hinzufügen
          <select required name="figure" defaultValue="" className={`${selectClass} mt-1 block w-full`} disabled={!available.length}>
            <option value="">{available.length ? "Figur auswählen" : "Keine freien Figuren"}</option>
            {available.map((figure) => <option key={figure.id} value={figure.id}>{figure.name} · {data.participants.find((entry) => entry.id === figure.participantId)?.name}</option>)}
          </select>
        </label>
        <button type="submit" className={buttonClass} disabled={!available.length}>Hinzufügen</button>
      </form>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={!splitIds.length || splitIds.length >= combat.figureIds.length}
          onClick={() => onCommand({ type: "split", combatId: combat.id, figureIds: splitIds }, "Nahkampf aufgeteilt.")}>Auswahl in neuen Nahkampf aufteilen</button>
        <button type="button" className={buttonClass} onClick={() => {
          if (window.confirm("Diesen offenen Nahkampf löschen? Seine Figuren werden wieder frei zuordenbar.")) {
            onCommand({ type: "delete", combatId: combat.id }, "Nahkampf gelöscht.");
          }
        }}>Nahkampf löschen</button>
      </div>
    </>}
    {evaluating && (showResult || !resolved)
      ? <CombatResultForm data={data} combat={combat} correcting={resolved} onCommand={onCommand} onCancel={resolved ? () => setShowResult(false) : onBackToAssignment} cancelLabel={resolved ? "Abbrechen" : "Zurück zur Zuordnung"} />
      : evaluating && resolved && <button type="button" className={buttonClass} onClick={() => setShowResult(true)}>Auswertung korrigieren</button>}
    {resolved && <button type="button" className={`${buttonClass} ml-2`} onClick={() => {
      if (window.confirm("Auswertung zurücksetzen? Die Lebenspunkte vor diesem Nahkampf werden wiederhergestellt, seine Wundänderungen und der Sieger entfernt. Der Nahkampf wird wieder offen.")) {
        onCommand({ type: "reset", combatId: combat.id }, "Auswertung zurückgesetzt. Der Nahkampf ist wieder offen.");
      }
    }}>Auswertung zurücksetzen</button>}
  </article>;
}
