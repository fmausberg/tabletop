import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { ManagementTable } from "@/app/(user)/components/management-table";
import { deleteBoard, duplicateBoard, saveBoard } from "./actions";

export const metadata: Metadata = { title: "Boards | Tabletop" };

export default async function BoardsPage() {
  await connection();
  const boards = await prisma.board.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { games: true } } } });
  return <ManagementTable title="Boards" singular="Board"
    rows={boards.map(({ _count, ...board }) => ({ ...board, locked: _count.games > 0 }))}
    fields={[
      { name: "name", label: "Name" },
      { name: "number", label: "Nummer", type: "number", optional: true, step: "1" },
      { name: "lengthCm", label: "Länge (cm)", type: "number", step: "any", min: 0 },
      { name: "widthCm", label: "Breite (cm)", type: "number", step: "any", min: 0 },
    ]}
    saveAction={saveBoard} deleteAction={deleteBoard} duplicateAction={duplicateBoard} />;
}
