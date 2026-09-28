"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type BoardSelection = {
  selectedIds: ReadonlySet<string>;
  selectedId: string | null;
  select: (id: string | null) => void;
  selectMany: (ids: readonly string[]) => void;
  add: (id: string) => void;
  setSelected: (id: string, selected: boolean) => void;
};

const SelectionContext = createContext<BoardSelection | null>(null);

export function BoardSelectionProvider({ figureIds, children }: { figureIds: string[]; children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const select = useCallback((id: string | null) => setIds(id === null ? [] : [id]), []);
  const selectMany = useCallback((ids: readonly string[]) => setIds([...new Set(ids)]), []);
  const add = useCallback((id: string) => setIds((previous) => [...previous.filter((entry) => entry !== id), id]), []);
  const setSelected = useCallback((id: string, selected: boolean) => {
    setIds((previous) => selected ? [...previous.filter((entry) => entry !== id), id] : previous.filter((entry) => entry !== id));
  }, []);
  const available = new Set(figureIds);
  const current = ids.filter((id) => available.has(id));
  return <SelectionContext.Provider value={{
    selectedIds: new Set(current), selectedId: current.at(-1) ?? null, select, selectMany, add, setSelected,
  }}>{children}</SelectionContext.Provider>;
}

export function useBoardSelection() {
  const selection = useContext(SelectionContext);
  if (!selection) throw new Error("BoardSelectionProvider fehlt.");
  return selection;
}
