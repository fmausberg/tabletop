import type { ReactNode } from "react";
import Link from "next/link";
import { RoundControls } from "../round-controls";
import { BoardPositionPreviewProvider } from "./board-position-preview";
import { BoardSelectionProvider } from "./board-selection";
import type { loadBoardData } from "./board-data";

type Snapshot = Awaited<ReturnType<typeof loadBoardData>>;
export function BoardScreen({ snapshot: { game, data, combatData, initiativeWinnerName }, children, readOnly = false }:
  { snapshot: Snapshot; children: ReactNode; readOnly?: boolean }) {
  return (
    <main lang="de" className="mx-auto w-full max-w-[1600px] px-4 py-3 sm:px-8">
      <RoundControls gameId={game.id} round={game.currentRound} phase={game.currentPhase} initiativeWinnerName={initiativeWinnerName} readOnly={readOnly} phaseLocked={combatData?.assignmentsLocked}>
        <h1 className="text-sm font-semibold"><Link href={`/games/${game.id}`} className="hover:underline" title="Zurück zum Spiel">{game.name}</Link></h1>
        <span aria-hidden="true" className="text-zinc-400">|</span>
        <span title={`${data.lengthCm} × ${data.widthCm} cm`}>{game.board.name}</span>
        <span aria-hidden="true" className="text-zinc-400">|</span>
      </RoundControls>
      <BoardPositionPreviewProvider scope={JSON.stringify([data, combatData?.revision])}>
        <BoardSelectionProvider key={`${data.gameId}-${data.currentRound}-${data.currentPhase}`}
          figureIds={data.figures.filter((figure) => !figure.removed).map((figure) => figure.id)}>
          {children}
        </BoardSelectionProvider>
      </BoardPositionPreviewProvider>
    </main>
  );
}
