import type { PhaseType } from "@/generated/prisma/enums";
import { phaseOrder } from "../game-phases";

type OrderedMovement = { sequence: number; phase: { type: PhaseType; round: { number: number } } };

export function newestMovementFirst(a: OrderedMovement, b: OrderedMovement) {
  return b.phase.round.number - a.phase.round.number
    || phaseOrder[b.phase.type] - phaseOrder[a.phase.type]
    || b.sequence - a.sequence;
}
