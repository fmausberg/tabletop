"use client";

import { useState, useTransition } from "react";
import type { Character } from "@/generated/prisma/client";
import { deleteCharacter, saveCharacter } from "./actions";
import { numericFields, typeLabels } from "./fields";

const button = "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const input = "mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export function CharactersTable({ characters }: { characters: Character[] }) {
  const [editor, setEditor] = useState<Character | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = editor && editor !== "new" ? editor : null;

  function openEditor(character: Character | "new") {
    setError(null);
    setMessage("");
    setEditor(character);
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Characters</h1>
          <p className="mt-1 text-sm text-zinc-500">{characters.length} characters</p>
        </div>
        <button className={button} disabled={pending} onClick={() => openEditor("new")}>+ New character</button>
      </header>

      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-red-800">{error}</p>}
      <p role="status" className="mb-4 text-sm text-zinc-500">{message}</p>

      {editor && (
        <section aria-labelledby="editor-title" className="mb-6 rounded-lg border border-zinc-300 p-5 dark:border-zinc-700">
          <h2 id="editor-title" className="mb-4 text-xl font-semibold">{selected ? "Edit character" : "New character"}</h2>
          <form key={selected?.id ?? "new"} onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setError(null);
            startTransition(async () => {
              try {
                const result = await saveCharacter(selected?.id ?? null, form);
                if (result.error) setError(result.error);
                else {
                  setEditor(null);
                  setMessage(selected ? "Character updated." : "Character created.");
                }
              } catch {
                setError("Could not save your changes. Please try again.");
              }
            });
          }}>
            <fieldset disabled={pending}>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <label className="col-span-2 text-sm">Name<input autoFocus className={input} name="name" required defaultValue={selected?.name ?? ""} /></label>
                <label className="col-span-2 text-sm">Type
                  <select className={input} name="type" defaultValue={selected?.type ?? "WARRIOR"}>
                    {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value} className="bg-white text-zinc-900">{label}</option>)}
                  </select>
                </label>
                {numericFields.map((field) => (
                  <label key={field.name} className="text-sm">{field.label}{field.optional && <span className="text-zinc-500"> (optional)</span>}
                    <input className={input} type="number" name={field.name} step={field.decimal ? "any" : "1"} required={!field.optional} defaultValue={selected?.[field.name] ?? ""} />
                  </label>
                ))}
              </div>
              <div className="mt-5 flex gap-2">
                <button className={button} type="submit">{pending ? "Saving…" : "Save character"}</button>
                <button className={button} type="button" onClick={() => { setEditor(null); setError(null); }}>Cancel</button>
              </div>
            </fieldset>
          </form>
        </section>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <caption className="sr-only">Characters and their attributes</caption>
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th scope="col" className="p-3">Name</th>
              <th scope="col" className="p-3">Type</th>
              {numericFields.map((field) => <th scope="col" className="p-3" key={field.name}>{field.label}</th>)}
              <th scope="col" className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {characters.map((character) => (
              <tr key={character.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <th scope="row" className="p-3 font-medium">{character.name}</th>
                <td className="p-3">{typeLabels[character.type]}</td>
                {numericFields.map((field) => <td key={field.name} className="p-3 tabular-nums">{character[field.name] ?? "—"}</td>)}
                <td className="p-3">
                  <div className="flex gap-2">
                    <button className={button} disabled={pending} aria-label={`Edit ${character.name}`} onClick={() => openEditor(character)}>Edit</button>
                    <button className={`${button} text-red-600`} disabled={pending} aria-label={`Delete ${character.name}`} onClick={() => {
                      if (!window.confirm(`Delete ${character.name}?`)) return;
                      setError(null);
                      setMessage("");
                      startTransition(async () => {
                        try {
                          const result = await deleteCharacter(character.id);
                          if (result.error) setError(result.error);
                          else {
                            if (selected?.id === character.id) setEditor(null);
                            setMessage("Character deleted.");
                          }
                        } catch {
                          setError("Could not delete the character. Please try again.");
                        }
                      });
                    }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {characters.length === 0 && <tr><td colSpan={15} className="p-10 text-center text-zinc-500">No characters yet. Add your first character to get started.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
