"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function validPosition(x: number, y: number, radius: number, lengthCm: number, widthCm: number) {
  return [x, y, radius, lengthCm, widthCm].every(Number.isFinite)
    && radius > 0 && lengthCm > 0 && widthCm > 0
    && x >= radius && y >= radius && x <= lengthCm - radius && y <= widthCm - radius;
}

function refreshBoard(gameId: string) {
  revalidatePath(`/games/${gameId}/board`);
  revalidatePath(`/games/${gameId}`);
}

export async function movePlacedFigure(gameId: string, figureId: string, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: "Ungültige Position." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId }, include: { board: true } });
      if (!game) return { error: "Das Spiel existiert nicht mehr." };
      if (game.currentRound !== 0 || game.currentPhase !== "PLACEMENT") return { error: "Figuren können nur in der Aufstellungsphase verschoben werden." };
      const figure = await tx.figure.findFirst({ where: { id: figureId, gameId, participant: { gameId } } });
      if (!figure || figure.removed) return { error: "Diese Figur ist in diesem Spiel nicht verfügbar." };
      if (!validPosition(x, y, figure.baseDiameterCm / 2, game.board.lengthCm, game.board.widthCm)) {
        return { error: "Die gesamte Base muss innerhalb des Spielfelds liegen." };
      }
      const placement = await tx.movementStep.findFirst({
        where: { figureId, phase: { type: "PLACEMENT", round: { gameId, number: 0 } } },
        orderBy: { sequence: "asc" },
      });
      if (!placement) return { error: "Für diese Figur wurde keine Aufstellung gefunden." };
      await tx.movementStep.update({
        where: { id: placement.id },
        data: { fromXcm: x, fromYcm: y, toXcm: x, toYcm: y },
      });
      return { error: null };
    });
    refreshBoard(gameId);
    return result;
  } catch {
    return { error: "Die Figur konnte nicht verschoben werden. Bitte versuche es erneut." };
  }
}

export async function placeFigure(gameId: string, figureId: string, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: "Ungültige Position." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize placements and phase changes to keep step/turn sequences unique.
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId }, include: { board: true } });
      if (!game) return { error: "Das Spiel existiert nicht mehr." };
      if (game.currentRound !== 0 || game.currentPhase !== "PLACEMENT") return { error: "Figuren können nur in der Aufstellungsphase platziert werden." };
      const figure = await tx.figure.findFirst({
        where: { id: figureId, gameId, participant: { gameId } },
        include: { _count: { select: { movementSteps: true } } },
      });
      if (!figure || figure.removed) return { error: "Diese Figur ist in diesem Spiel nicht verfügbar." };
      if (figure._count.movementSteps > 0) return { error: "Diese Figur wurde bereits platziert." };
      const radius = figure.baseDiameterCm / 2;
      if (!validPosition(x, y, radius, game.board.lengthCm, game.board.widthCm)) {
        return { error: "Die gesamte Base muss innerhalb des Spielfelds liegen." };
      }

      const round = await tx.round.upsert({
        where: { gameId_number: { gameId, number: 0 } }, create: { gameId, number: 0 }, update: {},
      });
      const phase = await tx.roundPhase.upsert({
        where: { roundId_type: { roundId: round.id, type: "PLACEMENT" } },
        create: { roundId: round.id, type: "PLACEMENT" }, update: {},
      });
      let turn = await tx.phaseTurn.findUnique({
        where: { phaseId_participantId: { phaseId: phase.id, participantId: figure.participantId } },
      });
      if (!turn) {
        const lastTurn = await tx.phaseTurn.aggregate({ where: { phaseId: phase.id }, _max: { sequence: true } });
        turn = await tx.phaseTurn.create({ data: {
          phaseId: phase.id, participantId: figure.participantId, sequence: (lastTurn._max.sequence ?? 0) + 1,
        } });
      }
      const lastStep = await tx.movementStep.aggregate({ where: { phaseId: phase.id }, _max: { sequence: true } });
      await tx.movementStep.create({ data: {
        phaseId: phase.id, turnId: turn.id, figureId,
        sequence: (lastStep._max.sequence ?? 0) + 1,
        // Initial placement has no previous board position: origin equals destination.
        fromXcm: x, fromYcm: y, toXcm: x, toYcm: y,
      } });
      return { error: null };
    });
    refreshBoard(gameId);
    return result;
  } catch {
    return { error: "Die Figur konnte nicht platziert werden. Bitte versuche es erneut." };
  }
}
