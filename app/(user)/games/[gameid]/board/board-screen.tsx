import type { ReactNode } from "react";
import Link from "next/link";
import { RoundControls } from "../round-controls";
import { BoardPositionPreviewProvider } from "./board-position-preview";
import type { loadBoardData } from "./board-data";

type Snapshot = Awaited<ReturnType<typeof loadBoardData>>;
export function BoardScreen({ snapshot: { game, data, combatData }, children, readOnly = false }:
  { snapshot: Snapshot; children: ReactNode; readOnly?: boolean }) {
  return (
    <main lang="de" className="mx-auto w-full max-w-[1600px] p-4 sm:p-8">
      <Link href={`/games/${game.id}`} className="text-sm underline underline-offset-4">Zurück zum Spiel</Link>
      <h1 className="mt-3 text-3xl font-semibold">
        {game.name} · Spielfeld <span className="text-sm font-normal text-zinc-500">· {game.board.name} · {data.lengthCm} × {data.widthCm} cm</span>
      </h1>
      {!readOnly && <RoundControls gameId={game.id} round={game.currentRound} phase={game.currentPhase} />}
      <BoardPositionPreviewProvider scope={JSON.stringify([data, combatData?.revision])}>
        {children}
      </BoardPositionPreviewProvider>
    </main>
  );
}
