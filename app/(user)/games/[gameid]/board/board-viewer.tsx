"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { BoardData } from "./board-model";

const BoardCanvas = dynamic(() => import("./board-canvas"), {
  ssr: false,
  loading: () => <div className="flex h-[60vh] items-center justify-center rounded-lg bg-zinc-100 text-zinc-600" role="status">Spielfeld wird geladen…</div>,
});

export type BoardViewerProps = {
  data: BoardData;
  interaction: BoardData["currentPhase"] | "READ_ONLY";
  sidebar?: ReactNode;
  showDice?: boolean;
  fadedFigureIds?: string[];
  figureOutlineColors?: Record<string, string>;
  movementTrails?: { id: string; from: { x: number; y: number }; to: { x: number; y: number }; color: string }[];
};

export function BoardViewer({ data, interaction, sidebar, showDice = true, fadedFigureIds, figureOutlineColors, movementTrails }: BoardViewerProps) {
  if (![data.lengthCm, data.widthCm].every((value) => Number.isFinite(value) && value > 0)) {
    return <p role="alert">Das Spielfeld hat keine gültigen Abmessungen.</p>;
  }
  return <BoardCanvas data={data} interaction={interaction} sidebar={sidebar} showDice={showDice} fadedFigureIds={fadedFigureIds} figureOutlineColors={figureOutlineColors} movementTrails={movementTrails} />;
}
