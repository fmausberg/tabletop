"use client";

import { useState, useTransition } from "react";
import type { PhaseType } from "@/generated/prisma/enums";
import { phaseLabels, phasesForRound } from "../game-phases";
import { advanceRound, changePhase } from "../round-actions";
import { resetRound, undoLastRoundMovement } from "./movement-reset-actions";

type Props = { gameId: string; round: number; phase: PhaseType };

export function RoundControls({ gameId, round, phase }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function run(action: () => Promise<{ error: string | null }>, success: string) {
    setError(null);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else setMessage(success);
      } catch {
        setError("Der Spielstand konnte nicht gespeichert werden. Bitte versuche es erneut.");
      }
    });
  }

  function nextRound() {
    setError(null);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await advanceRound(gameId, round, phase);
        if (result.error) setError(result.error);
        else setMessage(result.initiativeWinnerName
          ? `${result.initiativeWinnerName} gewinnt die Initiative. Bewegungsphase gestartet.`
          : phase === "MOVEMENT" ? "Schussphase gestartet." : "Nächste Runde gestartet.");
      } catch {
        setError("Der Spielstand konnte nicht gespeichert werden. Bitte versuche es erneut.");
      }
    });
  }

  return (
    <section aria-label="Rundensteuerung" className="mb-5 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <div className="flex flex-wrap items-end gap-4">
        <div><p className="text-sm text-zinc-500">Aktuelle Runde</p><p className="text-2xl font-semibold tabular-nums" data-testid="current-round">{round}</p></div>
        <button type="button" disabled={pending} className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800" onClick={nextRound}>{phase === "INITIATIVE" ? "Initiative auswürfeln" : phase === "MOVEMENT" ? "Nächste Phase" : "Nächste Runde"}</button>
        <label className="text-sm">Aktuelle Phase
          <select className="mt-1 block rounded-md border border-zinc-300 bg-transparent px-3 py-2 disabled:opacity-50 dark:border-zinc-700" value={phase} disabled={pending} onChange={(event) => {
            const selected = event.target.value as PhaseType;
            run(() => changePhase(gameId, round, selected), "Phase gespeichert.");
          }}>
            {phasesForRound(round).map((value) => <option className="bg-white text-zinc-900" key={value} value={value}>{phaseLabels[value]} ({value})</option>)}
          </select>
        </label>
        {phase === "MOVEMENT" && <div className="flex flex-wrap gap-2 lg:ml-auto">
          <button type="button" disabled={pending}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={() => {
              if (!window.confirm("Letzten Zug dieser Runde rückgängig machen?")) return;
              run(() => undoLastRoundMovement(gameId, round), "Letzter Zug rückgängig gemacht.");
            }}>Letzten Zug rückgängig machen</button>
          <button type="button" disabled={pending}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            onClick={() => {
              if (!window.confirm("Alle Bewegungen und Aktionen dieser Runde unwiderruflich zurücksetzen?")) return;
              setError(null);
              setMessage("");
              startTransition(async () => {
                try {
                  const result = await resetRound(gameId, round);
                  if (result.error) setError(result.error);
                  else setMessage(`${result.movements} Bewegungen und ${result.actions} Aktionen zurückgesetzt.`);
                } catch {
                  setError("Die Runde konnte nicht zurückgesetzt werden. Bitte versuche es erneut.");
                }
              });
            }}>Reset All Moves in this round</button>
        </div>}
      </div>
      <p role="status" className="mt-2 text-sm text-zinc-500">{pending ? "Speichern…" : message}</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
