"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type BoardPositionPreview = {
  id: string;
  positions: Record<string, { x: number; y: number }>;
};

const PreviewContext = createContext<{
  preview: BoardPositionPreview | null;
  setPreview: (preview: BoardPositionPreview | null) => void;
}>({ preview: null, setPreview: () => {} });

export function BoardPositionPreviewProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const [state, setState] = useState<{ scope: string; preview: BoardPositionPreview | null }>({ scope, preview: null });
  return <PreviewContext.Provider value={{
    // Any server refresh changing the board invalidates its unsaved preview.
    preview: state.scope === scope ? state.preview : null,
    setPreview: (preview) => setState({ scope, preview }),
  }}>{children}</PreviewContext.Provider>;
}

export function useBoardPositionPreview() {
  return useContext(PreviewContext);
}
