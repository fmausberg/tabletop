import type { PhaseType } from "@/generated/prisma/enums";

export const phaseOrder: Record<PhaseType, number> = {
  PLACEMENT: 0, INITIATIVE: 1, MOVEMENT: 2, SHOOTING: 3, COMBAT: 4,
};
export const phaseLabels: Record<PhaseType, string> = {
  PLACEMENT: "Aufstellung", INITIATIVE: "Initiative", MOVEMENT: "Bewegung", SHOOTING: "Schießen", COMBAT: "Nahkampf",
};
