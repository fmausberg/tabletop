import "server-only";
import { notFound, redirect } from "next/navigation";
import type { PhaseType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { phaseOrder } from "../game-phases";
import { readCombatData } from "./combat/combat-data";
import { boardPhasePath } from "./board-routes";
import type { BoardData } from "./board-model";

export async function loadBoardData(gameid: string, expectedPhase?: PhaseType) {
  const { game, combatData } = await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
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
    const combatData = expectedPhase === "COMBAT" && game?.currentPhase === "COMBAT" ? await readCombatData(tx, gameid) : null;
    return { game, combatData };
  }, { isolationLevel: "RepeatableRead" });
  if (!game) notFound();
  if (expectedPhase && game.currentPhase !== expectedPhase) redirect(boardPhasePath(gameid, game.currentPhase));

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

  return { game, data, combatData };
}
