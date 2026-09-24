import type { GameDetails } from "./game-details-data";
import { phaseLabels } from "./game-phases";

export function MasterDataSection({ game }: Pick<GameDetails, "game">) {
  return (
  <section aria-labelledby="master-data-title">
    <h2 id="master-data-title" className="mb-4 text-xl font-semibold">Stammdaten</h2>
    <dl className="grid gap-4 rounded-lg border border-zinc-300 p-5 sm:grid-cols-3 dark:border-zinc-700">
      <div><dt className="text-sm text-zinc-500">Spiel-ID</dt><dd className="mt-1 break-all font-mono text-sm">{game.id}</dd></div>
      <div><dt className="text-sm text-zinc-500">Name</dt><dd className="mt-1">{game.name}</dd></div>
      <div><dt className="text-sm text-zinc-500">Board</dt><dd className="mt-1">{game.board.name}<span className="mt-1 block break-all font-mono text-xs text-zinc-500">{game.boardId}</span></dd></div>
      <div><dt className="text-sm text-zinc-500">Runde</dt><dd className="mt-1">{game.currentRound}</dd></div>
      <div><dt className="text-sm text-zinc-500">Aktuelle Phase</dt><dd className="mt-1">{phaseLabels[game.currentPhase]} ({game.currentPhase})</dd></div>
    </dl>
  </section>
  );
}
