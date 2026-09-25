"use client";

import { Circle, Line } from "react-konva";
import type { BoardData, BoardFigure } from "./board-model";
import type { BoardPhase } from "./board-phase";
import type { BoardFeedback } from "./use-board-feedback";
import { calculateMovement, remainingMovement, type Position } from "./movement-rules";
import { moveFigure } from "./movement-actions";

export function movementPhase(data: BoardData, selectedId: string | null,
  cursorWorld: Position | null, feedback: BoardFeedback): BoardPhase {
  const canSelect = (figure: BoardFigure) => !figure.removed && Boolean(figure.position) && !figure.engaged;
  const selected = data.figures.find((figure) => figure.id === selectedId && canSelect(figure));
  const figures = data.figures.filter((figure) => figure.position && !figure.removed);
  const positionOf = (figure: BoardFigure) => figure.position!;
  const player = (id: string) => data.participants.find((participant) => participant.id === id);
  const movementPreview = selected?.position && cursorWorld
    ? calculateMovement(selected.position, cursorWorld, selected.baseDiameterCm,
      remainingMovement(selected.speedCm, selected.movementDistanceCm),
      figures.filter((figure) => figure.participantId !== selected.participantId)
        .map((figure) => ({ ...figure, position: positionOf(figure) }))).target
    : null;

  return {
    canSelect, positionOf,
    preserveSelectionOnPan: false,
    trackCursor: true,
    showFigurePicker: true,
    showWounds: false,
    selectionHint: "Wähle eine platzierte Figur aus.",
    instructions: "Figur links auswählen und mit Rechtsklick bewegen; die Base bleibt vollständig auf dem Spielfeld.",
    onContextMenu(position) {
      if (feedback.saving.current) return;
      feedback.clear();
      if (!selected) { feedback.setError("Wähle zuerst eine Figur aus."); return; }
      if (!selected.position) { feedback.setError("Diese Figur wurde noch nicht platziert."); return; }
      feedback.run(async () => {
        try {
          const result = await moveFigure(data.gameId, selected.id, position.x, position.y);
          if (result.error) feedback.setError(result.error);
          else feedback.setMessage("engaged" in result && result.engaged
            ? `${selected.name} wurde bewegt und in einen Nahkampf gebunden.`
            : "limited" in result && result.limited
              ? `${selected.name} wurde bis zum Ende der verbleibenden Reichweite bewegt.`
              : `${selected.name} wurde bewegt.`);
        } catch {
          feedback.setError("Die Figur konnte nicht bewegt werden. Bitte versuche es erneut.");
        }
      });
    },
    preview: <>
      {selected && figures
        .filter((figure) => figure.participantId !== selected.participantId && !figure.engaged)
        .map((figure) => <Circle
          key={`control-zone-${figure.id}`}
          x={positionOf(figure).x}
          y={positionOf(figure).y}
          radius={figure.baseDiameterCm / 2 + 2}
          fill={player(figure.participantId)?.color ?? "#64748b"}
          stroke={player(figure.participantId)?.color ?? "#64748b"}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          opacity={0.18}
          listening={false}
        />)}
      {selected?.position && <Circle
        x={positionOf(selected).x}
        y={positionOf(selected).y}
        radius={remainingMovement(selected.speedCm, selected.movementDistanceCm) + selected.baseDiameterCm / 2}
        fill="rgba(34, 197, 94, 0.08)"
        stroke="#16a34a"
        strokeWidth={2}
        strokeScaleEnabled={false}
        listening={false}
      />}
      {selected?.position && cursorWorld && <Line
        points={[positionOf(selected).x, positionOf(selected).y, cursorWorld.x, cursorWorld.y]}
        stroke="#16a34a"
        strokeWidth={2}
        strokeScaleEnabled={false}
        lineCap="round"
        listening={false}
      />}
      {selected && movementPreview && <Circle
        x={movementPreview.x}
        y={movementPreview.y}
        radius={selected.baseDiameterCm / 2}
        fill={player(selected.participantId)?.color ?? "#64748b"}
        stroke="#16a34a"
        strokeWidth={2}
        strokeScaleEnabled={false}
        opacity={0.4}
        listening={false}
      />}
    </>,
    details: selected ? <>
      <div><dt className="text-zinc-500">Bewegt in Runde {data.currentRound}</dt><dd>{selected.movementDistanceCm.toFixed(1)} cm</dd></div>
      <div><dt className="text-zinc-500">Verbleibende Bewegung</dt><dd>{remainingMovement(selected.speedCm, selected.movementDistanceCm).toFixed(1)} cm</dd></div>
      <div><dt className="text-zinc-500">Nahkampf</dt><dd>{selected.engaged ? "Gebunden" : "Nicht gebunden"}</dd></div>
      <div><dt className="text-zinc-500">Geplante Bewegung</dt><dd className="tabular-nums">{cursorWorld && selected.position
        ? `${Math.hypot(cursorWorld.x - positionOf(selected).x, cursorWorld.y - positionOf(selected).y).toFixed(1)} cm`
        : "—"}</dd></div>
    </> : null,
  };
}
