"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { manageCombat } from "./combat-actions";
import { CombatCard } from "./combat-card";
import { CombatAssignmentDragProvider, CombatDragHandle, CombatDropZone, NEW_COMBAT } from "./combat-assignment-drag";
import { participantColor } from "../participant-color";
import { useBoardSelection } from "../board-selection";
import { BoardViewer } from "../board-viewer";
import type { BoardData } from "../board-model";
import { combatEvaluationIssue, isCombatResolved, type CombatCommand, type CombatData } from "./combat-model";
import { useBoardPositionPreview } from "../board-position-preview";
import { confirmCombatLayout, previewCombatLayout } from "./combat-layout-actions";
import type { CombatLayoutPreview } from "./combat-layout-model";

export function CombatPanel({ data, boardData }: { data: CombatData; boardData?: BoardData }) {
  const { selectedIds, selectedId } = useBoardSelection();
  const selectedCombat = data.combats.find((combat) => selectedId !== null && combat.figureIds.includes(selectedId));
  const available = data.figures.filter((figure) => !figure.removed && figure.participantGameId === data.gameId
    && !data.combats.some((combat) => combat.figureIds.includes(figure.id)));
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [activity, setActivity] = useState("Speichern…");
  const router = useRouter();
  const issue = combatEvaluationIssue(data);
  const evaluating = data.assignmentsLocked;
  const figureOutlineColors = evaluating ? Object.fromEntries(data.combats.flatMap((combat) =>
    combat.figureIds.map((id) => [id, isCombatResolved(combat) ? "#16a34a" : "#dc2626"]))) : {};
  const resolvedFigureIds = new Set(data.combats.filter(isCombatResolved).flatMap((combat) => combat.figureIds));
  const fadedFigureIds = evaluating
    ? data.figures.filter((figure) => figure.wounds <= 0 && resolvedFigureIds.has(figure.id)).map((figure) => figure.id)
    : [];
  const { preview, setPreview } = useBoardPositionPreview();
  const [layout, setLayout] = useState<CombatLayoutPreview | null>(null);
  const plan = layout?.revision === data.revision && preview?.id === layout.id ? layout : null;

  function cancelPreview() {
    setLayout(null);
    setPreview(null);
  }

  function prepareEvaluation() {
    if (saving.current) return;
    saving.current = true;
    setActivity("Entzerrung wird berechnet…");
    setError(null);
    setMessage("");
    cancelPreview();
    startTransition(async () => {
      try {
        const result = await previewCombatLayout(data.gameId, data.round, data.revision);
        if (result.error !== null) setError(result.error);
        else {
          setLayout(result.plan);
          setPreview({ id: result.plan.id, positions: result.plan.positions });
        }
      } catch {
        setError("Die Positionsvorschau konnte nicht berechnet werden. Es wurden keine Positionen geändert.");
      } finally { saving.current = false; }
    });
  }

  function confirmPreview() {
    if (!plan || saving.current) return;
    saving.current = true;
    setActivity("Positionen werden gespeichert…");
    setError(null);
    startTransition(async () => {
      try {
        const result = await confirmCombatLayout(data.gameId, data.round, plan.revision, plan.id);
        if (result.error) {
          setError(result.error);
          cancelPreview();
        } else {
          cancelPreview();
          router.replace(`/games/${data.gameId}/board/combat/execute`);
          setMessage("Positionen bestätigt. Die Nahkämpfe können jetzt einzeln ausgewertet werden.");
        }
      } catch {
        setError("Die Bestätigung konnte nicht abgeschlossen werden. Bitte aktualisiere die Ansicht.");
        cancelPreview();
      } finally { saving.current = false; }
    });
  }

  function run(command: CombatCommand, success: string) {
    if (saving.current) return;
    saving.current = true;
    setActivity("Speichern…");
    setError(null);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await manageCombat(data.gameId, data.round, data.revision, command);
        if (result.error) setError(result.error);
        else setMessage(success);
      } catch {
        setError("Der Nahkampf konnte nicht gespeichert werden. Bitte versuche es erneut.");
      } finally {
        saving.current = false;
      }
    });
  }

  const panel = <section className={boardData ? "space-y-3" : "mt-6 space-y-4"} aria-labelledby="combat-panel-title" aria-busy={pending}>
    <h2 id="combat-panel-title" className="text-xl font-semibold">Nahkämpfe · Runde {data.round}</h2>
    {evaluating && <p className="font-medium">Auswertung: Nahkämpfe einzeln auswerten</p>}
    {plan && <div className="space-y-3 rounded-md border border-amber-400 p-4" role="region" aria-label="Entzerrung bestätigen">
      <p className="font-medium">Entzerrung als Vorschau auf dem Spielfeld</p>
      <p className="text-sm">{plan.minGapCm === null ? "Die Nahkampfgruppe liegt ohne Überschneidung mit Hindernissen auf dem Spielfeld." : plan.targetReached
        ? "Die Anordnung ist gültig; zwischen verschiedenen Nahkämpfen liegen mindestens 2 cm."
        : `Die Suche hat 2 cm nicht erreicht. Bester gefundener Mindestabstand: ${(Math.floor((plan.minGapCm ?? 0) * 1000) / 1000).toFixed(3)} cm. Die Gruppen überschneiden sich nicht.`}</p>
      <p className="text-sm text-zinc-500">Die Bestätigung speichert die Positionen und schließt die Zuteilung für diese Runde endgültig ab. Anschließend können nur noch Ergebnisse ausgewertet oder korrigiert werden.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900" onClick={confirmPreview}>Positionen bestätigen und auswerten</button>
        <button type="button" disabled={pending} className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700" onClick={cancelPreview}>Vorschau verwerfen</button>
      </div>
    </div>}
    <fieldset disabled={pending || Boolean(plan)} className="min-w-0 space-y-4">
      <legend className="sr-only">Nahkämpfe verwalten</legend>

      {!evaluating && <button type="button" disabled={Boolean(issue)} className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        onClick={prepareEvaluation}>Nahkampfzuteilung speichern</button>}
      {!evaluating && issue && <p className="text-sm text-zinc-500">{issue}</p>}
      {!data.combats.length && <p className="text-sm text-zinc-500">In dieser Runde gibt es noch keine Nahkämpfe.</p>}
      {!evaluating && <CombatDropZone combatId={null}>
        <section aria-label="Freie Figuren" className="space-y-2 rounded-lg border border-dashed border-zinc-400 p-2">
          <h3 className="text-sm font-semibold">Freie Figuren ({available.length})</h3>
          <ul className="grid gap-1 sm:grid-cols-2">
            {available.map((figure) => <li key={figure.id} className={`flex items-center gap-2 rounded px-2 py-1 ${selectedIds.has(figure.id) ? "ring-2 ring-inset ring-black" : ""}`}
              style={{ backgroundColor: participantColor(data.participants.findIndex((entry) => entry.id === figure.participantId), 0.15) }}>
              <CombatDragHandle figureId={figure.id} name={figure.name} />
            </li>)}
          </ul>
          {!available.length && <p className="text-xs text-zinc-500">Figur hier ablegen, um sie aus einem Nahkampf zu entfernen.</p>}
        </section>
      </CombatDropZone>}
      {evaluating && !selectedCombat && <p role="status" className="text-sm text-zinc-500">Wähle auf dem Spielfeld eine Figur eines Nahkampfs aus, um diesen hier auszuwerten.</p>}
      {data.combats.map((combat, index) => (!evaluating || combat.id === selectedCombat?.id) && <CombatDropZone key={combat.id} combatId={combat.id}>
        <CombatCard key={`${combat.id}-${data.revision}-${evaluating}`} data={data} combat={combat} number={index + 1} evaluating={evaluating} onCommand={run} />
      </CombatDropZone>)}
      {!evaluating && <CombatDropZone combatId={NEW_COMBAT}>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-100/60 px-3 py-5 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
          <h3 className="text-sm font-medium">Neuer Nahkampf</h3>
          <p className="mt-1 text-xs">Figur hier ablegen</p>
        </div>
      </CombatDropZone>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <p role="status" className="text-sm text-zinc-500">{pending ? activity : message}</p>
  </section>;

  return <CombatAssignmentDragProvider data={data} disabled={pending || Boolean(plan) || evaluating} onCommand={run}>
    {boardData && <BoardViewer data={boardData} interaction="COMBAT" showDice={evaluating}
      fadedFigureIds={fadedFigureIds}
      figureOutlineColors={figureOutlineColors}
      sidebar={panel} />}
    {!boardData && panel}
  </CombatAssignmentDragProvider>;
}
