"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function userError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "Diese E-Mail-Adresse wird bereits verwendet.";
    if (error.code === "P2003") return "Dieser Benutzer nimmt an Spielen teil und kann nicht gelöscht werden.";
    if (error.code === "P2025") return "Dieser Benutzer existiert nicht mehr.";
  }
  return "Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.";
}

function refreshUsers() {
  revalidatePath("/user");
  revalidatePath("/games/[gameid]", "page");
}

export async function saveUser(id: string | null, form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  if (!name) return { error: "Bitte gib einen Namen ein." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Bitte gib eine gültige E-Mail-Adresse ein." };
  try {
    if (id) await prisma.user.update({ where: { id }, data: { name, email } });
    else await prisma.user.create({ data: { name, email } });
  } catch (error) {
    return { error: userError(error) };
  }
  refreshUsers();
  return { error: null };
}

export async function deleteUser(id: string) {
  try {
    await prisma.user.delete({ where: { id } });
  } catch (error) {
    return { error: userError(error) };
  }
  refreshUsers();
  return { error: null };
}
