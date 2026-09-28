"use client";

import { resetRound, undoLastMovement } from "./movement-reset-actions";

export type RunRoundAction = (
  action: () => Promise<{ error: string | null; message?: string }>,
  success: string,
  failure?: string,
) => void;

export function MovementControls({ gameId, round, pending, run }: {
  gameId: string; round: number; pending: boolean; run: RunRoundAction;
}) {
  return <div className="flex flex-wrap gap-2 lg:ml-auto">
    <button type="button" disabled={pending}
      className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      onClick={() => {
        if (!window.confirm("Letzten Zug dieser Runde rückgängig machen?")) return;
        run(() => undoLastMovement(gameId, round), "Letzter Zug rückgängig gemacht.");
      }}>Letzten Zug rückgängig machen</button>
    <button type="button" disabled={pending}
      className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
      onClick={() => {
        if (!window.confirm("Alle Bewegungen und Aktionen dieser Runde unwiderruflich zurücksetzen?")) return;
        run(async () => {
          const result = await resetRound(gameId, round);
          return result.error ? { error: result.error } : {
            error: null,
            message: `${result.movements} Bewegungen und ${result.actions} Aktionen zurückgesetzt.`,
          };
        }, "", "Die Runde konnte nicht zurückgesetzt werden. Bitte versuche es erneut.");
      }}>Reset All Moves in this round</button>
  </div>;
}
