import type { PhaseType } from "@/generated/prisma/enums";

export const phaseSegments = {
  PLACEMENT: "placement",
  INITIATIVE: "initiative",
  MOVEMENT: "movement",
  SHOOTING: "shooting",
  COMBAT: "combat",
} satisfies Record<PhaseType, string>;

export function boardPhasePath(gameId: string, phase: PhaseType) {
  return `/games/${gameId}/board/${phaseSegments[phase]}`;
}
