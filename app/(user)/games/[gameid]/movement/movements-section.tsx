import { prisma } from "@/lib/prisma";
import type { PhaseType } from "@/generated/prisma/enums";
import { phaseLabels } from "../game-phases";
import { newestMovementFirst } from "./movements-order";
import { MovementsUndoButton } from "./movements-undo-button";
import { tableWrapper, table, rowBorder } from "../table-styles";

const cm = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function directionDegrees(fromX: number, fromY: number, toX: number, toY: number) {
  const x = toX - fromX;
  const y = toY - fromY;
  return x === 0 && y === 0 ? null : (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
}

export async function MovementsSection({ gameId, round, phase }: { gameId: string; round: number; phase: PhaseType }) {
  const movements = await prisma.movementStep.findMany({
    where: { phase: { round: { gameId } } },
    include: {
      phase: { select: { type: true, round: { select: { number: true } } } },
      turn: { select: { sequence: true, participant: { select: { user: { select: { name: true } } } } } },
      figure: { select: { number: true, character: { select: { name: true } } } },
    },
  });
  movements.sort(newestMovementFirst);
  const latest = movements[0];
  const undoId = latest?.phase.type === "MOVEMENT" && latest.phase.round.number === round ? latest.id : null;

  return (
  <section aria-labelledby="movements-title">
    <h2 id="movements-title" className="mb-2 text-xl font-semibold">Movements <span className="text-sm font-normal text-zinc-500">({movements.length})</span></h2>
    <p className="mb-4 text-sm text-zinc-500">Neueste Bewegung zuerst, nach Runde, Phase und Schritt. Richtung als Winkel: 0° oben, 90° rechts.</p>
    {phase === "MOVEMENT" && <MovementsUndoButton gameId={gameId} round={round} latestId={undoId} />}
    <div className={tableWrapper}>
      <table className={table}>
        <caption className="sr-only">MovementSteps in umgekehrter chronologischer Spielreihenfolge</caption>
        <thead className="bg-zinc-100 dark:bg-zinc-900"><tr>
          {["Runde", "Phase", "Schritt", "Zug", "Spieler", "Figur", "Richtung", "Distanz (cm)", "Movement-ID"].map((label) => <th scope="col" key={label} className="p-3">{label}</th>)}
        </tr></thead>
        <tbody>
          {movements.map((movement) => {
            const degrees = directionDegrees(movement.fromXcm, movement.fromYcm, movement.toXcm, movement.toYcm);
            return <tr key={movement.id} className={rowBorder}>
            <td className="p-3 tabular-nums">{movement.phase.round.number}</td>
            <td className="p-3">{phaseLabels[movement.phase.type]}</td>
            <th scope="row" className="p-3 font-normal tabular-nums">{movement.sequence}</th>
            <td className="p-3 tabular-nums">{movement.turn.sequence}</td>
            <td className="p-3">{movement.turn.participant.user.name}</td>
            <td className="p-3">{movement.figure.character.name}{movement.figure.number === null ? "" : ` ${movement.figure.number}`}<span className="block font-mono text-xs text-zinc-500">{movement.figureId}</span></td>
            <td className="p-3">{degrees === null ? <span className="text-zinc-500">—</span> : <span className="inline-flex items-center gap-2" aria-label={`${degrees.toFixed(1)} Grad`}>
              <span className="inline-block text-2xl leading-none" style={{ transform: `rotate(${degrees}deg)` }} aria-hidden="true">↑</span>
              <span className="tabular-nums">{degrees.toFixed(1)}°</span>
            </span>}</td>
            <td className="p-3 tabular-nums">{cm.format(Math.hypot(movement.toXcm - movement.fromXcm, movement.toYcm - movement.fromYcm))}</td>
            <td className="p-3 font-mono text-xs text-zinc-500">{movement.id}</td>
          </tr>})}
          {!movements.length && <tr><td colSpan={9} className="p-8 text-center text-zinc-500">Noch keine Bewegungen in diesem Spiel.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>
  );
}
