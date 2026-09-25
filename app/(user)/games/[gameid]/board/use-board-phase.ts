"use client";

import type { BoardData, View } from "./board-model";
import type { BoardPhase } from "./board-phase";
import type { Position } from "./movement-rules";
import type { BoardFeedback } from "./use-board-feedback";
import { usePlacementPhase } from "./placement-phase";
import { movementPhase } from "./movement-phase";

const passivePhase: BoardPhase = {
  canSelect: (figure) => !figure.removed && Boolean(figure.position),
  positionOf: (figure) => figure.position!,
  preserveSelectionOnPan: false,
  trackCursor: false,
  showFigurePicker: true,
  showWounds: true,
  selectionHint: "Wähle eine platzierte Figur aus.",
  instructions: "Figuren können in dieser Phase nicht bewegt werden.",
};

export function useBoardPhase(data: BoardData, camera: View, selectedId: string | null,
  select: (id: string | null) => void, cursor: Position | null, feedback: BoardFeedback): BoardPhase {
  // Keep hook order and placement's optimistic positions stable across phase changes.
  const placement = usePlacementPhase(data, camera, selectedId, select, feedback);
  switch (data.currentPhase) {
    case "PLACEMENT": return placement;
    case "MOVEMENT": return movementPhase(data, selectedId, cursor, feedback);
    default: return passivePhase;
  }
}
