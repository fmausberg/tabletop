"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

type Row = { id: string; name: string; locked?: boolean; [key: string]: string | number | boolean | null | undefined };
type Field = { name: string; label: string; type?: "number" | "email" | "select"; optional?: boolean; step?: string; min?: number; options?: { value: string; label: string }[] };
type Result = { error: string | null };
type Props = {
  title: string;
  singular: string;
  rows: Row[];
  fields: Field[];
  saveAction: (id: string | null, form: FormData) => Promise<Result>;
  deleteAction: (id: string) => Promise<Result>;
  duplicateAction?: (id: string) => Promise<Result>;
  needsBoard?: boolean;
  detailPath?: string;
};

const button = "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
const input = "mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export function ManagementTable({ title, singular, rows, fields, saveAction, deleteAction, duplicateAction, needsBoard, detailPath }: Props) {
  const [editor, setEditor] = useState<Row | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = editor && editor !== "new" ? editor : null;
  const locked = selected ? rows.find((row) => row.id === selected.id)?.locked : false;

  function run(action: () => Promise<Result>, success: string, closeEditor = false) {
    setError(null);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else {
          if (closeEditor) setEditor(null);
          setMessage(success);
        }
      } catch {
        setError("Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.");
      }
    });
  }

  function openEditor(row: Row | "new") {
    setEditor(row);
    setError(null);
    setMessage("");
  }

  return (
    <main lang="de" className="mx-auto w-full max-w-[1600px] p-4 sm:p-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-sm text-zinc-500">{rows.length} Einträge</p></div>
        <button className={button} disabled={pending || needsBoard} onClick={() => openEditor("new")}>+ {singular} erstellen</button>
      </header>
      {needsBoard && <p className="mb-4">Erstelle zuerst ein <Link href="/boards" className="underline">Board</Link>, um ein Spiel anzulegen.</p>}
      {error && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-red-800">{error}</p>}
      <p role="status" className="mb-4 text-sm text-zinc-500">{message}</p>
      {editor && (
        <section aria-labelledby="editor-title" className="mb-6 rounded-lg border border-zinc-300 p-5 dark:border-zinc-700">
          <h2 id="editor-title" className="mb-4 text-xl font-semibold">{singular} {selected ? "bearbeiten" : "erstellen"}</h2>
          {locked && <p className="mb-4">Dieses Board wird inzwischen verwendet und kann nicht mehr bearbeitet werden.</p>}
          <form key={selected?.id ?? "new"} onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            run(() => saveAction(selected?.id ?? null, form), `${singular} gespeichert.`, true);
          }}>
            <fieldset disabled={pending || locked} className="grid gap-4 sm:grid-cols-2">
              {fields.map((field, index) => (
                <label className="text-sm" key={field.name}>{field.label}{field.optional && " (optional)"}
                  {field.type === "select" ? (
                    <select className={input} name={field.name} required defaultValue={String(selected?.[field.name] ?? "")}>
                      <option value="" disabled>Board auswählen</option>
                      {field.options?.map((option) => <option className="bg-white text-zinc-900" key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : <input autoFocus={index === 0} className={input} name={field.name} type={field.type ?? "text"} step={field.step} min={field.min} required={!field.optional} defaultValue={String(selected?.[field.name] ?? "")} />}
                </label>
              ))}
            </fieldset>
            <div className="mt-5 flex gap-2">
              <button className={button} disabled={pending || locked} type="submit">{pending ? "Speichern…" : "Speichern"}</button>
              <button className={button} disabled={pending} type="button" onClick={() => { setEditor(null); setError(null); }}>Abbrechen</button>
            </div>
          </form>
        </section>
      )}
      <div className="overflow-x-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <caption className="sr-only">{title} mit ihren direkten Attributen</caption>
          <thead className="bg-zinc-100 dark:bg-zinc-900"><tr>
            {fields.map((field) => <th scope="col" key={field.name} className="p-3">{field.label}</th>)}
            {duplicateAction && <th scope="col" className="p-3">Status</th>}
            <th scope="col" className="p-3">Aktionen</th>
          </tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
              {fields.map((field, index) => {
                const value = field.type === "select" ? field.options?.find((option) => option.value === row[field.name])?.label ?? row[field.name] : row[field.name];
                return index === 0 ? <th scope="row" key={field.name} className="p-3 font-medium">{detailPath ? <Link className="underline underline-offset-4" href={`${detailPath}/${encodeURIComponent(row.id)}`}>{value ?? "—"}</Link> : value ?? "—"}</th> : <td key={field.name} className="p-3 tabular-nums">{value ?? "—"}</td>;
              })}
              {duplicateAction && <td className="p-3 text-zinc-500">{row.locked ? "In Verwendung · gesperrt" : "Bearbeitbar"}</td>}
              <td className="p-3"><div className="flex gap-2">
                <button className={button} disabled={pending || row.locked} onClick={() => openEditor(row)} aria-label={`${row.name} bearbeiten`}>Bearbeiten</button>
                {duplicateAction && <button className={button} disabled={pending} onClick={() => run(() => duplicateAction(row.id), "Board dupliziert.")} aria-label={`${row.name} duplizieren`}>Duplizieren</button>}
                <button className={`${button} text-red-600`} disabled={pending || row.locked} aria-label={`${row.name} löschen`} onClick={() => {
                  if (window.confirm(`${row.name} wirklich löschen?`)) run(() => deleteAction(row.id), `${singular} gelöscht.`, selected?.id === row.id);
                }}>Löschen</button>
              </div></td>
            </tr>)}
            {!rows.length && <tr><td colSpan={fields.length + (duplicateAction ? 2 : 1)} className="p-10 text-center text-zinc-500">Noch keine Einträge vorhanden.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
