"use client";

import { useState } from "react";
import type { BoardData } from "./board-model";

type DiceRoll = {
  id: string;
  playerName: string;
  diceCount: number;
  results: number[];
};

function rollD6(count: number) {
  const values = new Uint32Array(count);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value % 6 + 1).sort((a, b) => b - a);
}

export function DicePanel({ participants }: { participants: BoardData["participants"] }) {
  const [participantId, setParticipantId] = useState(participants[0]?.id ?? "");
  const [rolls, setRolls] = useState<DiceRoll[]>([]);

  function roll(diceCount: number) {
    const participant = participants.find((entry) => entry.id === participantId);
    if (!participant) return;

    setRolls((current) => [{
      id: crypto.randomUUID(),
      playerName: participant.name,
      diceCount,
      results: rollD6(diceCount),
    }, ...current]);
  }

  return (
    <aside className="min-w-0 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700" aria-labelledby="dice-heading">
      <h2 id="dice-heading" className="font-semibold">Würfel</h2>
      <label className="mt-3 block text-sm">
        Spieler
        <select
          className="mt-1.5 w-full rounded-md border border-zinc-300 bg-transparent p-2 dark:border-zinc-700"
          value={participantId}
          onChange={(event) => setParticipantId(event.target.value)}
          disabled={!participants.length}
        >
          {!participants.length && <option value="">Keine Teilnehmer</option>}
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id} className="bg-white text-zinc-900">
              {participant.name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid grid-cols-5 gap-1.5" aria-label="Anzahl der W6 auswählen">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
          <button
            key={count}
            type="button"
            className="min-h-10 rounded-md border border-zinc-300 font-semibold hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={() => roll(count)}
            disabled={!participantId}
            aria-label={`${count} W6 werfen`}
          >
            {count}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-300 text-zinc-500 dark:border-zinc-700">
            <tr>
              <th className="pb-2 pr-2 font-medium">Spieler</th>
              <th className="pb-2 pr-2 text-center font-medium">W6</th>
              <th className="pb-2 font-medium">Ergebnisse</th>
            </tr>
          </thead>
          <tbody>
            {rolls.map((entry) => (
              <tr key={entry.id} className="border-b border-zinc-200 align-top last:border-0 dark:border-zinc-800">
                <td className="py-2 pr-2 font-medium">{entry.playerName}</td>
                <td className="py-2 pr-2 text-center tabular-nums">{entry.diceCount}</td>
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
