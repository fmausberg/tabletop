import type { PhaseType } from "@/generated/prisma/enums";

export function phasesForRound(round: number): PhaseType[] {
  return round === 0 ? ["PLACEMENT"] : ["INITIATIVE", "MOVEMENT", "SHOOTING", "COMBAT"];
}

export function nextPhaseInRound(round: number, phase: PhaseType): PhaseType | null {
  const phases = phasesForRound(round);
  const index = phases.indexOf(phase);
  return index < 0 ? null : phases[index + 1] ?? null;
}

export const phaseOrder: Record<PhaseType, number> = {
  PLACEMENT: 0, INITIATIVE: 1, MOVEMENT: 2, SHOOTING: 3, COMBAT: 4,
};
export const phaseLabels: Record<PhaseType, string> = {
  PLACEMENT: "Aufstellung", INITIATIVE: "Initiative", MOVEMENT: "Bewegung", SHOOTING: "Schießen", COMBAT: "Nahkampf",
};
