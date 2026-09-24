"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function deleteFigure(gameId: string, figureId: string) {
  try {
    await prisma.figure.delete({ where: { id: figureId, gameId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") return { error: "Diese Figur hat bereits Bewegungen oder Aktionen und kann nicht gelöscht werden." };
      if (error.code === "P2025") return { error: "Die Figur wurde nicht in diesem Spiel gefunden. Bitte lade die Seite neu." };
    }
    return { error: "Die Figur konnte nicht gelöscht werden. Bitte versuche es erneut." };
  }
  revalidatePath(`/games/${gameId}`);
  return { error: null };
}

export async function addFigure(gameId: string, form: FormData) {
  const characterId = String(form.get("characterId") ?? "").trim();
  const userId = String(form.get("playerId") ?? "").trim();
  if (!characterId) return { error: "Bitte wähle ein Charakterprofil aus." };
  if (!userId) return { error: "Bitte wähle einen Spieler aus." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize additions to this game so simultaneous requests cannot reuse a number.
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const [game, character, user] = await Promise.all([
        tx.game.findUnique({ where: { id: gameId }, select: { id: true } }),
        tx.character.findUnique({ where: { id: characterId } }),
        tx.user.findUnique({ where: { id: userId }, select: { id: true } }),
      ]);
      if (!game) return { error: "Dieses Spiel existiert nicht mehr." };
      if (!character) return { error: "Dieses Charakterprofil existiert nicht mehr." };
      if (!user) return { error: "Dieser Spieler existiert nicht mehr." };

      const participant = await tx.gameParticipant.upsert({
        where: { gameId_userId: { gameId, userId } },
        create: { gameId, userId },
        update: {},
      });
      let number: number | null = null;
      if (character.type !== "NAMED_HERO") {
        const existing = await tx.figure.aggregate({
          where: { gameId, participantId: participant.id, characterId },
          _count: { _all: true },
          _max: { number: true },
        });
        // Include older, unnumbered figures and preserve gaps left by deleted figures.
        number = Math.max(existing._count._all, existing._max.number ?? 0) + 1;
      }
      await tx.figure.create({
        data: {
          gameId,
          number,
          short: character.short,
          characterId,
          participantId: participant.id,
          initialFightValueNear: character.fightValueNear,
          initialFightValueFar: character.fightValueFar,
          initialStrength: character.strength,
          initialDefense: character.defense,
          initialAttacks: character.attacks,
          initialWounds: character.wounds,
          initialCourage: character.courage,
          currentFightValueNear: character.fightValueNear,
          currentFightValueFar: character.fightValueFar,
          currentStrength: character.strength,
          currentDefense: character.defense,
          currentAttacks: character.attacks,
          currentWounds: character.wounds,
          currentCourage: character.courage,
          baseDiameterCm: character.baseDiameterCm,
          speedCm: character.speedCm,
        }
      });
      return { error: null };
    });
    if (result.error) return result;
  } catch {
    return { error: "Die Figur konnte nicht hinzugefügt werden. Bitte lade die Seite neu und versuche es erneut." };
  }
  revalidatePath(`/games/${gameId}`);
  return { error: null };
}
