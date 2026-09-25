import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { phaseOrder } from "../game-phases";
import type { CombatData } from "./combat-model";
import { newestMovementFirst } from "../movement/movements-order";

export async function readCombatData(tx: Prisma.TransactionClient, gameId: string): Promise<CombatData | null> {
  const game = await tx.game.findUnique({
    where: { id: gameId },
    include: {
      board: { select: { lengthCm: true, widthCm: true } },
      participants: { orderBy: { id: "asc" }, include: { user: { select: { name: true } } } },
      figures: { orderBy: { id: "asc" }, include: {
        character: { select: { name: true } }, participant: { select: { gameId: true } },
        movementSteps: {
          where: { phase: { round: { gameId } } },
          select: { id: true, toXcm: true, toYcm: true, sequence: true,
            phase: { select: { type: true, round: { select: { number: true } } } } },
        },
      } },
    },
  });
  if (!game) return null;
  // Movement can create a melee before the COMBAT phase begins.
  const melees = await tx.meleeAction.findMany({
    where: { action: { type: "MELEE", phase: { round: { gameId, number: game.currentRound } } } },
    orderBy: { id: "asc" },
    include: {
      action: { include: { phase: true, wounds: { orderBy: { id: "asc" } } } },
      combatants: { orderBy: { figureId: "asc" }, select: { figureId: true } },
    },
  });
  const data = {
    gameId, round: game.currentRound, phase: game.currentPhase,
    lengthCm: game.board.lengthCm, widthCm: game.board.widthCm,
    participants: game.participants.map((participant) => ({ id: participant.id, name: participant.user.name })),
    figures: game.figures.map((figure) => {
      const latest = figure.movementSteps.sort(newestMovementFirst)[0];
      return {
        id: figure.id, name: `${figure.character.name}${figure.number === null ? "" : ` ${figure.number}`}`,
        participantId: figure.participantId, participantGameId: figure.participant.gameId,
        wounds: figure.currentWounds, removed: figure.removed,
        baseDiameterCm: figure.baseDiameterCm,
        position: latest ? { x: latest.toXcm, y: latest.toYcm } : null,
        positionStepId: latest?.id ?? null,
      };
    }),
    combats: melees.map((melee) => ({
      id: melee.id, actionId: melee.actionId, phase: melee.action.phase.type, sequence: melee.action.sequence,
      winnerParticipantId: melee.winnerParticipantId,
      figureIds: melee.combatants.map((combatant) => combatant.figureId),
      wounds: melee.action.wounds.map(({ id, figureId, woundsBefore, woundsAfter }) => ({ id, figureId, woundsBefore, woundsAfter })),
    })).sort((a, b) => phaseOrder[a.phase] - phaseOrder[b.phase] || a.sequence - b.sequence),
  };
  // Reject stale forms, including concurrent membership or wound changes.
  return { ...data, revision: createHash("sha256").update(JSON.stringify(data)).digest("hex") };
}
