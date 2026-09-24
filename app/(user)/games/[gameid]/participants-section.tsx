"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addParticipant } from "./participants-actions";

type User = { id: string; name: string; email: string };
type Props = { gameId: string; users: User[]; participants: { id: string; user: User }[] };
const button = "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function ParticipantsSection({ gameId, users, participants }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const participantUserIds = new Set(participants.map((participant) => participant.user.id));
  const availableUsers = users.filter((user) => !participantUserIds.has(user.id));

  return (
    <section aria-labelledby="participants-title">
      <h2 id="participants-title" className="mb-4 text-xl font-semibold">Teilnehmer <span className="text-sm font-normal text-zinc-500">({participants.length})</span></h2>
      <div className="mb-4 rounded-lg border border-zinc-300 p-5 dark:border-zinc-700">
        {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-red-800">{error}</p>}
        {availableUsers.length ? <form key={availableUsers.map((user) => user.id).join(",")} onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setError(null);
          setMessage("");
          startTransition(async () => {
            try {
              const result = await addParticipant(gameId, form);
              if (result.error) setError(result.error);
              else setMessage("Teilnehmer hinzugefügt.");
            } catch {
              setError("Der Teilnehmer konnte nicht hinzugefügt werden. Bitte versuche es erneut.");
            }
          });
        }}>
          <fieldset disabled={pending} className="flex flex-wrap items-end gap-4">
            <label className="min-w-0 flex-1 text-sm">Benutzer
              <select name="userId" required defaultValue="" className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700">
                <option value="" disabled>Benutzer auswählen</option>
                {availableUsers.map((user) => <option className="bg-white text-zinc-900" key={user.id} value={user.id}>{user.name} ({user.email})</option>)}
              </select>
            </label>
            <button className={button} type="submit">{pending ? "Hinzufügen…" : "+ Teilnehmer hinzufügen"}</button>
          </fieldset>
        </form> : <p className="text-sm text-zinc-500">{users.length ? "Alle vorhandenen Benutzer nehmen bereits teil." : "Noch keine Benutzer vorhanden."}</p>}
        <Link href="/user" className="mt-3 inline-block text-sm underline underline-offset-4">Benutzer verwalten</Link>
        <p role="status" className="mt-3 text-sm text-zinc-500">{message}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Teilnehmer dieses Spiels</caption>
          <thead className="bg-zinc-100 dark:bg-zinc-900"><tr><th scope="col" className="p-3">Name</th><th scope="col" className="p-3">E-Mail</th></tr></thead>
          <tbody>
            {participants.map((participant) => <tr key={participant.id} className="border-t border-zinc-200 dark:border-zinc-800"><th scope="row" className="p-3 font-medium">{participant.user.name}</th><td className="p-3">{participant.user.email}</td></tr>)}
            {!participants.length && <tr><td colSpan={2} className="p-8 text-center text-zinc-500">Noch keine Teilnehmer in diesem Spiel.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
