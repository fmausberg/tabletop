"use client";

import { useState } from "react";
import type { BoardData, BoardFigure, View } from "../board/board-model";
import type { BoardPhase } from "../board/board-phase";
import type { BoardFeedback } from "../board/use-board-feedback";
import type { Position } from "../movement/movement-rules";
import { movePlacedFigure, placeFigure } from "./placement-actions";
import { PlacementList } from "./placement-list";

export function usePlacementPhase(data: BoardData, camera: View, selectedId: string | null,
  select: (id: string | null) => void, feedback: BoardFeedback): BoardPhase {
  const [localPositions, setLocalPositions] = useState<Record<string, Position>>({});
  const positionOf = (figure: BoardFigure) => localPositions[figure.id] ?? figure.position!;
  const selected = data.figures.find((figure) => figure.id === selectedId && !figure.removed);

  return {
    canSelect: (figure) => !figure.removed,
    positionOf,
    preserveSelectionOnPan: true,
    trackCursor: false,
    showFigurePicker: false,
    showWounds: true,
    selectionHint: "Wähle eine Figur aus der Liste aus.",
    instructions: "Platzierte Figuren lassen sich ziehen; die Base bleibt vollständig auf dem Spielfeld.",
    controls: <PlacementList data={data} selectedId={selectedId} pending={feedback.pending}
      onSelect={(id) => { select(id); feedback.clear(); }} />,
    onContextMenu(position) {
      if (feedback.saving.current) return;
      feedback.clear();
      if (!selected) { feedback.setError("Wähle zuerst eine Figur aus."); return; }
      if (selected.position) { feedback.setError("Diese Figur wurde bereits platziert."); return; }
      feedback.run(async () => {
        try {
          const result = await placeFigure(data.gameId, selected.id, position.x, position.y);
          if (result.error) feedback.setError(result.error);
          else feedback.setMessage(`${selected.name} wurde platziert.`);
        } catch {
          feedback.setError("Die Figur konnte nicht platziert werden. Bitte versuche es erneut.");
        }
      });
    },
    figureProps(figure) {
      const radius = figure.baseDiameterCm / 2;
      return {
        draggable: !feedback.pending,
        onDragStart() { select(figure.id); feedback.clear(); },
        dragBoundFunc: (position) => ({
          x: Math.max(camera.x + radius * camera.scale, Math.min(camera.x + (data.lengthCm - radius) * camera.scale, position.x)),
          y: Math.max(camera.y + radius * camera.scale, Math.min(camera.y + (data.widthCm - radius) * camera.scale, position.y)),
        }),
        onDragEnd(event) {
          if (feedback.saving.current) { event.target.position(positionOf(figure)); return; }
          const previous = positionOf(figure);
          const next = { x: event.target.x(), y: event.target.y() };
          setLocalPositions((positions) => ({ ...positions, [figure.id]: next }));
          feedback.run(async () => {
            try {
              const result = await movePlacedFigure(data.gameId, figure.id, next.x, next.y);
              if (result.error) {
                feedback.setError(result.error);
                setLocalPositions((positions) => ({ ...positions, [figure.id]: previous }));
              } else feedback.setMessage(`${figure.name} wurde verschoben.`);
            } catch {
              feedback.setError("Die Figur konnte nicht verschoben werden. Bitte versuche es erneut.");
              setLocalPositions((positions) => ({ ...positions, [figure.id]: previous }));
            }
          });
        },
      };
    },
  };
}
