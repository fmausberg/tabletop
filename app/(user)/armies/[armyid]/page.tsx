import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArmyFigures } from "./army-figures";

export const metadata: Metadata = { title: "Armee | Tabletop" };

export default async function ArmyPage({ params }: { params: Promise<{ armyid: string }> }) {
  const { armyid } = await params;
  const [army, characters] = await Promise.all([
    prisma.army.findUnique({ where: { id: armyid }, include: {
      figures: { orderBy: [{ platoon: "asc" }, { id: "asc" }], include: { character: { select: { name: true, points: true, short: true } } } },
    } }),
    prisma.character.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, number: true, points: true } }),
  ]);
  if (!army) notFound();
  const owner = await prisma.user.findUnique({ where: { id: army.ownerId }, select: { name: true } });
  return <main lang="de" className="mx-auto w-full max-w-[1600px] p-4 sm:p-8">
    <Link href="/armies" className="text-sm underline underline-offset-4">Zurück zu den Armeen</Link>
    <h1 className="mt-3 text-3xl font-semibold">{army.name}</h1>
    <p className="mb-6 mt-2 text-sm text-zinc-500">Besitzer: {owner?.name ?? "Benutzer nicht mehr vorhanden"} · {army.figures.length} Figuren · {army.figures.reduce((sum, figure) => sum + figure.character.points, 0)} Punkte</p>
    <ArmyFigures armyId={army.id} figures={army.figures} characters={characters} />
  </main>;
}
