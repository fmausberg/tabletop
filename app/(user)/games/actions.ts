"use server";

import { prisma } from "@/lib/prisma";
import { managementError, refreshManagement } from "@/lib/management";

export async function saveGame(id: string | null, form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const boardId = String(form.get("boardId") ?? "").trim();
  if (!name) return { error: "Bitte gib einen Namen ein." };
  if (!boardId) return { error: "Bitte wähle ein Board aus." };
  try {
    const data = { name, boardId };
    if (id) await prisma.game.update({ where: { id }, data });
    else await prisma.game.create({ data });
  } catch (error) {
    return { error: managementError(error) };
  }
  refreshManagement();
  return { error: null };
}

export async function deleteGame(id: string) {
  try {
    await prisma.game.delete({ where: { id } });
  } catch (error) {
    return { error: managementError(error) };
  }
  refreshManagement();
  return { error: null };
}
