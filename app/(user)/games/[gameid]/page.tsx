import type { Metadata } from "next";
import Link from "next/link";
import { getGameDetails } from "./game-details-data";
import { MasterDataSection } from "./master-data-section";
import { ParticipantsSection } from "./participants-section";
import { FiguresSection } from "./figures-section";
import { ActionsSection } from "./actions-section";
import { MovementsSection } from "./movements-section";

export const metadata: Metadata = { title: "Spieldetails | Tabletop" };

export default async function GameDetailsPage({ params }: { params: Promise<{ gameid: string }> }) {
  const { gameid } = await params;
  const data = await getGameDetails(gameid);
  const { game, players } = data;

  return (
    <main lang="de" className="mx-auto w-full max-w-[1600px] space-y-8 p-4 sm:p-8">
      <header>
        <Link href="/games" className="text-sm underline underline-offset-4">Zurück zu Games</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{game.name}</h1>
      </header>

      <MasterDataSection game={game} />
      <ParticipantsSection gameId={game.id} users={players} participants={game.participants} />
      <FiguresSection {...data} />
      <ActionsSection gameId={game.id} />
      <MovementsSection gameId={game.id} />
    </main>
  );
}
