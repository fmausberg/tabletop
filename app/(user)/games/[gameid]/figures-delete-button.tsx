"use client";

import { useState, useTransition } from "react";
import { deleteFigure } from "./figures-actions";

export function FiguresDeleteButton({ gameId, figureId, name }: { gameId: string; figureId: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-label={`${name} löschen`}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        onClick={() => {
          if (!window.confirm(`${name} wirklich löschen?`)) return;
          setError(null);
          startTransition(async () => {
            try {
              const result = await deleteFigure(gameId, figureId);
              setError(result.error);
            } catch {
              setError("Die Figur konnte nicht gelöscht werden. Bitte versuche es erneut.");
            }
          });
        }}
      >{pending ? "Löschen…" : "Löschen"}</button>
      {error && <p role="alert" className="mt-2 max-w-xs whitespace-normal text-sm text-red-600">{error}</p>}
    </>
  );
}
