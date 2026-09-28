"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { PhaseType } from "@/generated/prisma/enums";
import { nextPhaseInRound, phaseLabels, phasesForRound } from "./game-phases";
import { advanceRound, changePhase } from "./round-actions";
import { MovementControls, type RunRoundAction } from "./board/movement/movement-controls";

type Props = { gameId: string; round: number; phase: PhaseType; initiativeWinnerName: string | null; children?: ReactNode; readOnly?: boolean; phaseLocked?: boolean };

export function RoundControls({ gameId, round, phase, initiativeWinnerName, children, readOnly = false, phaseLocked = false }: Props) {
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
        <label className="flex items-center gap-1 whitespace-nowrap">Phase:
          {readOnly || phaseLocked ? <span>{phaseLabels[phase]}</span> : <select className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700" value={phase} disabled={pending} onChange={(event) => {
            const selected = event.target.value as PhaseType;
            run(async () => {
              const result = await changePhase(gameId, round, selected, phase);
              if (!result.error) router.push(`/games/${gameId}/board`);
              return result;
            }, "Phase gespeichert.");
          }}>
            {phasesForRound(round).map((value) => <option className="bg-white text-zinc-900" key={value} value={value}>{phaseLabels[value]}</option>)}
          </select>}
        </label>
        {!readOnly && <>
          <span aria-hidden="true" className="text-zinc-400">|</span>
          <button type="button" disabled={pending} className="rounded-md border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800" onClick={advance}>{phase === "INITIATIVE" ? "Initiative auswürfeln" : nextPhase ? "Nächste Phase" : "Nächste Runde"}</button>
        </>}
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
