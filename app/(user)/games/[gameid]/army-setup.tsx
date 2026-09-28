"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmArmySetup } from "./setup-actions";

export function ArmySetup({ gameId, participants, armies }: {
  gameId: string;
  participants: { id: string; userId: string; user: { name: string } }[];
  armies: { id: string; name: string; ownerId: string; _count: { figures: number } }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return <section aria-labelledby="army-setup-title">
    <h2 id="army-setup-title" className="mb-3 text-xl font-semibold">Armeen auswählen</h2>
    <form onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setError(null);
      startTransition(async () => {
        try {
          const result = await confirmArmySetup(gameId, form);
          if (result.error) setError(result.error);
          else router.push(`/games/${gameId}/board/placement`);
        } catch { setError("Die Vorbereitung konnte nicht gespeichert werden. Bitte versuche es erneut."); }
      });
    }}>
      <fieldset disabled={pending} className="space-y-3">
        {participants.map((participant) => {
          const available = armies.filter((army) => army.ownerId === participant.userId);
          return <div key={participant.id}>
            <label className="block text-sm">{participant.user.name}
              <select required name={`army-${participant.id}`} defaultValue="" className="mt-1 block w-full max-w-lg rounded border border-zinc-300 bg-transparent p-2 dark:border-zinc-700">
                <option value="" disabled>Armee auswählen</option>
                {available.map((army) => <option key={army.id} value={army.id} disabled={!army._count.figures} className="bg-white text-zinc-900">{army.name} · {army._count.figures} Figuren</option>)}
              </select>
            </label>
            {!available.some((army) => army._count.figures > 0) && <p className="mt-1 text-sm text-zinc-500">Für diesen Teilnehmer ist noch keine gefüllte Armee vorhanden. <Link href="/armies" className="underline">Armeen verwalten</Link></p>}
          </div>;
        })}
        {!participants.length && <p className="text-sm text-zinc-500">Füge zuerst die Teilnehmer hinzu.</p>}
        <p className="text-sm text-zinc-500">„Okay“ übernimmt alle Armeefiguren und startet die Aufstellung. Danach ist die Zusammenstellung für dieses Spiel festgelegt.</p>
        <button type="submit" disabled={!participants.length || participants.some((participant) => !armies.some((army) => army.ownerId === participant.userId && army._count.figures > 0))}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">{pending ? "Übernehmen…" : "Okay"}</button>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </form>
  </section>;
}
