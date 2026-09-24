"use client";

import dynamic from "next/dynamic";
import type { BoardData } from "./board-model";

const BoardCanvas = dynamic(() => import("./board-canvas"), {
  ssr: false,
  loading: () => <div className="flex h-[60vh] items-center justify-center rounded-lg bg-zinc-100 text-zinc-600" role="status">Spielfeld wird geladen…</div>,
});

export function BoardViewer({ data }: { data: BoardData }) {
  return <BoardCanvas data={data} />;
}
