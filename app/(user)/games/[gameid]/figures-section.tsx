import type { Figure } from "@/generated/prisma/client";
import type { GameDetails } from "./game-details-data";
import { FiguresForm } from "./figures-form";
import { tableWrapper, table, rowBorder } from "./table-styles";

const figureColumns = [
  ["initialFightValueNear", "Nahkampf (Start)"],
  ["initialFightValueFar", "Fernkampf (Start)"],
  ["initialStrength", "Stärke (Start)"],
  ["initialDefense", "Verteidigung (Start)"],
  ["initialAttacks", "Attacken (Start)"],
  ["initialWounds", "Wunden (Start)"],
  ["initialCourage", "Mut (Start)"],
  ["currentFightValueNear", "Nahkampf (aktuell)"],
  ["currentFightValueFar", "Fernkampf (aktuell)"],
  ["currentStrength", "Stärke (aktuell)"],
  ["currentDefense", "Verteidigung (aktuell)"],
  ["currentAttacks", "Attacken (aktuell)"],
  ["currentWounds", "Wunden (aktuell)"],
  ["currentCourage", "Mut (aktuell)"],
  ["baseDiameterCm", "Basisdurchmesser (cm)"],
  ["speedCm", "Geschwindigkeit (cm)"],
] as const satisfies readonly (readonly [keyof Figure, string])[];

export function FiguresSection({ game, characters, players }: GameDetails) {
  return (
  <section aria-labelledby="figures-title">
    <h2 id="figures-title" className="mb-4 text-xl font-semibold">Figuren <span className="text-sm font-normal text-zinc-500">({game.figures.length})</span></h2>
    <FiguresForm gameId={game.id} characters={characters} players={players} />
    <div className={tableWrapper}>
      <table className={table}>
        <caption className="sr-only">Spieler, Figuren und ihre numerischen Attribute</caption>
        <thead className="bg-zinc-100 dark:bg-zinc-900"><tr>
          <th scope="col" className="p-3">Spieler</th>
          <th scope="col" className="p-3">Figur</th>
          {figureColumns.map(([key, label]) => <th scope="col" key={key} className="p-3">{label}</th>)}
        </tr></thead>
        <tbody>
          {game.figures.map((figure) => <tr key={figure.id} className={rowBorder}>
            <td className="p-3">{figure.participant.user.name}</td>
            <th scope="row" className="p-3 font-medium">{figure.character.name}{figure.number === null ? "" : ` ${figure.number}`}</th>
            {figureColumns.map(([key]) => <td key={key} className="p-3 tabular-nums">{figure[key] ?? "—"}</td>)}
          </tr>)}
          {!game.figures.length && <tr><td colSpan={figureColumns.length + 2} className="p-8 text-center text-zinc-500">Noch keine Figuren in diesem Spiel.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>
  );
}
