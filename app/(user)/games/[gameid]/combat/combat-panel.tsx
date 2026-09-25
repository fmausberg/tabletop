"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { manageCombat } from "./combat-actions";
import { CombatCard } from "./combat-card";
import { combatAssignmentKey, combatEvaluationIssue, type CombatCommand, type CombatData } from "./combat-model";
import { useBoardPositionPreview } from "../board/board-position-preview";
import { confirmCombatLayout, previewCombatLayout } from "./combat-layout-actions";
import type { CombatLayoutPreview } from "./combat-layout-model";

export function CombatPanel({ data }: { data: CombatData }) {
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [activity, setActivity] = useState("Speichern…");
  const router = useRouter();
  const assignmentKey = combatAssignmentKey(data);
  const issue = combatEvaluationIssue(data);
  const [evaluation, setEvaluation] = useState(() => ({ key: assignmentKey, active: false }));
  const evaluating = !issue && evaluation.key === assignmentKey && evaluation.active;
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
          setEvaluation({ key: assignmentKey, active: true });
          setMessage("Positionen bestätigt. Die Nahkämpfe können jetzt einzeln ausgewertet werden.");
        }
      } catch {
        setError("Die Bestätigung konnte nicht abgeschlossen werden. Bitte aktualisiere die Ansicht.");
        cancelPreview();
      } finally { saving.current = false; }
    });
  }

  function returnToAssignment() {
    setEvaluation({ key: assignmentKey, active: false });
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

  return <section className="mt-6 space-y-4" aria-labelledby="combat-panel-title" aria-busy={pending}>
    <h2 id="combat-panel-title" className="text-xl font-semibold">Nahkämpfe · Runde {data.round}</h2>
    <p className="font-medium">{evaluating ? "Auswertung: Nahkämpfe einzeln auswerten" : "Zuordnung der Nahkämpfe"}</p>
    <p className="text-sm text-zinc-500">Auch die während der Bewegung entstandenen Nahkämpfe sind hier enthalten. Jede Figur kann in dieser Runde höchstens einem Nahkampf zugeordnet werden. Eine Seite besteht aus den Figuren eines Spielers.</p>
    {plan && <div className="space-y-3 rounded-md border border-amber-400 p-4" role="region" aria-label="Entzerrung bestätigen">
      <p className="font-medium">Entzerrung als Vorschau auf dem Spielfeld</p>
      <p className="text-sm">{plan.minGapCm === null ? "Die Nahkampfgruppe liegt ohne Überschneidung mit Hindernissen auf dem Spielfeld." : plan.targetReached
        ? "Die Anordnung ist gültig; zwischen verschiedenen Nahkämpfen liegen mindestens 2 cm."
        : `Die Suche hat 2 cm nicht erreicht. Bester gefundener Mindestabstand: ${(Math.floor((plan.minGapCm ?? 0) * 1000) / 1000).toFixed(3)} cm. Die Gruppen überschneiden sich nicht.`}</p>
      <p className="text-sm text-zinc-500">Figuren desselben Nahkampfs bleiben zueinander unverändert. Erst die Bestätigung speichert die neuen Positionen.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900" onClick={confirmPreview}>Positionen bestätigen und auswerten</button>
        <button type="button" disabled={pending} className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700" onClick={cancelPreview}>Vorschau verwerfen</button>
      </div>
    </div>}
    <fieldset disabled={pending || Boolean(plan)} className="min-w-0 space-y-4">
      <legend className="sr-only">Nahkämpfe verwalten</legend>
      <div className="flex flex-wrap gap-2">
        {evaluating
          ? <button type="button" className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700" onClick={returnToAssignment}>Zurück zur Zuordnung</button>
          : <>
            <button type="button" className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
              onClick={() => run({ type: "create" }, "Offenen Nahkampf angelegt.")}>Nahkampf anlegen</button>
            <button type="button" disabled={Boolean(issue)} className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              onClick={prepareEvaluation}>Alle Nahkämpfe auswerten</button>
          </>}
        <button type="button" className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
          onClick={() => { setActivity("Ansicht wird aktualisiert…"); startTransition(() => router.refresh()); }}>Ansicht aktualisieren</button>
      </div>
      {!evaluating && issue && <p className="text-sm text-zinc-500">{issue}</p>}
      {!data.combats.length && <p className="text-sm text-zinc-500">In dieser Runde gibt es noch keine Nahkämpfe.</p>}
      {data.combats.map((combat, index) => <CombatCard key={`${combat.id}-${data.revision}-${evaluating}`} data={data} combat={combat} number={index + 1} evaluating={evaluating} onBackToAssignment={returnToAssignment} onCommand={run} />)}
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <p role="status" className="text-sm text-zinc-500">{pending ? activity : message}</p>
  </section>;
}
