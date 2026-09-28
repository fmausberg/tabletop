"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function failure(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return { error: "Der Eintrag existiert nicht mehr. Bitte lade die Ansicht neu." };
    if (error.code === "P2003") return { error: "Das Charakterprofil oder die Armee existiert nicht mehr oder wird noch verwendet." };
  }
  return { error: "Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut." };
}

function refresh(armyId?: string) {
  revalidatePath("/armies");
  if (armyId) revalidatePath(`/armies/${armyId}`);
}

export async function saveArmy(id: string | null, form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const ownerId = String(form.get("ownerId") ?? "").trim();
  if (!name) return { error: "Bitte gib einen Namen ein." };
  if (!ownerId) return { error: "Bitte wähle einen Besitzer aus." };
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (!await tx.user.findUnique({ where: { id: ownerId } })) return { error: "Dieser Benutzer existiert nicht mehr." };
      if (id) await tx.army.update({ where: { id }, data: { name, ownerId } });
      else await tx.army.create({ data: { name, ownerId } });
      return { error: null };
    });
    if (result.error) return result;
  } catch (error) { return failure(error); }
  refresh(id ?? undefined);
  return { error: null };
}

export async function deleteArmy(id: string) {
  try { await prisma.army.delete({ where: { id } }); }
  catch (error) { return failure(error); }
  refresh(id);
  return { error: null };
}

export async function addArmyFigure(armyId: string, form: FormData) {
  const characterId = String(form.get("characterId") ?? "").trim();
  const rawPlatoon = String(form.get("platoon") ?? "").trim();
  const platoon = Number(rawPlatoon);
  if (!characterId) return { error: "Bitte wähle ein Charakterprofil aus." };
  if (!rawPlatoon || !Number.isSafeInteger(platoon) || platoon < 0 || platoon > 2147483647) {
    return { error: "Die Zugnummer muss eine ganze Zahl zwischen 0 und 2147483647 sein." };
  }
  try {
    // Foreign keys validate both army and character; repeated profiles are allowed.
    await prisma.armyFigure.create({ data: { armyId, characterId, platoon } });
  } catch (error) { return failure(error); }
  refresh(armyId);
  return { error: null };
}

export async function deleteArmyFigure(armyId: string, figureId: string) {
  try { await prisma.armyFigure.delete({ where: { id: figureId, armyId } }); }
  catch (error) { return failure(error); }
  refresh(armyId);
  return { error: null };
}
