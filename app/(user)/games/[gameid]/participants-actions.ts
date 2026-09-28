"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function addParticipant(gameId: string, form: FormData) {
  const userId = String(form.get("userId") ?? "").trim();
  if (!userId) return { error: "Bitte wähle einen Benutzer aus." };
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game || game.setupCompleted || game.currentRound !== 0 || game.currentPhase !== "PLACEMENT") return { error: "Teilnehmer können nur während der Spielvorbereitung hinzugefügt werden." };
      await tx.gameParticipant.upsert({
        where: { gameId_userId: { gameId, userId } },
        create: { gameId, userId },
        update: {},
      });
      return { error: null };
    });
    if (result.error) return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { error: "Das Spiel oder der ausgewählte Benutzer existiert nicht mehr." };
    }
    return { error: "Der Teilnehmer konnte nicht hinzugefügt werden. Bitte versuche es erneut." };
  }
  revalidatePath(`/games/${gameId}`);
  return { error: null };
}
