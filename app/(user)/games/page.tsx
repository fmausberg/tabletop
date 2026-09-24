import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { ManagementTable } from "@/app/(user)/components/management-table";
import { deleteGame, saveGame } from "./actions";

export const metadata: Metadata = { title: "Games | Tabletop" };

export default async function GamesPage() {
  await connection();
  const [games, boards] = await Promise.all([
    prisma.game.findMany({ orderBy: { name: "asc" } }),
    prisma.board.findMany({ orderBy: { name: "asc" } }),
  ]);
  return <ManagementTable title="Games" singular="Spiel" rows={games} needsBoard={!boards.length} detailPath="/games"
    fields={[
      { name: "name", label: "Name" },
      { name: "boardId", label: "Board", type: "select", options: boards.map((board) => ({ value: board.id, label: `${board.name}${board.number === null ? "" : ` · Nr. ${board.number}`} (${board.lengthCm} × ${board.widthCm} cm)` })) },
    ]}
    saveAction={saveGame} deleteAction={deleteGame} />;
}
