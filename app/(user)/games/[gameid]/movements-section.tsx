import { prisma } from "@/lib/prisma";
import { phaseLabels, phaseOrder } from "./game-phases";
import { tableWrapper, table, rowBorder } from "./table-styles";

export async function MovementsSection({ gameId }: { gameId: string }) {
  const movements = await prisma.movementStep.findMany({
    where: { phase: { round: { gameId } } },
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
  );
}
