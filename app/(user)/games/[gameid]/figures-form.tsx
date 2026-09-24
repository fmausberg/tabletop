"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { Character } from "@/generated/prisma/client";
import { addFigure } from "./figures-actions";

type Props = {
  gameId: string;
  characters: Character[];
  players: { id: string; name: string }[];
};

const button = "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const input = "mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";
const attributes = [
  ["fightValueNear", "Nahkampf"], ["fightValueFar", "Fernkampf"],
  ["strength", "Stärke"], ["defense", "Verteidigung"],
  ["attacks", "Attacken"], ["wounds", "Wunden"], ["courage", "Mut"],
  ["baseDiameterCm", "Basisdurchmesser (cm)"], ["speedCm", "Geschwindigkeit (cm)"],
] as const;

export function FiguresForm({ gameId, characters, players }: Props) {
  const [open, setOpen] = useState(false);
  const [characterId, setCharacterId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const character = characters.find((entry) => entry.id === characterId);

  return (
    <div className="mb-4">
      <button className={button} disabled={pending || !characters.length || !players.length} onClick={() => { setOpen(true); setError(null); setMessage(""); }}>+ Figur hinzufügen</button>
      {!characters.length && <p className="mt-3 text-sm">Erstelle zuerst ein <Link href="/characters" className="underline">Charakterprofil</Link>.</p>}
      {!players.length && <p className="mt-3 text-sm">Erstelle zuerst einen <Link href="/user" className="underline">Benutzer</Link>.</p>}
      <p role="status" className="mt-3 text-sm text-zinc-500">{message}</p>
      {open && (
        <section aria-labelledby="figure-form-title" className="mt-4 rounded-lg border border-zinc-300 p-5 dark:border-zinc-700">
          <h3 id="figure-form-title" className="mb-4 text-xl font-semibold">Figur hinzufügen</h3>
          {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-red-800">{error}</p>}
          <form onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setError(null);
            startTransition(async () => {
              try {
                const result = await addFigure(gameId, form);
                if (result.error) setError(result.error);
                else {
                  setOpen(false);
                  setCharacterId("");
                  setMessage("Figur hinzugefügt. Die Profilwerte wurden übernommen.");
                }
              } catch {
                setError("Die Figur konnte nicht hinzugefügt werden. Bitte versuche es erneut.");
              }
            });
          }}>
            <fieldset disabled={pending}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">Charakterprofil
                  <select autoFocus className={input} name="characterId" required value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
                    <option value="" disabled>Charakterprofil auswählen</option>
                    {characters.map((entry) => <option className="bg-white text-zinc-900" key={entry.id} value={entry.id}>{entry.name}{entry.number === null ? "" : ` · Nr. ${entry.number}`}</option>)}
                  </select>
                </label>
                <label className="text-sm">Spieler
                  <select className={input} name="playerId" required defaultValue={players.length === 1 ? players[0].id : ""}>
                    <option value="" disabled>Spieler auswählen</option>
                    {players.map((player) => <option className="bg-white text-zinc-900" key={player.id} value={player.id}>{player.name}</option>)}
                  </select>
                </label>
              </div>
              {character && <div className="mt-5">
                <p className="mb-3 text-sm text-zinc-500">Diese Profilwerte werden beim Hinzufügen übernommen. Anfangs- und aktuelle Kampfwerte sind zunächst identisch.</p>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {attributes.map(([key, label]) => <div key={key}><dt className="text-sm text-zinc-500">{label}</dt><dd className="tabular-nums">{character[key] ?? "—"}</dd></div>)}
                </dl>
              </div>}
              <div className="mt-5 flex gap-2">
                <button className={button} type="submit">{pending ? "Speichern…" : "Figur hinzufügen"}</button>
                <button className={button} type="button" onClick={() => { setOpen(false); setError(null); setCharacterId(""); }}>Abbrechen</button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
    </div>
  );
}
