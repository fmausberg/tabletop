"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { CharacterType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { numericFields } from "./fields";

function errorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "That character number is already taken.";
    if (error.code === "P2003") return "This character is used in a game and cannot be deleted.";
    if (error.code === "P2025") return "This character no longer exists. Refresh the page.";
  }
  return "Could not save your changes. Please try again.";
}

export async function saveCharacter(id: string | null, form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const type = String(form.get("type") ?? "") as CharacterType;
  if (!name) return { error: "Please enter a name." };
  if (!Object.values(CharacterType).includes(type)) return { error: "Please select a character type." };

  const values: Record<string, number | null> = {};
  for (const field of numericFields) {
    const raw = String(form.get(field.name) ?? "").trim();
    if (!raw && field.optional) {
      values[field.name] = null;
      continue;
    }
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || (!field.decimal && (!Number.isInteger(value) || value < -2147483648 || value > 2147483647))) {
      return { error: `Enter a valid ${field.decimal ? "number" : "whole number"} for ${field.label.toLowerCase()}.` };
    }
    values[field.name] = value;
  }

  const data = { name, type, ...values } as Prisma.CharacterCreateInput;
  try {
    if (id) await prisma.character.update({ where: { id }, data });
    else await prisma.character.create({ data });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/characters");
  return { error: null };
}

export async function deleteCharacter(id: string) {
  try {
    await prisma.character.delete({ where: { id } });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  revalidatePath("/characters");
  return { error: null };
}
