"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { isCombatResolved, type CombatCommand, type CombatData } from "./combat-model";
import { useBoardSelection } from "../board-selection";

export const NEW_COMBAT = Symbol("new-combat");
type DropTarget = string | null | typeof NEW_COMBAT;

type AssignmentDrag = {
  figureId: string | null;
  pick: (id: string | null) => void;
  canPick: (id: string) => boolean;
  canDrop: (target: DropTarget) => boolean;
  drop: (target: DropTarget) => void;
};
const Context = createContext<AssignmentDrag | null>(null);

export function CombatAssignmentDragProvider({ data, disabled, onCommand, children }: {
  data: CombatData; disabled: boolean; children: ReactNode;
  onCommand: (command: CombatCommand, success: string) => void;
}) {
  const [picked, setPicked] = useState<{ id: string; revision: string } | null>(null);
  const figureId = !disabled && picked?.revision === data.revision ? picked.id : null;
  function canPick(id: string) {
    const figure = data.figures.find((entry) => entry.id === id);
    const source = data.combats.find((entry) => entry.figureIds.includes(id));
    return !disabled && Boolean(figure && !figure.removed && figure.participantGameId === data.gameId)
      && (!source || !isCombatResolved(source));
  }
  function canDrop(targetId: DropTarget) {
    if (!figureId || !canPick(figureId)) return false;
    if (targetId === NEW_COMBAT) return true;
    const source = data.combats.find((entry) => entry.figureIds.includes(figureId));
    const target = data.combats.find((entry) => entry.id === targetId);
    return (source?.id ?? null) !== targetId && (targetId === null || Boolean(target && !isCombatResolved(target)));
  }
  function drop(target: DropTarget) {
    if (!figureId || !canDrop(target)) return;
    const source = data.combats.find((entry) => entry.figureIds.includes(figureId));
    setPicked(null);
    if (target === NEW_COMBAT) {
      onCommand({ type: "create-assigned", figureId, fromCombatId: source?.id ?? null }, "Neuen Nahkampf angelegt und Figur zugeordnet.");
    } else {
      onCommand({ type: "assign", figureId, fromCombatId: source?.id ?? null, toCombatId: target }, "Figurenzuordnung gespeichert.");
    }
  }
  return <Context.Provider value={{ figureId, canPick, canDrop, drop,
    pick: (id) => setPicked(id && canPick(id) ? { id, revision: data.revision } : null),
  }}>{children}</Context.Provider>;
}

function useAssignmentDrag() {
  const context = useContext(Context);
  if (!context) throw new Error("CombatAssignmentDragProvider fehlt.");
  return context;
}

export function CombatDragHandle({ figureId, name }: { figureId: string; name: string }) {
  const drag = useAssignmentDrag();
  const { selectedIds, select, add } = useBoardSelection();
  function selectFigure(additive: boolean) {
    if (additive) add(figureId);
    else select(figureId);
  }
  return <button type="button" draggable={drag.canPick(figureId)} disabled={!drag.canPick(figureId)}
    aria-label={`${name} auswählen oder verschieben`} aria-pressed={selectedIds.has(figureId)}
    title="Ziehen oder anklicken und anschließend das Ziel wählen"
    className="min-w-0 flex-1 cursor-grab break-words text-left text-sm font-medium active:cursor-grabbing disabled:cursor-default"
    onPointerDown={(event) => { if (event.button === 0) selectFigure(event.ctrlKey); }}
    onClick={(event) => {
      if (event.detail === 0) selectFigure(event.ctrlKey);
      drag.pick(drag.figureId === figureId ? null : figureId);
    }}
    onKeyDown={(event) => { if (event.key === "Escape") drag.pick(null); }}
    onDragStart={(event) => {
      if (!drag.canPick(figureId)) { event.preventDefault(); return; }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", figureId);
      drag.pick(figureId);
    }}
    onDragEnd={() => drag.pick(null)}>
    <span aria-hidden="true" className="mr-1 opacity-50">⠿</span>{name}
  </button>;
}

export function CombatDropZone({ combatId, children }: { combatId: DropTarget; children: ReactNode }) {
  const drag = useAssignmentDrag();
  const [hovered, setHovered] = useState(false);
  const allowed = drag.canDrop(combatId);
  return <div className={`min-w-0 rounded-lg ${allowed ? hovered ? "ring-2 ring-blue-500" : "ring-1 ring-blue-400/50" : ""}`}
    onDragOver={(event) => { if (allowed) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setHovered(true); } }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false); }}
    onDrop={(event) => { event.preventDefault(); setHovered(false); if (allowed) drag.drop(combatId); }}>
    {children}
    {allowed && <button type="button" className="w-full rounded-b-lg bg-blue-500/10 px-2 py-1 text-xs hover:bg-blue-500/20"
      onClick={() => drag.drop(combatId)}>Hier ablegen</button>}
  </div>;
}
