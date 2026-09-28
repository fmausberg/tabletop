import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { boardPhasePath } from "./board-routes";

export default async function BoardPage({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const game = await prisma.game.findUnique({ where: { id: gameid }, select: { currentPhase: true } });
  if (!game) notFound();
  redirect(boardPhasePath(gameid, game.currentPhase));
}
