"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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
      const remainingDistance = Math.max(0, figure.speedCm - distanceMoved);
      const attacked = positionedOpponents
        .filter(({ opponent, position }) => {
          const centerDistance = Math.hypot(previous.toXcm - position.toXcm, previous.toYcm - position.toYcm);
          const basesDistance = figure.baseDiameterCm / 2 + opponent.baseDiameterCm / 2;
          const targetDistance = Math.hypot(x - position.toXcm, y - position.toYcm);
          return opponent.melees.length
            ? centerDistance <= remainingDistance + basesDistance + 1e-9 && targetDistance <= basesDistance
            : targetDistance <= basesDistance + 2;
        })
        .sort((a, b) => Math.hypot(x - a.position.toXcm, y - a.position.toYcm)
          - Math.hypot(x - b.position.toXcm, y - b.position.toYcm))[0];

      let limited = false;
      let targetX: number;
      let targetY: number;
      if (attacked) {
        const directionX = attacked.position.toXcm - previous.toXcm;
        const directionY = attacked.position.toYcm - previous.toYcm;
        const centerDistance = Math.hypot(directionX, directionY);
        const baseContactDistance = figure.baseDiameterCm / 2 + attacked.opponent.baseDiameterCm / 2;
        const travelDistance = Math.max(0, centerDistance - baseContactDistance);
        const factor = centerDistance > 0 ? travelDistance / centerDistance : 0;
        targetX = previous.toXcm + directionX * factor;
        targetY = previous.toYcm + directionY * factor;
      } else {
        if (remainingDistance <= 1e-9) return { error: "Die Figur hat in dieser Runde keine Bewegung mehr übrig." };
        const nextDistance = Math.hypot(x - previous.toXcm, y - previous.toYcm);
        limited = nextDistance > remainingDistance;
        const factor = limited ? remainingDistance / nextDistance : 1;
        targetX = previous.toXcm + (x - previous.toXcm) * factor;
        targetY = previous.toYcm + (y - previous.toYcm) * factor;
      }
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
