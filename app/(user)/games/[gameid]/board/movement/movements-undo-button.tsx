"use client";

import { useState, useTransition } from "react";
import { undoLastMovement } from "./movement-reset-actions";

export function MovementsUndoButton({ gameId, round, latestId }: { gameId: string; round: number; latestId: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  return (
    <div className="mb-4">
      <button type="button" disabled={pending || !latestId}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        onClick={() => {
          if (!latestId || !window.confirm("Letzten Zug rückgängig machen? Der oberste MovementStep wird gelöscht.")) return;
          setError(null);
          setMessage("");
          startTransition(async () => {
            try {
              const result = await undoLastMovement(gameId, round, latestId);
              if (result.error) setError(result.error);
              else setMessage("Letzter Zug rückgängig gemacht.");
            } catch {
              setError("Der letzte Zug konnte nicht rückgängig gemacht werden. Bitte versuche es erneut.");
            }
          });
        }}
      >{pending ? "Wird rückgängig gemacht…" : "Letzten Zug rückgängig machen"}</button>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <p role="status" className="mt-2 text-sm text-zinc-500">{message}</p>
    </div>
  );
}
