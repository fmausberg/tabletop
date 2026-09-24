import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { CharactersTable } from "./characters-table";

export const metadata: Metadata = { title: "Characters | Tabletop" };

export default async function CharactersPage() {
  await connection();
  const characters = await prisma.character.findMany({ orderBy: { name: "asc" } });
  return <CharactersTable characters={characters} />;
}
