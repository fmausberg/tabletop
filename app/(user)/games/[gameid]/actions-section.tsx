import type { ActionType, ShotResult } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import { phaseOrder } from "./game-phases";

const actionLabels: Record<ActionType, string> = { SHOT: "Schuss", MELEE: "Nahkampf" };
const shotLabels: Record<ShotResult, string> = {
  MISS: "Verfehlt", HIT_NO_WOUND: "Treffer ohne Wunde", WOUND: "Wunde",
};
const figureSelect = { number: true, character: { select: { name: true } } } as const;

function FigureLabel({ figure }: { figure: { number: number | null; character: { name: string } } }) {
  return <>{figure.character.name}{figure.number === null ? "" : ` ${figure.number}`}</>;
}

export async function ActionsSection({ gameId }: { gameId: string }) {
  const actions = await prisma.gameAction.findMany({
    where: { phase: { round: { gameId } } },
    include: {
      phase: { select: { type: true, round: { select: { number: true } } } },
      shot: { include: { shooter: { select: figureSelect }, target: { select: figureSelect } } },
      melee: { include: {
        winnerParticipant: { select: { user: { select: { name: true } } } },
        combatants: { orderBy: { id: "asc" }, include: { figure: { select: figureSelect } } },
      } },
      wounds: { orderBy: { id: "asc" }, include: { figure: { select: figureSelect } } },
    },
  });
  actions.sort((a, b) => a.phase.round.number - b.phase.round.number
    || phaseOrder[a.phase.type] - phaseOrder[b.phase.type]
    || a.sequence - b.sequence);

  return (
    <section aria-labelledby="actions-title">
      <h2 id="actions-title" className="mb-2 text-xl font-semibold">Actions <span className="text-sm font-normal text-zinc-500">({actions.length})</span></h2>
      <p className="mb-4 text-sm text-zinc-500">Nach Runde, Phase und Aktionsfolge sortiert.</p>
      <div className="overflow-x-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <caption className="sr-only">Spielaktionen mit Schuss-, Nahkampf- und Wundendetails</caption>
          <thead className="bg-zinc-100 dark:bg-zinc-900"><tr>
            {["Runde", "Reihenfolge", "Typ", "Schütze", "Ziel", "Schussergebnis", "Nahkämpfer", "Sieger", "Wunden (vorher → nachher)"].map((label) => <th scope="col" key={label} className="p-3">{label}</th>)}
          </tr></thead>
          <tbody>
            {actions.map((action) => <tr key={action.id} className="border-t border-zinc-200 align-top dark:border-zinc-800">
              <td className="p-3 tabular-nums">{action.phase.round.number}</td>
              <th scope="row" className="p-3 font-normal tabular-nums">{action.sequence}</th>
              <td className="p-3">{actionLabels[action.type]}</td>
              <td className="p-3">{action.shot ? <FigureLabel figure={action.shot.shooter} /> : "—"}</td>
              <td className="p-3">{action.shot ? <FigureLabel figure={action.shot.target} /> : "—"}</td>
              <td className="p-3">{action.shot ? shotLabels[action.shot.result] : "—"}</td>
              <td className="p-3">{action.melee?.combatants.length ? <ul className="space-y-2">{action.melee.combatants.map((combatant) => <li key={combatant.id}><FigureLabel figure={combatant.figure} /></li>)}</ul> : "—"}</td>
              <td className="p-3">{action.melee ? action.melee.winnerParticipant ? <>{action.melee.winnerParticipant.user.name}<span className="block font-mono text-xs text-zinc-500">{action.melee.winnerParticipantId}</span></> : "Kein Sieger festgelegt" : "—"}</td>
              <td className="p-3">{action.wounds.length ? <ul className="space-y-2">{action.wounds.map((wound) => <li key={wound.id}><FigureLabel figure={wound.figure} /><span className="tabular-nums">{wound.woundsBefore} → {wound.woundsAfter}</span></li>)}</ul> : "—"}</td>
            </tr>)}
            {!actions.length && <tr><td colSpan={9} className="p-8 text-center text-zinc-500">Noch keine Aktionen in diesem Spiel.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
