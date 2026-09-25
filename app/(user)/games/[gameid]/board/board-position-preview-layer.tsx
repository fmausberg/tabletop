"use client";

import { Circle, Line } from "react-konva";
import type { BoardData } from "./board-model";
import { useBoardPositionPreview } from "./board-position-preview";

export function BoardPositionPreviewLayer({ data }: { data: BoardData }) {
  const { preview } = useBoardPositionPreview();
  if (!preview) return null;
  return <>{data.figures.flatMap((figure) => {
    const target = preview.positions[figure.id];
    if (!figure.position || figure.removed || !target
      || (target.x === figure.position.x && target.y === figure.position.y)) return [];
    return [
      <Circle key={`origin-${figure.id}`} x={figure.position.x} y={figure.position.y}
        radius={figure.baseDiameterCm / 2} stroke="#f59e0b" strokeWidth={1.5} strokeScaleEnabled={false}
        dash={[0.2, 0.2]} opacity={0.7} listening={false} />,
      <Line key={`shift-${figure.id}`} points={[figure.position.x, figure.position.y, target.x, target.y]}
        stroke="#f59e0b" strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />,
    ];
  })}</>;
}
