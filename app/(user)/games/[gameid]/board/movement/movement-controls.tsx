"use client";

import { undoLastMovement } from "./movement-reset-actions";

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

  </div>;
}
