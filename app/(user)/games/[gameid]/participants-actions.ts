"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function addParticipant(gameId: string, form: FormData) {
  const userId = String(form.get("userId") ?? "").trim();
  if (!userId) return { error: "Bitte wähle einen Benutzer aus." };
  try {
    await prisma.gameParticipant.upsert({
      where: { gameId_userId: { gameId, userId } },
      create: { gameId, userId },
      update: {},
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { error: "Das Spiel oder der ausgewählte Benutzer existiert nicht mehr." };
    }
    return { error: "Der Teilnehmer konnte nicht hinzugefügt werden. Bitte versuche es erneut." };
  }
  revalidatePath(`/games/${gameId}`);
  return { error: null };
}
