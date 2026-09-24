"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { PhaseType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { phasesForRound } from "./game-phases";

async function ensurePhase(tx: Prisma.TransactionClient, gameId: string, number: number, type: PhaseType) {
  const round = await tx.round.upsert({
    where: { gameId_number: { gameId, number } },
    create: { gameId, number }, update: {},
  });
  await tx.roundPhase.upsert({
    where: { roundId_type: { roundId: round.id, type } },
    create: { roundId: round.id, type }, update: {},
  });
}

function refreshProgress(gameId: string) {
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/board`);
}

export async function advanceRound(gameId: string, expectedRound: number) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) return { error: "Das Spiel existiert nicht mehr." };
      if (game.currentRound !== expectedRound) return { error: "Die Runde wurde bereits geändert. Bitte lade die Seite neu." };
      if (game.currentRound >= 2147483647) return { error: "Die maximale Rundennummer ist erreicht." };
      await ensurePhase(tx, gameId, game.currentRound, game.currentPhase);

      let initiativeWinnerName: string | null = null;
      if (game.currentPhase === "INITIATIVE") {
        const participants = await tx.gameParticipant.findMany({
          where: { gameId },
          orderBy: { id: "asc" },
          select: { id: true, user: { select: { name: true } } },
        });
        if (!participants.length) return { error: "Für die Initiative muss das Spiel mindestens einen Teilnehmer haben." };

        const winner = participants[randomInt(participants.length)];
        await tx.round.update({
          where: { gameId_number: { gameId, number: game.currentRound } },
          data: { initiativeWinnerId: winner.id },
        });
        initiativeWinnerName = winner.user.name;

        await ensurePhase(tx, gameId, game.currentRound, "MOVEMENT");
        await tx.game.update({ where: { id: gameId }, data: { currentPhase: "MOVEMENT" } });
        return { error: null, initiativeWinnerName };
      }

      const nextRound = game.currentRound + 1;
      await ensurePhase(tx, gameId, nextRound, "INITIATIVE");
      await tx.game.update({ where: { id: gameId }, data: { currentRound: nextRound, currentPhase: "INITIATIVE" } });
      return { error: null, initiativeWinnerName };
    });
    refreshProgress(gameId);
    return result;
  } catch {
    return { error: "Die Runde konnte nicht geändert werden. Bitte versuche es erneut." };
  }
}

export async function changePhase(gameId: string, expectedRound: number, phase: PhaseType) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game) return { error: "Das Spiel existiert nicht mehr." };
      if (game.currentRound !== expectedRound) return { error: "Die Runde wurde inzwischen geändert. Bitte wähle die Phase erneut." };
      if (!phasesForRound(game.currentRound).includes(phase)) return { error: "Diese Phase ist in der aktuellen Runde nicht erlaubt." };
      await ensurePhase(tx, gameId, game.currentRound, phase);
      await tx.game.update({ where: { id: gameId }, data: { currentPhase: phase } });
      return { error: null };
    });
    refreshProgress(gameId);
    return result;
  } catch {
    return { error: "Die Phase konnte nicht geändert werden. Bitte versuche es erneut." };
  }
}
