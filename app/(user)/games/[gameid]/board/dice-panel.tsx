"use client";

import { useState } from "react";
import type { BoardData } from "./board-model";

type DiceRoll = {
  id: string;
  playerName: string;
  playerColor: string;
  diceCount: number;
  results: number[];
};

function rollD6(count: number) {
  const values = new Uint32Array(count);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value % 6 + 1).sort((a, b) => b - a);
}

export function DicePanel({ participants }: { participants: BoardData["participants"] }) {
  const [rolls, setRolls] = useState<DiceRoll[]>([]);

  function roll(participantId: string, diceCount: number) {
    const participant = participants.find((entry) => entry.id === participantId);
    if (!participant) return;

    setRolls((current) => [{
      id: crypto.randomUUID(),
      playerName: participant.name,
      playerColor: participant.color,
      diceCount,
      results: rollD6(diceCount),
    }, ...current]);
  }

  return (
    <aside className="min-w-0 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700" aria-labelledby="dice-heading">
      <h2 id="dice-heading" className="font-semibold">Würfel</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {participants.map((participant) => <section key={participant.id} className="min-w-0" aria-label={`Würfel für ${participant.name}`}>
          <h3 className="mb-2 break-words border-b-2 pb-1 text-sm font-medium" style={{ borderColor: participant.color }}>{participant.name}</h3>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <button
              key={count}
              type="button"
              className={`min-h-8 rounded-md border border-zinc-300 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 ${count === 10 ? "col-start-2" : ""}`}
              onClick={() => roll(participant.id, count)}
              aria-label={`${count} W6 für ${participant.name} werfen`}
            >{count}</button>)}
          </div>
        </section>)}
      </div>
      {!participants.length && <p className="mt-3 text-sm text-zinc-500">Keine Teilnehmer.</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-300 text-zinc-500 dark:border-zinc-700">
            <tr>
              <th className="pb-2 pr-2 text-center font-medium">W6</th>
              <th className="pb-2 font-medium">Ergebnisse</th>
            </tr>
          </thead>
          <tbody>
            {rolls.map((entry) => (
              <tr key={entry.id} style={{ color: entry.playerColor }} title={entry.playerName} className="border-b border-zinc-200 align-top last:border-0 dark:border-zinc-800">
                <td className="py-2 pr-2 text-center tabular-nums"><span className="sr-only">{entry.playerName}: </span>{entry.diceCount}</td>
                <td className="py-2 font-semibold tabular-nums">{entry.results.join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rolls.length && <p className="py-4 text-center text-xs text-zinc-500">Noch keine Würfe.</p>}
      </div>
    </aside>
  );
}
