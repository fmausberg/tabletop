import type { Prisma } from "@/generated/prisma/client";
import { readCombatData } from "./combat-data";
import { calculateCombatRetreats } from "./combat-retreat";
import { storeCombatPositions } from "./combat-position-storage";

export class CombatRoundEndError extends Error {}

export async function finishCombatRound(tx: Prisma.TransactionClient, gameId: string, round: number) {
  const data = await readCombatData(tx, gameId);
  if (!data || data.phase !== "COMBAT" || data.round !== round) throw new CombatRoundEndError("Die Nahkampfphase wurde inzwischen geändert.");
  for (const combat of data.combats) {
    const sides = new Set(data.figures.filter((figure) => combat.figureIds.includes(figure.id)).map((figure) => figure.participantId));
    if (!combat.winnerParticipantId || sides.size !== 2 || !sides.has(combat.winnerParticipantId)) {
      throw new CombatRoundEndError("Bitte werte zuerst alle Nahkämpfe aus oder lösche noch offene, nicht benötigte Nahkämpfe.");
    }
  }
  // Calculate using survivors only, so deaths free their space before retreating.
  const retreat = calculateCombatRetreats(data);
  if (retreat.error !== null) throw new CombatRoundEndError(retreat.error);
  const dead = await tx.figure.updateMany({ where: { gameId, currentWounds: { lte: 0 }, removed: false }, data: { removed: true } });
  const retreated = await storeCombatPositions(tx, data, retreat.positions);
  return { dead: dead.count, retreated };
}
