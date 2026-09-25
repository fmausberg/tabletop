import type { ReactNode } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import type { BoardFigure } from "./board-model";
import type { Position } from "./movement-rules";

export type BoardPhase = {
  canSelect: (figure: BoardFigure) => boolean;
  positionOf: (figure: BoardFigure) => Position;
  preserveSelectionOnPan: boolean;
  trackCursor: boolean;
  showFigurePicker: boolean;
  showWounds: boolean;
  selectionHint: string;
  instructions: string;
  controls?: ReactNode;
  preview?: ReactNode;
  details?: ReactNode;
  onContextMenu?: (position: Position) => void;
  figureProps?: (figure: BoardFigure) => {
    draggable: boolean;
    onDragStart: () => void;
    onDragEnd: (event: KonvaEventObject<DragEvent>) => void;
    dragBoundFunc: (position: Position) => Position;
  };
};
