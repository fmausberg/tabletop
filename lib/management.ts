import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export function refreshManagement() {
  revalidatePath("/boards");
  revalidatePath("/games");
}

export function managementError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") return "Der Eintrag wird noch verwendet oder das ausgewählte Board existiert nicht mehr.";
    if (error.code === "P2025") return "Der Eintrag existiert nicht mehr. Bitte lade die Seite neu.";
  }
  return "Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.";
}
