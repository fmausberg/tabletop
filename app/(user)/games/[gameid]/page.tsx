import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Figure } from "@/generated/prisma/client";
import type { PhaseType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Spieldetails | Tabletop" };

const phaseOrder: Record<PhaseType, number> = {
  PLACEMENT: 0, INITIATIVE: 1, MOVEMENT: 2, SHOOTING: 3, COMBAT: 4,
};
const phaseLabels: Record<PhaseType, string> = {
  PLACEMENT: "Aufstellung", INITIATIVE: "Initiative", MOVEMENT: "Bewegung", SHOOTING: "Schießen", COMBAT: "Nahkampf",
};
const figureColumns = [
  ["id", "Figur-ID"],
  ["gameId", "Spiel-ID"],
  ["characterId", "Charakter-ID"],
  ["participantId", "Teilnehmer-ID"],
  ["initialFightValueNear", "Nahkampf (Start)"],
  ["initialFightValueFar", "Fernkampf (Start)"],
  ["initialStrength", "Stärke (Start)"],
  ["initialDefense", "Verteidigung (Start)"],
  ["initialAttacks", "Attacken (Start)"],
  ["initialWounds", "Wunden (Start)"],
  ["initialCourage", "Mut (Start)"],
  ["currentFightValueNear", "Nahkampf (aktuell)"],
  ["currentFightValueFar", "Fernkampf (aktuell)"],
  ["currentStrength", "Stärke (aktuell)"],
  ["currentDefense", "Verteidigung (aktuell)"],
  ["currentAttacks", "Attacken (aktuell)"],
  ["currentWounds", "Wunden (aktuell)"],
  ["currentCourage", "Mut (aktuell)"],
  ["baseDiameterCm", "Basisdurchmesser (cm)"],
  ["speedCm", "Geschwindigkeit (cm)"],
  ["removed", "Entfernt"],
] as const satisfies readonly (readonly [keyof Figure, string])[];

const tableWrapper = "overflow-x-auto rounded-lg border border-zinc-300 dark:border-zinc-700";
const table = "w-full whitespace-nowrap text-left text-sm";
const rowBorder = "border-t border-zinc-200 dark:border-zinc-800";

export default async function GameDetailsPage({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const game = await prisma.game.findUnique({
    where: { id: gameid },
    include: {
      board: { select: { name: true } },
      figures: { orderBy: { id: "asc" } },
    },
  });
  if (!game) notFound();

  const movements = await prisma.movementStep.findMany({
    where: { phase: { round: { gameId: gameid } } },
    include: {
      phase: { select: { type: true, round: { select: { number: true } } } },
      turn: { select: { sequence: true, participant: { select: { user: { select: { name: true } } } } } },
      figure: { select: { character: { select: { name: true } } } },
    },
  });
  movements.sort((a, b) => a.phase.round.number - b.phase.round.number
    || phaseOrder[a.phase.type] - phaseOrder[b.phase.type]
    || a.sequence - b.sequence);

  return (
    <main lang="de" className="mx-auto w-full max-w-[1600px] space-y-8 p-4 sm:p-8">
      <header>
        <Link href="/games" className="text-sm underline underline-offset-4">Zurück zu Games</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{game.name}</h1>
      </header>

      <section aria-labelledby="master-data-title">
        <h2 id="master-data-title" className="mb-4 text-xl font-semibold">Stammdaten</h2>
        <dl className="grid gap-4 rounded-lg border border-zinc-300 p-5 sm:grid-cols-3 dark:border-zinc-700">
          <div><dt className="text-sm text-zinc-500">Spiel-ID</dt><dd className="mt-1 break-all font-mono text-sm">{game.id}</dd></div>
          <div><dt className="text-sm text-zinc-500">Name</dt><dd className="mt-1">{game.name}</dd></div>
          <div><dt className="text-sm text-zinc-500">Board</dt><dd className="mt-1">{game.board.name}<span className="mt-1 block break-all font-mono text-xs text-zinc-500">{game.boardId}</span></dd></div>
        </dl>
      </section>

      <section aria-labelledby="figures-title">
        <h2 id="figures-title" className="mb-4 text-xl font-semibold">Figuren <span className="text-sm font-normal text-zinc-500">({game.figures.length})</span></h2>
        <div className={tableWrapper}>
          <table className={table}>
            <caption className="sr-only">Figuren mit allen direkten Attributen</caption>
            <thead className="bg-zinc-100 dark:bg-zinc-900"><tr>{figureColumns.map(([key, label]) => <th scope="col" key={key} className="p-3">{label}</th>)}</tr></thead>
            <tbody>
              {game.figures.map((figure) => <tr key={figure.id} className={rowBorder}>
                {figureColumns.map(([key]) => {
                  const value = figure[key];
                  const display = typeof value === "boolean" ? (value ? "Ja" : "Nein") : value ?? "—";
                  return key === "id" ? <th scope="row" key={key} className="p-3 font-mono text-xs font-normal">{display}</th> : <td key={key} className="p-3 tabular-nums">{display}</td>;
                })}
              </tr>)}
              {!game.figures.length && <tr><td colSpan={figureColumns.length} className="p-8 text-center text-zinc-500">Noch keine Figuren in diesem Spiel.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="movements-title">
        <h2 id="movements-title" className="mb-2 text-xl font-semibold">Movements <span className="text-sm font-normal text-zinc-500">({movements.length})</span></h2>
        <p className="mb-4 text-sm text-zinc-500">Nach Runde, Phase und Schritt sortiert. Koordinaten in cm.</p>
        <div className={tableWrapper}>
          <table className={table}>
            <caption className="sr-only">MovementSteps in chronologischer Spielreihenfolge</caption>
            <thead className="bg-zinc-100 dark:bg-zinc-900"><tr>
              {["Runde", "Phase", "Schritt", "Zug", "Spieler", "Figur", "Von X (cm)", "Von Y (cm)", "Nach X (cm)", "Nach Y (cm)", "Movement-ID"].map((label) => <th scope="col" key={label} className="p-3">{label}</th>)}
            </tr></thead>
            <tbody>
              {movements.map((movement) => <tr key={movement.id} className={rowBorder}>
                <td className="p-3 tabular-nums">{movement.phase.round.number}</td>
                <td className="p-3">{phaseLabels[movement.phase.type]}</td>
                <th scope="row" className="p-3 font-normal tabular-nums">{movement.sequence}</th>
                <td className="p-3 tabular-nums">{movement.turn.sequence}</td>
                <td className="p-3">{movement.turn.participant.user.name}</td>
                <td className="p-3">{movement.figure.character.name}<span className="block font-mono text-xs text-zinc-500">{movement.figureId}</span></td>
                <td className="p-3 tabular-nums">{movement.fromXcm}</td>
                <td className="p-3 tabular-nums">{movement.fromYcm}</td>
                <td className="p-3 tabular-nums">{movement.toXcm}</td>
                <td className="p-3 tabular-nums">{movement.toYcm}</td>
                <td className="p-3 font-mono text-xs text-zinc-500">{movement.id}</td>
              </tr>)}
              {!movements.length && <tr><td colSpan={11} className="p-8 text-center text-zinc-500">Noch keine Bewegungen in diesem Spiel.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
