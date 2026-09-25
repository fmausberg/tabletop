"use client";

import { useState, useTransition } from "react";
import type { PhaseType } from "@/generated/prisma/enums";
import { nextPhaseInRound, phaseLabels, phasesForRound } from "./game-phases";
import { advanceRound, changePhase } from "./round-actions";
import { MovementControls, type RunRoundAction } from "./movement/movement-controls";

type Props = { gameId: string; round: number; phase: PhaseType };

export function RoundControls({ gameId, round, phase }: Props) {
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
        else setMessage(result.initiativeWinnerName
          ? `${result.initiativeWinnerName} gewinnt die Initiative. Bewegungsphase gestartet.`
          : nextPhase === "SHOOTING" ? "Schussphase gestartet."
            : nextPhase === "COMBAT" ? "Nahkampfphase gestartet." : "Nächste Runde gestartet.");
      } catch {
        setError("Der Spielstand konnte nicht gespeichert werden. Bitte versuche es erneut.");
      }
    });
  }

  return (
    <section aria-label="Rundensteuerung" className="mb-5 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <div className="flex flex-wrap items-end gap-4">
        <div><p className="text-sm text-zinc-500">Aktuelle Runde</p><p className="text-2xl font-semibold tabular-nums" data-testid="current-round">{round}</p></div>
        <button type="button" disabled={pending} className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800" onClick={advance}>{phase === "INITIATIVE" ? "Initiative auswürfeln" : nextPhase ? "Nächste Phase" : "Nächste Runde"}</button>
        <label className="text-sm">Aktuelle Phase
          <select className="mt-1 block rounded-md border border-zinc-300 bg-transparent px-3 py-2 disabled:opacity-50 dark:border-zinc-700" value={phase} disabled={pending} onChange={(event) => {
            const selected = event.target.value as PhaseType;
            run(() => changePhase(gameId, round, selected), "Phase gespeichert.");
          }}>
            {phasesForRound(round).map((value) => <option className="bg-white text-zinc-900" key={value} value={value}>{phaseLabels[value]} ({value})</option>)}
          </select>
        </label>
        {phase === "MOVEMENT" && <MovementControls gameId={gameId} round={round} pending={pending} run={run} />}
      </div>
      <p role="status" className="mt-2 text-sm text-zinc-500">{pending ? "Speichern…" : message}</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
