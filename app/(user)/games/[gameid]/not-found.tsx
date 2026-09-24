import Link from "next/link";

export default function GameNotFound() {
  return (
    <main lang="de" className="mx-auto w-full max-w-[1600px] p-4 sm:p-8">
      <h1 className="mb-3 text-2xl font-semibold">Spiel nicht gefunden</h1>
      <p className="mb-4">Dieses Spiel existiert nicht oder wurde gelöscht.</p>
      <Link className="underline underline-offset-4" href="/games">Zurück zu Games</Link>
    </main>
  );
}
