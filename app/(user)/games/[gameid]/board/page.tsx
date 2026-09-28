import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { boardPhasePath } from "./board-routes";

export default async function BoardPage({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const game = await prisma.game.findUnique({ where: { id: gameid }, select: { currentPhase: true, setupCompleted: true } });
  if (!game) notFound();
  if (!game.setupCompleted) redirect(`/games/${gameid}`);
  redirect(boardPhasePath(gameid, game.currentPhase));
}
