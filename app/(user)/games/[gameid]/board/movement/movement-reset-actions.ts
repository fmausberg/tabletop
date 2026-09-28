"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { newestMovementFirst } from "./movements-order";

function refreshGame(gameId: string) {
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/board`, "layout");
}

export async function undoLastMovement(gameId: string, expectedRound: number, expectedMovementId?: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) return { error: "Das Spiel existiert nicht mehr." };
      if (game.currentRound !== expectedRound || game.currentPhase !== "MOVEMENT") {
        return { error: "Runde oder Phase wurde inzwischen geändert. Bitte lade die Seite neu." };
      }
      const movements = await tx.movementStep.findMany({
        where: { phase: { round: { gameId } } },
        select: { id: true, sequence: true, phase: { select: { type: true, round: { select: { number: true } } } } },
      });
      const latest = movements.sort(newestMovementFirst)[0];
      if (!latest || latest.phase.type !== "MOVEMENT" || latest.phase.round.number !== game.currentRound) {
        return { error: "Der letzte Zug stammt nicht aus der aktuellen Bewegungsphase." };
      }
      if (expectedMovementId !== undefined && latest.id !== expectedMovementId) {
        return { error: "Die Bewegungen wurden inzwischen geändert. Bitte prüfe den neuesten Eintrag und versuche es erneut." };
      }
      await tx.movementStep.delete({ where: { id: latest.id } });
      return { error: null };
    });
    refreshGame(gameId);
    return result;
  } catch {
    return { error: "Der letzte Zug konnte nicht rückgängig gemacht werden. Bitte versuche es erneut." };
  }
}
