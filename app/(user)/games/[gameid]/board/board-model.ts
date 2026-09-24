export type BoardFigure = {
  id: string;
  name: string;
  short: string;
  participantId: string;
  wounds: number;
  baseDiameterCm: number;
  speedCm: number;
  movementDistanceCm: number;
  engaged: boolean;
  position: { x: number; y: number } | null;
  removed: boolean;
};

export type BoardData = {
  gameId: string;
  currentRound: number;
  currentPhase: PhaseType;
  lengthCm: number;
  widthCm: number;
  participants: { id: string; name: string; color: string }[];
  figures: BoardFigure[];
};

export type View = { x: number; y: number; scale: number };

export function fitBoard(width: number, height: number, lengthCm: number, widthCm: number): View {
  const scale = Math.min(Math.max(1, width - 64) / lengthCm, Math.max(1, height - 64) / widthCm);
  return { scale, x: (width - lengthCm * scale) / 2, y: (height - widthCm * scale) / 2 };
}

export function zoomAt(view: View, pointer: { x: number; y: number }, scale: number): View {
  return {
    scale,
    x: pointer.x - (pointer.x - view.x) / view.scale * scale,
    y: pointer.y - (pointer.y - view.y) / view.scale * scale,
  };
}
import type { PhaseType } from "@/generated/prisma/enums";
