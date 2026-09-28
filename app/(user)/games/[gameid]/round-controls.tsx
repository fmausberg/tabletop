"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { PhaseType } from "@/generated/prisma/enums";
import { nextPhaseInRound, phaseLabels } from "./game-phases";
import { advanceRound } from "./round-actions";
import { updateCurrentPhase } from "./phase-actions";
import { MovementControls, type RunRoundAction } from "./board/movement/movement-controls";

type Props = { gameId: string; round: number; phase: PhaseType; initiativeWinnerName: string | null; children?: ReactNode; readOnly?: boolean;
  phaseControls?: { canGoBack: boolean; backReason: string | null; canReset: boolean; legacyCombat: boolean } | null };

export function RoundControls({ gameId, round, phase, initiativeWinnerName, children, readOnly = false, phaseControls }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const nextPhase = nextPhaseInRound(round, phase);

  const run: RunRoundAction = (action, success, failure = "Der Spielstand konnte nicht gespeichert werden. Bitte versuche es erneut.") => {
    setError(null);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else setMessage(result.message ?? success);
      } catch {
        setError(failure);
      }
    });
  };

  function advance() {
    setError(null);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await advanceRound(gameId, round, phase);
        if (result.error) setError(result.error);
        else if ("combatSummary" in result && result.combatSummary) {
          setMessage(`Nächste Runde gestartet. ${result.combatSummary.dead} tote Figuren entfernt, ${result.combatSummary.retreated} Figuren zurückgewichen.`);
        }
        else setMessage(result.initiativeWinnerName
          ? `${result.initiativeWinnerName} gewinnt die Initiative. Bewegungsphase gestartet.`
          : nextPhase === "SHOOTING" ? "Schussphase gestartet."
            : nextPhase === "COMBAT" ? "Nahkampfphase gestartet." : "Nächste Runde gestartet.");
        if (!result.error) router.push(`/games/${gameId}/board`);
      } catch {
        setError("Der Spielstand konnte nicht gespeichert werden. Bitte versuche es erneut.");
      }
    });
  }

  return (
    <section aria-label="Spiel und Rundensteuerung" className="mb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {children}
        <span className="whitespace-nowrap">Runde <span className="font-semibold tabular-nums" data-testid="current-round">{round}</span></span>
        <span aria-hidden="true" className="text-zinc-400">|</span>
        <span>Initiative: <span className="font-semibold">{initiativeWinnerName ?? "Noch nicht ausgewürfelt"}</span></span>
        <span aria-hidden="true" className="text-zinc-400">|</span>
        <span className="whitespace-nowrap">Phase: <span className="font-semibold">{phaseLabels[phase]}</span></span>
        {!readOnly && <>
          <span aria-hidden="true" className="text-zinc-400">|</span>
          <button type="button" disabled={pending} className="rounded-md border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800" onClick={advance}>{phase === "INITIATIVE" ? "Initiative auswürfeln" : nextPhase ? "Nächste Phase" : "Nächste Runde"}</button>
        </>}
        {!readOnly && phaseControls && <details className="relative">
          <summary className="cursor-pointer text-xs text-zinc-500">Phasenaktionen</summary>
          <div className="absolute right-0 top-full z-20 mt-2 w-72 space-y-2 rounded-lg border border-zinc-300 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <button type="button" disabled={pending || !phaseControls.canReset}
              className="w-full rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50 dark:text-red-400"
              onClick={() => {
                const message = phaseControls.legacyCombat
                  ? "Für diese ältere Nahkampfphase fehlt der Anfangsstand. Alle Nahkampfzuordnungen und Auswertungen dieser Runde sowie Verschiebungen der Nahkampfphase zurücksetzen? Lebenspunkte werden wiederhergestellt."
                  : "Alle Änderungen der aktuellen Phase zurücksetzen und ihren Anfangsstand wiederherstellen?";
                if (!window.confirm(message)) return;
                run(async () => {
                  const result = await updateCurrentPhase(gameId, round, phase, "reset");
                  if (!result.error) { router.push(`/games/${gameId}/board`); router.refresh(); }
                  return result;
                }, "Phase zurückgesetzt.");
              }}>Phase zurücksetzen</button>
            <button type="button" disabled={pending || !phaseControls.canGoBack}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
              onClick={() => run(async () => {
                const result = await updateCurrentPhase(gameId, round, phase, "back");
                if (!result.error) { router.push(`/games/${gameId}/board`); router.refresh(); }
                return result;
              }, "Vorherige Phase geöffnet.")}>Vorherige Phase</button>
            {phaseControls.backReason && <p className="text-xs text-zinc-500">{phaseControls.backReason}</p>}
          </div>
        </details>}
        {!readOnly && phase === "MOVEMENT" && <details className="relative ml-auto">
          <summary className="cursor-pointer text-xs text-zinc-500">Bewegungsaktionen</summary>
          <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg border border-zinc-300 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            <MovementControls gameId={gameId} round={round} pending={pending} run={run} />
          </div>
        </details>}
      </div>
      <p role="status" className={pending || message ? "mt-2 text-sm text-zinc-500" : "sr-only"}>{pending ? "Speichern…" : message}</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
