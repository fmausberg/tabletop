"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { calculateMovement, remainingMovement } from "./movement-rules";
import { phaseOrder } from "../game-phases";

function validPosition(x: number, y: number, radius: number, lengthCm: number, widthCm: number) {
  return [x, y, radius, lengthCm, widthCm].every(Number.isFinite)
    && radius > 0 && lengthCm > 0 && widthCm > 0
    && x >= radius && y >= radius && x <= lengthCm - radius && y <= widthCm - radius;
}

export async function moveFigure(gameId: string, figureId: string, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: "Ungültige Position." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId }, include: { board: true } });
      if (!game) return { error: "Das Spiel existiert nicht mehr." };
      if (game.currentPhase !== "MOVEMENT") return { error: "Figuren können nur in der Bewegungsphase bewegt werden." };

      const figure = await tx.figure.findFirst({
        where: { id: figureId, gameId, participant: { gameId } },
        include: {
          melees: {
            where: { melee: { action: { phase: { round: { gameId, number: game.currentRound } } } } },
            select: { id: true },
          },
          movementSteps: {
            where: { phase: { round: { gameId } } },
            select: {
              fromXcm: true, fromYcm: true, toXcm: true, toYcm: true, sequence: true,
              phase: { select: { type: true, round: { select: { number: true } } } },
            },
          },
        },
      });
      if (!figure || figure.removed) return { error: "Diese Figur ist in diesem Spiel nicht verfügbar." };
      if (figure.melees.length) return { error: "Diese Figur ist bereits in einen Nahkampf gebunden." };
      const previous = figure.movementSteps.sort((a, b) => b.phase.round.number - a.phase.round.number
        || phaseOrder[b.phase.type] - phaseOrder[a.phase.type]
        || b.sequence - a.sequence)[0];
      if (!previous) return { error: "Diese Figur wurde noch nicht auf dem Spielfeld platziert." };

      const opponents = await tx.figure.findMany({
        where: {
          gameId, removed: false, participantId: { not: figure.participantId },
        },
        include: {
          melees: {
            where: { melee: { action: { phase: { round: { gameId, number: game.currentRound } } } } },
            select: { meleeId: true },
          },
          movementSteps: {
            where: { phase: { round: { gameId } } },
            select: {
              toXcm: true, toYcm: true, sequence: true,
              phase: { select: { type: true, round: { select: { number: true } } } },
            },
          },
        },
      });
      const positionedOpponents = opponents.flatMap((opponent) => {
        const position = opponent.movementSteps.sort((a, b) => b.phase.round.number - a.phase.round.number
          || phaseOrder[b.phase.type] - phaseOrder[a.phase.type]
          || b.sequence - a.sequence)[0];
        return position ? [{ opponent, position }] : [];
      });
      const distanceMoved = figure.movementSteps
        .filter((step) => step.phase.type === "MOVEMENT" && step.phase.round.number === game.currentRound)
        .reduce((total, step) => total + Math.hypot(step.toXcm - step.fromXcm, step.toYcm - step.fromYcm), 0);
      const remainingDistance = remainingMovement(figure.speedCm, distanceMoved);
      const { target, attackedId, limited } = calculateMovement(
        { x: previous.toXcm, y: previous.toYcm }, { x, y }, figure.baseDiameterCm, remainingDistance,
        positionedOpponents.map(({ opponent, position }) => ({
          id: opponent.id, baseDiameterCm: opponent.baseDiameterCm,
          engaged: opponent.melees.length > 0, position: { x: position.toXcm, y: position.toYcm },
        })),
      );
      const attacked = positionedOpponents.find(({ opponent }) => opponent.id === attackedId);
      if (!attacked && remainingDistance <= 1e-9) {
        return { error: "Die Figur hat in dieser Runde keine Bewegung mehr übrig." };
      }
      const { x: targetX, y: targetY } = target;
      if (!validPosition(targetX, targetY, figure.baseDiameterCm / 2, game.board.lengthCm, game.board.widthCm)) {
        return { error: "Die gesamte Base muss innerhalb des Spielfelds liegen." };
      }

      const round = await tx.round.upsert({
        where: { gameId_number: { gameId, number: game.currentRound } },
        create: { gameId, number: game.currentRound }, update: {},
      });
      const phase = await tx.roundPhase.upsert({
        where: { roundId_type: { roundId: round.id, type: "MOVEMENT" } },
        create: { roundId: round.id, type: "MOVEMENT" }, update: {},
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
        fromXcm: previous.toXcm, fromYcm: previous.toYcm, toXcm: targetX, toYcm: targetY,
      } });

      if (attacked) {
        const existingMeleeId = attacked.opponent.melees[0]?.meleeId;
        if (existingMeleeId) {
          await tx.meleeCombatant.create({ data: { meleeId: existingMeleeId, figureId: figure.id } });
        } else {
          const lastAction = await tx.gameAction.aggregate({ where: { phaseId: phase.id }, _max: { sequence: true } });
          const action = await tx.gameAction.create({ data: {
            phaseId: phase.id, type: "MELEE", sequence: (lastAction._max.sequence ?? 0) + 1,
          } });
          const melee = await tx.meleeAction.create({ data: { actionId: action.id } });
          await tx.meleeCombatant.createMany({ data: [
            { meleeId: melee.id, figureId: figure.id },
            { meleeId: melee.id, figureId: attacked.opponent.id },
          ] });
        }
      }
      return { error: null, limited, engaged: Boolean(attacked) };
    });
    revalidatePath(`/games/${gameId}/board`);
    revalidatePath(`/games/${gameId}`);
    return result;
  } catch {
    return { error: "Die Bewegung konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }
}
