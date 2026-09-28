"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addArmyFigure, deleteArmyFigure } from "../actions";

const button = "rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const input = "mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export function ArmyFigures({ armyId, figures, characters }: {
  armyId: string;
  figures: { id: string; platoon: number; character: { name: string; points: number; short: string } }[];
  characters: { id: string; name: string; number: number | null; points: number }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  function run(action: () => Promise<{ error: string | null }>, success: string) {
    setError(null); setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else setMessage(success);
      } catch { setError("Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut."); }
    });
  }
  return <section aria-labelledby="army-figures-title" aria-busy={pending}>
    <h2 id="army-figures-title" className="mb-3 text-xl font-semibold">Figuren</h2>
    {characters.length ? <form className="mb-4" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      run(() => addArmyFigure(armyId, form), "Figur hinzugefügt.");
    }}>
      <fieldset disabled={pending} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 text-sm">Charakterprofil
          <select name="characterId" required defaultValue="" className={input}>
            <option value="" disabled>Charakter auswählen</option>
            {characters.map((character) => <option key={character.id} value={character.id} className="bg-white text-zinc-900">
              {character.name}{character.number === null ? "" : ` · Nr. ${character.number}`} · {character.points} Punkte
            </option>)}
          </select>
        </label>
        <label className="text-sm">Zugnummer
          <input name="platoon" type="number" min={0} max={2147483647} step={1} defaultValue={1} required className={`${input} max-w-32`} />
        </label>
        <button type="submit" className={button}>Figur hinzufügen</button>
      </fieldset>
    </form> : <p className="mb-4">Erstelle zuerst ein <Link href="/characters" className="underline">Charakterprofil</Link>.</p>}
    {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
    <p role="status" className="mb-3 text-sm text-zinc-500">{pending ? "Speichern…" : message}</p>
    <div className="overflow-x-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-900"><tr>
          <th className="p-3">Zug</th><th className="p-3">Charakter</th><th className="p-3">Kürzel</th><th className="p-3">Punkte</th><th className="p-3">Aktionen</th>
        </tr></thead>
        <tbody>{figures.map((figure) => <tr key={figure.id} className="border-t border-zinc-200 dark:border-zinc-800">
          <td className="p-3">{figure.platoon}</td><th scope="row" className="p-3 font-medium">{figure.character.name}</th>
          <td className="p-3">{figure.character.short}</td><td className="p-3">{figure.character.points}</td>
          <td className="p-3"><button type="button" className={`${button} text-red-600`} disabled={pending}
            aria-label={`${figure.character.name} aus Zug ${figure.platoon} entfernen`} onClick={() => {
              if (window.confirm(`${figure.character.name} aus der Armee entfernen?`)) run(() => deleteArmyFigure(armyId, figure.id), "Figur entfernt.");
            }}>Entfernen</button></td>
        </tr>)}</tbody>
      </table>
      {!figures.length && <p className="p-8 text-center text-sm text-zinc-500">Noch keine Figuren in dieser Armee.</p>}
    </div>
  </section>;
}
