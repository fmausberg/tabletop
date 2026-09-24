import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function getGameDetails(gameid: string) {
  const game = await prisma.game.findUnique({
    where: { id: gameid },
    include: {
      board: { select: { name: true } },
      figures: {
        orderBy: [{ participant: { user: { name: "asc" } } }, { character: { name: "asc" } }, { number: "asc" }, { id: "asc" }],
        include: {
          character: { select: { name: true } },
          participant: { select: { user: { select: { name: true } } } },
        },
      },
      participants: { orderBy: { user: { name: "asc" } }, include: { user: { select: { id: true, name: true, email: true } } } },
      rounds: {
        orderBy: { number: "desc" },
        take: 1,
        select: { number: true, phases: { select: { type: true } } },
      },
    },
  });
  if (!game) notFound();

  const [characters, players] = await Promise.all([
    prisma.character.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  return { game, characters, players };
}

export type GameDetails = Awaited<ReturnType<typeof getGameDetails>>;
