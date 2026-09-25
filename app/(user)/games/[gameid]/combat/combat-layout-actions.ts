"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { readCombatData } from "./combat-data";
import { combatEvaluationIssue, type CombatData } from "./combat-model";
import { separationInput, type CombatLayoutPreview } from "./combat-layout-model";
import { separateCombats, validateSeparation } from "./combat-separation";
import { storeCombatPositions } from "./combat-position-storage";

class LayoutError extends Error {}

function checkedData(data: CombatData | null, round: number, revision: string): CombatData {
  if (!data) throw new LayoutError("Das Spiel existiert nicht mehr.");
  if (data.phase !== "COMBAT" || data.round !== round) throw new LayoutError("Runde oder Phase wurde geändert. Die Entzerrung ist nur in der aktuellen Nahkampfphase möglich.");
  if (data.revision !== revision) throw new LayoutError("Positionen oder Nahkämpfe wurden inzwischen geändert. Bitte aktualisiere die Ansicht und berechne eine neue Vorschau.");
  const issue = combatEvaluationIssue(data);
  if (issue) throw new LayoutError(issue);
  return data;
}

function calculate(data: CombatData): CombatLayoutPreview {
  const input = separationInput(data);
  if (!input) throw new LayoutError("Alle Nahkämpfer müssen zuerst auf dem Spielfeld platziert sein.");
  const result = separateCombats(input);
  if (!result || !validateSeparation(input, result.offsets).valid) {
    throw new LayoutError("Es wurde keine gültige Anordnung ohne Überschneidungen gefunden. Schaffe mehr Platz oder ändere die Nahkampfzuordnung. Es wurden keine Positionen geändert.");
  }
  const id = createHash("sha256").update(JSON.stringify([data.revision, result])).digest("hex");
  return { ...result, id, revision: data.revision };
}

export async function previewCombatLayout(gameId: string, round: number, revision: string): Promise<
  { error: null; plan: CombatLayoutPreview } | { error: string; plan?: never }
> {
  try {
    const data = await prisma.$transaction((tx) => readCombatData(tx, gameId), { isolationLevel: "RepeatableRead" });
    return { error: null, plan: calculate(checkedData(data, round, revision)) };
  } catch (error) {
    return { error: error instanceof LayoutError ? error.message : "Die Vorschau konnte nicht berechnet werden. Bitte versuche es erneut." };
  }
}

export async function confirmCombatLayout(gameId: string, round: number, revision: string, planId: string) {
  try {
    // Recompute outside the write transaction. Client coordinates are never trusted.
    const data = checkedData(await prisma.$transaction((tx) => readCombatData(tx, gameId), {
      isolationLevel: "RepeatableRead",
    }), round, revision);
    const plan = calculate(data);
    if (plan.id !== planId) throw new LayoutError("Diese Vorschau ist nicht mehr gültig. Bitte berechne sie erneut.");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const current = checkedData(await readCombatData(tx, gameId), round, revision);
      const input = separationInput(current);
      if (!input || !validateSeparation(input, plan.offsets).valid) throw new LayoutError("Die Anordnung ist nicht mehr gültig. Es wurden keine Positionen geändert.");
      await storeCombatPositions(tx, current, plan.positions);
    }, { timeout: 15000 });
    revalidatePath(`/games/${gameId}/board`);
    revalidatePath(`/games/${gameId}`);
    return { error: null };
  } catch (error) {
    return { error: error instanceof LayoutError ? error.message : "Die Speicherung konnte nicht bestätigt werden. Bitte aktualisiere die Ansicht, bevor du es erneut versuchst." };
  }
}
