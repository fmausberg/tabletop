import type { CombatData } from "./combat-model";
import type { SeparationInput, SeparationResult } from "./combat-separation";

export type CombatLayoutPreview = SeparationResult & { id: string; revision: string };

export function separationInput(data: CombatData): SeparationInput | null {
  const assigned = new Set(data.combats.flatMap((combat) => combat.figureIds));
  const circles = data.figures.filter((figure) => !figure.removed && figure.position).map((figure) => ({
    id: figure.id, x: figure.position!.x, y: figure.position!.y, radius: figure.baseDiameterCm / 2,
  }));
  if ([...assigned].some((id) => !circles.some((circle) => circle.id === id))) return null;
  return {
    lengthCm: data.lengthCm, widthCm: data.widthCm,
    groups: [...data.combats].sort((a, b) => a.id.localeCompare(b.id)).map((combat) => ({
      id: combat.id, figures: circles.filter((circle) => combat.figureIds.includes(circle.id)),
    })),
    // The current schema has no terrain entities. Other active placed bases are fixed obstacles.
    obstacles: circles.filter((circle) => !assigned.has(circle.id)),
  };
}
