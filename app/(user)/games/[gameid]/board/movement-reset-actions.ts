"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { phaseOrder } from "../game-phases";

function refreshGame(gameId: string) {
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/board`);
}

export async function undoLastRoundMovement(gameId: string, expectedRound: number) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) return { error: "Das Spiel existiert nicht mehr." };
      if (game.currentRound !== expectedRound || game.currentPhase !== "MOVEMENT") {
        return { error: "Runde oder Phase wurde inzwischen geändert. Bitte lade die Seite neu." };
      }
      const latest = await tx.movementStep.findFirst({
        where: { phase: { type: "MOVEMENT", round: { gameId, number: expectedRound } } },
        orderBy: { sequence: "desc" },
        select: { id: true },
      });
      if (!latest) return { error: "In dieser Runde gibt es keinen Zug zum Rückgängigmachen." };
      await tx.movementStep.delete({ where: { id: latest.id } });
      return { error: null };
    });
    refreshGame(gameId);
    return result;
  } catch {
    return { error: "Der letzte Zug konnte nicht rückgängig gemacht werden. Bitte versuche es erneut." };
  }
}

export async function resetRound(gameId: string, expectedRound: number) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) return { error: "Das Spiel existiert nicht mehr." };
      if (game.currentRound !== expectedRound || game.currentPhase !== "MOVEMENT") {
        return { error: "Runde oder Phase wurde inzwischen geändert. Bitte lade die Seite neu." };
      }

      const woundChanges = await tx.woundChange.findMany({
        where: { action: { phase: { round: { gameId, number: expectedRound } } } },
        select: {
          figureId: true, woundsBefore: true,
          action: { select: { sequence: true, phase: { select: { type: true } } } },
        },
      });
      woundChanges.sort((a, b) => phaseOrder[a.action.phase.type] - phaseOrder[b.action.phase.type]
        || a.action.sequence - b.action.sequence);
      const woundsBeforeRound = new Map<string, number>();
      for (const change of woundChanges) {
        if (!woundsBeforeRound.has(change.figureId)) woundsBeforeRound.set(change.figureId, change.woundsBefore);
      }
      for (const [figureId, currentWounds] of woundsBeforeRound) {
        await tx.figure.update({ where: { id: figureId }, data: { currentWounds } });
      }

      const actionFilter = { action: { phase: { round: { gameId, number: expectedRound } } } };
      await tx.woundChange.deleteMany({ where: actionFilter });
      await tx.shotAction.deleteMany({ where: actionFilter });
      await tx.meleeCombatant.deleteMany({
        where: { melee: { action: { phase: { round: { gameId, number: expectedRound } } } } },
      });
      await tx.meleeAction.deleteMany({ where: actionFilter });
      const deletedActions = await tx.gameAction.deleteMany({
        where: { phase: { round: { gameId, number: expectedRound } } },
      });
      const deletedMovements = await tx.movementStep.deleteMany({
        where: { phase: { round: { gameId, number: expectedRound } } },
      });
      return { error: null, movements: deletedMovements.count, actions: deletedActions.count };
    });
    refreshGame(gameId);
    return result;
  } catch {
    return { error: "Die Bewegungen und Aktionen konnten nicht zurückgesetzt werden. Bitte versuche es erneut." };
  }
}
