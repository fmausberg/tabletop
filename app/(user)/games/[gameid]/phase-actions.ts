"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type PhaseType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { capturePhaseState, phaseHistory, removeEmptyRound, restorePhaseState } from "./phase-history";

export async function updateCurrentPhase(gameId: string, expectedRound: number, expectedPhase: PhaseType, operation: "reset" | "back") {
  if (operation !== "reset" && operation !== "back") return { error: "Unbekannte Phasenaktion." };
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId } });
      if (!game?.setupCompleted || game.currentRound !== expectedRound || game.currentPhase !== expectedPhase) {
        return { error: "Spiel, Runde oder Phase wurde geändert. Bitte aktualisiere die Ansicht." };
      }
      const history = await phaseHistory(tx, gameId, expectedRound, expectedPhase);
      if (operation === "reset") {
        await restorePhaseState(tx, history.baseline);
        await tx.roundPhase.update({ where: { roundId_type: { roundId: history.current.round.id, type: expectedPhase } },
          data: { resetState: history.baseline } });
        return { error: null };
      }
      if (!history.canGoBack || !history.previous) return { error: history.backReason ?? "Ein Rückwechsel ist nicht möglich." };
      const previous = history.previous;
      if (history.previousState) {
        await restorePhaseState(tx, history.previousState);
      } else if (previous.round === expectedRound) {
        // Older games: no transition effects except initiative rolling.
        if (previous.phase === "INITIATIVE") {
          await tx.round.update({ where: { id: history.current.round.id }, data: { initiativeWinnerId: null } });
        }
      } else {
        // Round 0 -> 1 has no deaths or retreats to undo.
        await capturePhaseState(tx, gameId, previous.round);
      }
      if (previous.round !== expectedRound) {
        await removeEmptyRound(tx, history.current.round.id);
      } else {
        await tx.roundPhase.update({ where: { roundId_type: { roundId: history.current.round.id, type: expectedPhase } },
          data: { resetState: Prisma.DbNull, previousState: Prisma.DbNull } });
      }
      await tx.game.update({ where: { id: gameId }, data: { currentRound: previous.round, currentPhase: previous.phase } });
      return { error: null };
    }, { isolationLevel: "Serializable", timeout: 30000 });
    if (result.error) return result;
  } catch (error) {
    console.error("[updateCurrentPhase] Phase transaction failed", { gameId, expectedRound, expectedPhase, operation, error });
    return { error: "Die Phase konnte nicht geändert werden. Es wurden keine Teiländerungen gespeichert. Bitte aktualisiere die Ansicht." };
  }
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/board`, "layout");
  return { error: null };
}
