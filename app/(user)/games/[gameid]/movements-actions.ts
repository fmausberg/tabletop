"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { newestMovementFirst } from "./movements-order";

export async function undoLastMovement(gameId: string, expectedMovementId: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const movements = await tx.movementStep.findMany({
        where: { phase: { round: { gameId } } },
        select: { id: true, sequence: true, phase: { select: { type: true, round: { select: { number: true } } } } },
      });
      const latest = movements.sort(newestMovementFirst)[0];
      if (!latest) return { error: "Es gibt keinen Zug zum Rückgängigmachen." };
      if (latest.id !== expectedMovementId) return { error: "Die Bewegungen wurden inzwischen geändert. Bitte prüfe den neuesten Eintrag und versuche es erneut." };
      await tx.movementStep.delete({ where: { id: latest.id } });
      return { error: null };
    });
    revalidatePath(`/games/${gameId}`);
    revalidatePath(`/games/${gameId}/board`);
    return result;
  } catch {
    return { error: "Der letzte Zug konnte nicht rückgängig gemacht werden. Bitte versuche es erneut." };
  }
}
