"use client";

import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { fitBoard, zoomAt, type BoardData, type View } from "./board-model";
import { DicePanel } from "./dice-panel";
import type { BoardViewerProps } from "./board-viewer";
import { useBoardPhase } from "./use-board-phase";
import { useBoardFeedback } from "./use-board-feedback";
import { useBoardPositionPreview } from "./board-position-preview";
import { BoardPositionPreviewLayer } from "./board-position-preview-layer";
import { useBoardSelection } from "./board-selection";

export default function BoardCanvas({ data, interaction, sidebar, showDice = true, fadedFigureIds = [], figureOutlineColors = {}, movementTrails = [] }: BoardViewerProps) {
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const drag = useRef<{ clientX: number; clientY: number; view: View } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const { selectedId, selectedIds, select: setSelectedId, add } = useBoardSelection();
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const feedback = useBoardFeedback();
  const { preview } = useBoardPositionPreview();
  const fitted = fitBoard(size.width, size.height, data.lengthCm, data.widthCm);
  const camera = view ?? fitted;
  const phase = useBoardPhase(data, camera, selectedId, setSelectedId, cursorWorld, feedback, interaction);
  const figures = data.figures.filter((figure) => figure.position !== null && !figure.removed);
  const selected = data.figures.find((figure) => figure.id === selectedId && phase.canSelect(figure));
  const player = (id: string) => data.participants.find((participant) => participant.id === id);
  const positionOf = (figure: BoardData["figures"][number]) => preview?.positions[figure.id] ?? phase.positionOf(figure);

  function worldPosition(event: { clientX: number; clientY: number }) {
    if (!stage.current) return null;
    const rect = stage.current.container().getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * stage.current.width() / rect.width - camera.x) / camera.scale,
      y: ((event.clientY - rect.top) * stage.current.height() / rect.height - camera.y) / camera.scale,
    };
  }

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    function fitHeight() {
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY;
      const height = Math.max(320, (window.visualViewport?.height ?? window.innerHeight) - top - 12);
      element.style.height = `${height}px`;
    }
    fitHeight();
    const layoutObserver = new ResizeObserver(fitHeight);
    layoutObserver.observe(document.body);
    window.addEventListener("resize", fitHeight);
    window.visualViewport?.addEventListener("resize", fitHeight);
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      layoutObserver.disconnect();
      window.removeEventListener("resize", fitHeight);
      window.visualViewport?.removeEventListener("resize", fitHeight);
    };
  }, []);

  useEffect(() => {
    function clearSelection(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSelectedId(null);
      setCursorWorld(null);
    }
    window.addEventListener("keydown", clearSelection);
    return () => window.removeEventListener("keydown", clearSelection);
  }, [setSelectedId]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {preview && <p role="status" className="text-sm text-amber-700 dark:text-amber-400">Positionsvorschau – noch nicht gespeichert. Gestrichelte Basen zeigen die bisherigen Positionen.</p>}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]">
        <div
          ref={container}
          role="region"
          aria-label="2D-Spielfeld"
          aria-describedby="board-instructions"
          className="h-[60dvh] min-h-[320px] min-w-0 overflow-hidden rounded-lg border border-zinc-300 bg-slate-900"
          style={{ touchAction: "none", cursor: panning ? "grabbing" : "grab" }}
          onContextMenu={(event) => {
            if (!phase.onContextMenu) return;
            event.preventDefault();
            const position = worldPosition(event);
            if (position) phase.onContextMenu(position);
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !stage.current) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const hit = stage.current.getIntersection({ x: event.clientX - rect.left, y: event.clientY - rect.top });
            if (hit?.hasName("figure")) return;
            drag.current = { clientX: event.clientX, clientY: event.clientY, view: camera };
            setPanning(true);
            if (!phase.preserveSelectionOnPan) setSelectedId(null);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (phase.trackCursor && selected) setCursorWorld(worldPosition(event));
            if (!drag.current) return;
            setView({ ...drag.current.view, x: drag.current.view.x + event.clientX - drag.current.clientX, y: drag.current.view.y + event.clientY - drag.current.clientY });
          }}
          onPointerLeave={() => setCursorWorld(null)}
          onPointerUp={() => { drag.current = null; setPanning(false); }}
          onPointerCancel={() => { drag.current = null; setPanning(false); }}
          onLostPointerCapture={() => { drag.current = null; setPanning(false); }}
        >
          {size.width > 0 && <Stage ref={stage} width={size.width} height={size.height}
            onWheel={(event) => {
              event.evt.preventDefault();
              if (drag.current) return;
              const pointer = stage.current?.getPointerPosition();
              if (!pointer) return;
              const direction = event.evt.ctrlKey ? -1 : 1;
              const factor = Math.exp(-Math.max(-100, Math.min(100, event.evt.deltaY)) * direction * 0.002);
              const scale = Math.max(fitted.scale * 0.1, Math.min(fitted.scale * 30, camera.scale * factor));
              setView(zoomAt(camera, pointer, scale));
            }}>
            <Layer>
              {/* All world geometry is in cm; only this group transforms the view. */}
              <Group x={camera.x} y={camera.y} scaleX={camera.scale} scaleY={camera.scale}>
                <Rect width={data.lengthCm} height={data.widthCm} fill="#e7e5d5" stroke="#a3a38c" strokeWidth={2} strokeScaleEnabled={false} />
                {movementTrails.map((trail) => <Line key={trail.id}
                  points={[trail.from.x, trail.from.y, trail.to.x, trail.to.y]}
                  stroke={trail.color} strokeWidth={1} strokeScaleEnabled={false} listening={false} />)}
                {phase.preview}
                <BoardPositionPreviewLayer data={data} />
                {figures.map((figure) => {
                  const diameter = figure.baseDiameterCm;
                  const label = figure.short.trim() || "X";
                  const fontSize = Math.min(diameter * 0.7, diameter * 1.05 / Math.max(1, Array.from(label).length));
                  const radius = diameter / 2;
                  return <Group
                    key={figure.id}
                    name="figure"
                    id={figure.id}
                    x={positionOf(figure).x}
                    y={positionOf(figure).y}
                    draggable={false}
                    {...phase.figureProps?.(figure)}
                    opacity={fadedFigureIds.includes(figure.id) ? 0.2 : 1}
                    onMouseDown={(event) => {
                      if (event.evt.button === 0 && phase.canSelect(figure)) {
                        if (event.evt.ctrlKey) add(figure.id);
                        else setSelectedId(figure.id);
                      }
                    }}
                    onTouchStart={() => {
                      if (phase.canSelect(figure)) setSelectedId(figure.id);
                    }}
                  >
                    {selectedIds.has(figure.id) && figureOutlineColors[figure.id] && <Circle
                      radius={radius + 4 / camera.scale}
                      stroke="#000000" strokeWidth={2} strokeScaleEnabled={false} listening={false}
                    />}
                    <Circle
                      name="figure"
                      radius={radius}
                      fill={player(figure.participantId)?.color ?? "#64748b"}
                      stroke={figureOutlineColors[figure.id] ?? (selectedIds.has(figure.id) ? "#000000" : preview?.positions[figure.id] ? "#22c55e" : "#1e293b")}
                      strokeWidth={figureOutlineColors[figure.id] || selectedIds.has(figure.id) ? 3 : 1}
                      strokeScaleEnabled={false}
                    />
                    <Text
                      x={-radius}
                      y={-radius}
                      width={diameter}
                      height={diameter}
                      text={label}
                      align="center"
                      verticalAlign="middle"
                      fontSize={fontSize}
                      fontStyle="normal"
                      fill="#ffffff"
                      listening={false}
                    />
                  </Group>;
                })}
              </Group>
            </Layer>
          </Stage>}
        </div>
        <div className="min-w-0 space-y-4">
          {showDice && <DicePanel participants={data.participants} />}
          {sidebar !== undefined ? <aside className="min-w-0">{sidebar}</aside> : <aside className="space-y-5 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <button type="button" className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800" onClick={() => setView(null)}>Ganzes Spielfeld anzeigen</button>

            {phase.controls}
            {feedback.error && <p role="alert" className="text-sm text-red-600">{feedback.error}</p>}
            <p role="status" className="text-sm text-zinc-500">{feedback.pending ? "Figur wird platziert…" : feedback.message}</p>

            <section aria-labelledby="board-players"><h2 id="board-players" className="mb-2 font-semibold">Spieler</h2>
              <ul className="space-y-2 text-sm">{data.participants.map((participant) => <li key={participant.id} className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: participant.color }} />{participant.name}</li>)}</ul>
              {!data.participants.length && <p className="text-sm text-zinc-500">Noch keine Teilnehmer.</p>}
            </section>
            <section aria-labelledby="board-selection" aria-live="polite"><h2 id="board-selection" className="mb-2 font-semibold">Figur</h2>
              {selected ? <dl className="space-y-2 text-sm">
                <div><dt className="text-zinc-500">Name</dt><dd>{selected.name}</dd></div>
                <div><dt className="text-zinc-500">Spieler</dt><dd>{player(selected.participantId)?.name}</dd></div>
                {phase.showWounds && <div><dt className="text-zinc-500">Aktuelle Lebenspunkte</dt><dd>{selected.wounds}</dd></div>}
                <div><dt className="text-zinc-500">Position (cm)</dt><dd>{selected.position ? `${positionOf(selected).x.toFixed(1)} / ${positionOf(selected).y.toFixed(1)}` : "Noch nicht platziert"}</dd></div>
                {phase.details}
              </dl> : <p className="text-sm text-zinc-500">{phase.selectionHint}</p>}
            </section>
            {phase.showFigurePicker && <label className="block text-sm">Platzierte Figuren
              <select className="mt-2 w-full rounded border border-zinc-300 bg-transparent p-2 dark:border-zinc-700" value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value || null)}>
                <option value="" className="bg-white text-zinc-900">Figur auswählen</option>
                {figures.filter(phase.canSelect).map((figure) => <option key={figure.id} value={figure.id} className="bg-white text-zinc-900">{figure.name} · {player(figure.participantId)?.name}</option>)}
              </select>
            </label>}
            <p className="text-sm text-zinc-500">{figures.length} auf dem Feld · {data.figures.filter((figure) => !figure.position && !figure.removed).length} noch nicht platziert</p>
            <p id="board-instructions" className="text-xs text-zinc-500">Ursprung oben links. X = Länge, Y = Breite. {phase.instructions}</p>
          </aside>}
        </div>
      </div>
      {!figures.length && <p role="status" className="mt-3 text-sm text-zinc-500">Noch keine aktiven Figuren platziert. Das Spielfeld zeigt die gespeicherten Positionen, sobald Bewegungen vorhanden sind.</p>}
    </div>
  );
}
