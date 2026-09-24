"use server";

import { prisma } from "@/lib/prisma";
import { managementError, refreshManagement } from "@/lib/management";

export async function saveBoard(id: string | null, form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const rawNumber = String(form.get("number") ?? "").trim();
  const number = rawNumber ? Number(rawNumber) : null;
  const lengthCm = Number(form.get("lengthCm"));
  const widthCm = Number(form.get("widthCm"));
  if (!name) return { error: "Bitte gib einen Namen ein." };
  if (number !== null && (!Number.isInteger(number) || number < -2147483648 || number > 2147483647)) return { error: "Die Nummer muss eine ganze Zahl sein." };
  if (![lengthCm, widthCm].every((value) => Number.isFinite(value) && value > 0)) return { error: "Länge und Breite müssen größer als 0 sein." };
  const data = { name, number, lengthCm, widthCm };
  try {
    if (id) {
      const result = await prisma.$transaction(async (tx) => {
        // Lock the board while checking usage; new game references must wait.
        await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${id} FOR UPDATE`;
        if (await tx.game.count({ where: { boardId: id } })) return { error: "Dieses Board wird in einem Spiel verwendet und kann nicht bearbeitet werden." };
        await tx.board.update({ where: { id }, data });
        return { error: null };
      });
      if (result.error) return result;
    } else {
      await prisma.board.create({ data });
    }
  } catch (error) {
    return { error: managementError(error) };
  }
  refreshManagement();
  return { error: null };
}

export async function deleteBoard(id: string) {
  try {
    await prisma.board.delete({ where: { id } });
  } catch (error) {
    return { error: managementError(error) };
  }
  refreshManagement();
  return { error: null };
}

export async function duplicateBoard(id: string) {
  try {
    const board = await prisma.board.findUniqueOrThrow({ where: { id } });
    await prisma.board.create({ data: {
      name: `${board.name} (Kopie)`,
      number: board.number,
      lengthCm: board.lengthCm,
      widthCm: board.widthCm,
    } });
  } catch (error) {
    return { error: managementError(error) };
  }
  refreshManagement();
  return { error: null };
}
