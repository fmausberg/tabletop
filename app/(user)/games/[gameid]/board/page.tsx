import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { phaseOrder } from "../game-phases";
import { BoardViewer } from "./board-viewer";
import type { BoardData } from "./board-model";
import { RoundControls } from "./round-controls";

export const metadata: Metadata = { title: "Spielfeld | Tabletop" };

export default async function BoardPage({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const game = await prisma.game.findUnique({
    where: { id: gameid },
    include: {
      board: true,
      participants: { orderBy: { id: "asc" }, include: { user: { select: { name: true } } } },
      figures: {
        orderBy: [{ number: "asc" }, { id: "asc" }],
        include: {
          character: { select: { name: true } },
          movementSteps: {
            where: { phase: { round: { gameId: gameid } } },
            select: { fromXcm: true, fromYcm: true, toXcm: true, toYcm: true, sequence: true, phase: { select: { type: true, round: { select: { number: true } } } } },
          },
          melees: {
            where: { melee: { action: { phase: { round: { gameId: gameid } } } } },
            select: { melee: { select: { action: { select: { phase: { select: { round: { select: { number: true } } } } } } } } },
          },
        },
      },
    },
  });
  if (!game) notFound();

  const data: BoardData = {
    gameId: game.id,
    currentRound: game.currentRound,
    currentPhase: game.currentPhase,
    lengthCm: game.board.lengthCm,
    widthCm: game.board.widthCm,
    participants: game.participants.map((participant, index) => ({
      id: participant.id, name: participant.user.name,
      color: `hsl(${(index * 137.508 + 210) % 360} 65% 48%)`,
    })),
    figures: game.figures.map((figure) => {
      const latest = figure.movementSteps.sort((a, b) => b.phase.round.number - a.phase.round.number
        || phaseOrder[b.phase.type] - phaseOrder[a.phase.type]
        || b.sequence - a.sequence)[0];
      const currentMovements = figure.movementSteps.filter((step) =>
        step.phase.type === "MOVEMENT" && step.phase.round.number === game.currentRound);
      return {
        id: figure.id,
        name: `${figure.character.name}${figure.number === null ? "" : ` ${figure.number}`}`,
        short: figure.short,
        participantId: figure.participantId,
        wounds: figure.currentWounds,
        baseDiameterCm: figure.baseDiameterCm,
        speedCm: figure.speedCm,
        movementDistanceCm: currentMovements
          .reduce((total, step) => total + Math.hypot(step.toXcm - step.fromXcm, step.toYcm - step.fromYcm), 0),
        engaged: figure.melees.some((combatant) => combatant.melee.action.phase.round.number === game.currentRound),
        position: latest ? { x: latest.toXcm, y: latest.toYcm } : null,
        removed: figure.removed,
      };
    }),
  };

  return (
    <main lang="de" className="mx-auto w-full max-w-[1600px] p-4 sm:p-8">
      <Link href={`/games/${game.id}`} className="text-sm underline underline-offset-4">Zurück zum Spiel</Link>
      <h1 className="mt-3 text-3xl font-semibold">
        {game.name} · Spielfeld <span className="text-sm font-normal text-zinc-500">· {game.board.name} · {data.lengthCm} × {data.widthCm} cm</span>
      </h1>
      <RoundControls gameId={game.id} round={game.currentRound} phase={game.currentPhase} />
      {![data.lengthCm, data.widthCm].every((value) => Number.isFinite(value) && value > 0)
        ? <p role="alert">Das Board benötigt eine gültige Länge und Breite größer als 0.</p>
        : <BoardViewer data={data} />}
    </main>
  );
}
