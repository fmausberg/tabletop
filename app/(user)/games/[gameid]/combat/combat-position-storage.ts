import type { Prisma } from "@/generated/prisma/client";
import type { CombatData } from "./combat-model";

// Caller holds the game lock and validates the complete arrangement before writing.
export async function storeCombatPositions(tx: Prisma.TransactionClient, data: CombatData, positions: Record<string, { x: number; y: number }>) {
  const moved = data.figures.filter((figure) => {
    const target = positions[figure.id];
    return figure.position && target && (target.x !== figure.position.x || target.y !== figure.position.y);
  });
  if (!moved.length) return 0;
  const round = await tx.round.findUniqueOrThrow({ where: { gameId_number: { gameId: data.gameId, number: data.round } } });
  const phase = await tx.roundPhase.upsert({
    where: { roundId_type: { roundId: round.id, type: "COMBAT" } },
    create: { roundId: round.id, type: "COMBAT" }, update: {},
  });
  const turns = new Map<string, string>();
  for (const participantId of new Set(moved.map((figure) => figure.participantId))) {
    let turn = await tx.phaseTurn.findUnique({ where: { phaseId_participantId: { phaseId: phase.id, participantId } } });
    if (!turn) {
      const last = await tx.phaseTurn.aggregate({ where: { phaseId: phase.id }, _max: { sequence: true } });
      turn = await tx.phaseTurn.create({ data: { phaseId: phase.id, participantId, sequence: (last._max.sequence ?? 0) + 1 } });
    }
    turns.set(participantId, turn.id);
  }
  const lastStep = await tx.movementStep.aggregate({ where: { phaseId: phase.id }, _max: { sequence: true } });
  await tx.movementStep.createMany({ data: moved.map((figure, index) => ({
    phaseId: phase.id, turnId: turns.get(figure.participantId)!, figureId: figure.id,
    sequence: (lastStep._max.sequence ?? 0) + index + 1,
    fromXcm: figure.position!.x, fromYcm: figure.position!.y,
    toXcm: positions[figure.id].x, toYcm: positions[figure.id].y,
  })) });
  return moved.length;
}
