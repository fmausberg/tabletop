import type { PhaseType } from "@/generated/prisma/enums";

export type CombatFigure = {
  id: string;
  name: string;
  participantId: string;
  participantGameId: string;
  wounds: number;
  removed: boolean;
  baseDiameterCm: number;
  position: { x: number; y: number } | null;
  positionStepId: string | null;
};

export type CombatEntry = {
  id: string;
  actionId: string;
  phase: PhaseType;
  sequence: number;
  winnerParticipantId: string | null;
  figureIds: string[];
  wounds: { id: string; figureId: string; woundsBefore: number; woundsAfter: number }[];
};

export type CombatData = {
  gameId: string;
  round: number;
  phase: PhaseType;
  revision: string;
  lengthCm: number;
  widthCm: number;
  participants: { id: string; name: string }[];
  figures: CombatFigure[];
  combats: CombatEntry[];
};

export function isCombatResolved(combat: CombatEntry) {
  // Existing wound records must never be treated as an editable draft.
  return combat.winnerParticipantId !== null || combat.wounds.length > 0;
}

export function combatEvaluationIssue(data: CombatData): string | null {
  if (!data.combats.length) return "Lege zuerst einen Nahkampf an.";
  const assigned = new Set<string>();
  for (const combat of data.combats) {
    const sides = new Set<string>();
    for (const id of combat.figureIds) {
      const figure = data.figures.find((entry) => entry.id === id);
      if (!figure || figure.removed || figure.participantGameId !== data.gameId
        || !data.participants.some((entry) => entry.id === figure.participantId)) {
        return "Alle Nahkämpfe müssen verfügbare Figuren dieses Spiels enthalten.";
      }
      if (assigned.has(id)) return "Eine Figur darf nur einem Nahkampf zugeordnet sein.";
      assigned.add(id);
      sides.add(figure.participantId);
    }
    if (sides.size !== 2) return "Ordne jedem Nahkampf Figuren von genau zwei gegnerischen Spielern zu oder lösche unvollständige Nahkämpfe.";
  }
  return null;
}

export function combatAssignmentKey(data: CombatData) {
  return JSON.stringify([data.gameId, data.round, data.combats.map((combat) =>
    [combat.id, [...combat.figureIds].sort()]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))]);
}

export type CombatCommand =
  | { type: "create" }
  | { type: "delete" | "reset"; combatId: string }
  | { type: "assign"; figureId: string; fromCombatId: string | null; toCombatId: string | null }
  | { type: "split"; combatId: string; figureIds: string[] }
  | {
    type: "resolve" | "correct"; combatId: string; winnerParticipantId: string;
    wounds: { figureId: string; woundsAfter: number }[]
  };
