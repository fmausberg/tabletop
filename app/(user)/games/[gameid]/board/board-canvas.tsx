"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type Konva from "konva";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { fitBoard, zoomAt, type BoardData, type View } from "./board-model";
import { movePlacedFigure, placeFigure } from "./placement-actions";
import { PlacementList } from "./placement-list";
import { DicePanel } from "./dice-panel";
import { moveFigure } from "./movement-actions";

export default function BoardCanvas({ data }: { data: BoardData }) {
  const container = useRef<HTMLDivElement>(null);
  const stage = useRef<Konva.Stage>(null);
  const drag = useRef<{ clientX: number; clientY: number; view: View } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [placementMessage, setPlacementMessage] = useState("");
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({});
  const isPlacement = data.currentPhase === "PLACEMENT";
  const isMovement = data.currentPhase === "MOVEMENT";
  const fitted = fitBoard(size.width, size.height, data.lengthCm, data.widthCm);
  const camera = view ?? fitted;
  const figures = data.figures.filter((figure) => figure.position !== null && !figure.removed);
  const selected = data.figures.find((figure) => figure.id === selectedId && !figure.removed
    && (isPlacement || figure.position) && (!isMovement || !figure.engaged));
  const player = (id: string) => data.participants.find((participant) => participant.id === id);
  const positionOf = (figure: BoardData["figures"][number]) => isPlacement
    ? localPositions[figure.id] ?? figure.position!
    : figure.position!;
  let movementPreview: { x: number; y: number } | null = null;
  if (isMovement && selected?.position && cursorWorld) {
    const current = positionOf(selected);
    const remainingDistance = Math.max(0, selected.speedCm - selected.movementDistanceCm);
    const attacked = figures
      .filter((figure) => figure.participantId !== selected.participantId)
      .filter((figure) => {
        const opponentPosition = positionOf(figure);
        const basesDistance = selected.baseDiameterCm / 2 + figure.baseDiameterCm / 2;
        const targetDistance = Math.hypot(cursorWorld.x - opponentPosition.x, cursorWorld.y - opponentPosition.y);
        return figure.engaged
          ? Math.hypot(current.x - opponentPosition.x, current.y - opponentPosition.y)
          <= remainingDistance + basesDistance && targetDistance <= basesDistance
          : targetDistance <= basesDistance + 2;
      })
      .sort((a, b) => Math.hypot(cursorWorld.x - positionOf(a).x, cursorWorld.y - positionOf(a).y)
        - Math.hypot(cursorWorld.x - positionOf(b).x, cursorWorld.y - positionOf(b).y))[0];
    if (attacked) {
      const opponentPosition = positionOf(attacked);
      const x = opponentPosition.x - current.x;
      const y = opponentPosition.y - current.y;
      const centerDistance = Math.hypot(x, y);
      const travelDistance = Math.max(0, centerDistance - selected.baseDiameterCm / 2 - attacked.baseDiameterCm / 2);
      const factor = centerDistance > 0 ? travelDistance / centerDistance : 0;
      movementPreview = { x: current.x + x * factor, y: current.y + y * factor };
    } else {
      const x = cursorWorld.x - current.x;
      const y = cursorWorld.y - current.y;
      const requestedDistance = Math.hypot(x, y);
      const factor = requestedDistance > remainingDistance && requestedDistance > 0
        ? remainingDistance / requestedDistance
        : 1;
      movementPreview = { x: current.x + x * factor, y: current.y + y * factor };
    }
  }

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function clearSelection(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSelectedId(null);
      setCursorWorld(null);
    }
    window.addEventListener("keydown", clearSelection);
    return () => window.removeEventListener("keydown", clearSelection);
  }, []);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">

      </div>
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
        <DicePanel participants={data.participants} />
        <div
          ref={container}
          role="region"
          aria-label="2D-Spielfeld"
          aria-describedby="board-instructions"
          className="h-[60vh] min-h-[320px] max-h-[800px] min-w-0 overflow-hidden rounded-lg border border-zinc-300 bg-slate-900"
          style={{ touchAction: "none", cursor: panning ? "grabbing" : "grab" }}
          onContextMenu={(event) => {
            if (!isPlacement && !isMovement) return;
            event.preventDefault();
            if (saving.current || !stage.current) return;
            setPlacementError(null);
            setPlacementMessage("");
            if (!selected) { setPlacementError("Wähle zuerst eine Figur aus."); return; }
            if (isPlacement && selected.position) { setPlacementError("Diese Figur wurde bereits platziert."); return; }
            if (isMovement && !selected.position) { setPlacementError("Diese Figur wurde noch nicht platziert."); return; }
            const rect = stage.current.container().getBoundingClientRect();
            const pointer = {
              x: (event.clientX - rect.left) * stage.current.width() / rect.width,
              y: (event.clientY - rect.top) * stage.current.height() / rect.height,
            };
            const x = (pointer.x - camera.x) / camera.scale;
            const y = (pointer.y - camera.y) / camera.scale;
            saving.current = true;
            startTransition(async () => {
              try {
                const result = isPlacement
                  ? await placeFigure(data.gameId, selected.id, x, y)
                  : await moveFigure(data.gameId, selected.id, x, y);
                if (result.error) setPlacementError(result.error);
                else setPlacementMessage(isPlacement
                  ? `${selected.name} wurde platziert.`
                  : "engaged" in result && result.engaged
                    ? `${selected.name} wurde bewegt und in einen Nahkampf gebunden.`
                    : "limited" in result && result.limited
                      ? `${selected.name} wurde bis zum Ende der verbleibenden Reichweite bewegt.`
                      : `${selected.name} wurde bewegt.`);
              } catch {
                setPlacementError(`Die Figur konnte nicht ${isPlacement ? "platziert" : "bewegt"} werden. Bitte versuche es erneut.`);
              } finally {
                saving.current = false;
              }
            });
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !stage.current) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const hit = stage.current.getIntersection({ x: event.clientX - rect.left, y: event.clientY - rect.top });
            if (hit?.hasName("figure")) return;
            drag.current = { clientX: event.clientX, clientY: event.clientY, view: camera };
            setPanning(true);
            if (!isPlacement) setSelectedId(null);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (isMovement && selected && stage.current) {
              const rect = stage.current.container().getBoundingClientRect();
              const pointer = {
                x: (event.clientX - rect.left) * stage.current.width() / rect.width,
                y: (event.clientY - rect.top) * stage.current.height() / rect.height,
              };
              setCursorWorld({ x: (pointer.x - camera.x) / camera.scale, y: (pointer.y - camera.y) / camera.scale });
            }
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
                {isMovement && selected && figures
                  .filter((figure) => figure.participantId !== selected.participantId && !figure.engaged)
                  .map((figure) => <Circle
                    key={`control-zone-${figure.id}`}
                    x={positionOf(figure).x}
                    y={positionOf(figure).y}
                    radius={figure.baseDiameterCm / 2 + 2}
                    fill={player(figure.participantId)?.color ?? "#64748b"}
                    stroke={player(figure.participantId)?.color ?? "#64748b"}
                    strokeWidth={1.5}
                    strokeScaleEnabled={false}
                    opacity={0.18}
                    listening={false}
                  />)}
                {isMovement && selected?.position && <Circle
                  x={positionOf(selected).x}
                  y={positionOf(selected).y}
                  radius={Math.max(0, selected.speedCm - selected.movementDistanceCm) + selected.baseDiameterCm / 2}
                  fill="rgba(34, 197, 94, 0.08)"
                  stroke="#16a34a"
                  strokeWidth={2}
                  strokeScaleEnabled={false}
                  listening={false}
                />}
                {isMovement && selected?.position && cursorWorld && <Line
                  points={[positionOf(selected).x, positionOf(selected).y, cursorWorld.x, cursorWorld.y]}
                  stroke="#16a34a"
                  strokeWidth={2}
                  strokeScaleEnabled={false}
                  lineCap="round"
                  listening={false}
                />}
                {isMovement && selected && movementPreview && <Circle
                  x={movementPreview.x}
                  y={movementPreview.y}
                  radius={selected.baseDiameterCm / 2}
                  fill={player(selected.participantId)?.color ?? "#64748b"}
                  stroke="#16a34a"
                  strokeWidth={2}
                  strokeScaleEnabled={false}
                  opacity={0.4}
                  listening={false}
                />}
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
                    draggable={isPlacement && !pending}
                    onClick={(event) => {
                      if (event.evt.button === 0 && (!isMovement || !figure.engaged)) setSelectedId(figure.id);
                    }}
                    onTap={() => {
                      if (!isMovement || !figure.engaged) setSelectedId(figure.id);
                    }}
                    onDragStart={() => {
                      setSelectedId(figure.id);
                      setPlacementError(null);
                      setPlacementMessage("");
                    }}
                    dragBoundFunc={(absolutePosition) => ({
                      x: Math.max(camera.x + radius * camera.scale, Math.min(camera.x + (data.lengthCm - radius) * camera.scale, absolutePosition.x)),
                      y: Math.max(camera.y + radius * camera.scale, Math.min(camera.y + (data.widthCm - radius) * camera.scale, absolutePosition.y)),
                    })}
                    onDragEnd={(event) => {
                      if (saving.current) {
                        event.target.position(positionOf(figure));
                        return;
                      }
                      const previous = positionOf(figure);
                      const next = { x: event.target.x(), y: event.target.y() };
                      setLocalPositions((positions) => ({ ...positions, [figure.id]: next }));
                      saving.current = true;
                      startTransition(async () => {
                        try {
                          const result = await movePlacedFigure(data.gameId, figure.id, next.x, next.y);
                          if (result.error) {
                            setPlacementError(result.error);
                            setLocalPositions((positions) => ({ ...positions, [figure.id]: previous }));
                          } else {
                            setPlacementMessage(`${figure.name} wurde verschoben.`);
                          }
                        } catch {
                          setPlacementError("Die Figur konnte nicht verschoben werden. Bitte versuche es erneut.");
                          setLocalPositions((positions) => ({ ...positions, [figure.id]: previous }));
                        } finally {
                          saving.current = false;
                        }
                      });
                    }}
                  >
                    <Circle
                      name="figure"
                      radius={radius}
                      fill={player(figure.participantId)?.color ?? "#64748b"}
                      stroke={selectedId === figure.id ? "#ffffff" : "#1e293b"}
                      strokeWidth={selectedId === figure.id ? 3 : 1}
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
        <aside className="space-y-5 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <button type="button" className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800" onClick={() => setView(null)}>Ganzes Spielfeld anzeigen</button>

          {isPlacement && <PlacementList data={data} selectedId={selectedId} pending={pending} onSelect={(id) => { setSelectedId(id); setPlacementError(null); setPlacementMessage(""); }} />}
          {placementError && <p role="alert" className="text-sm text-red-600">{placementError}</p>}
          <p role="status" className="text-sm text-zinc-500">{pending ? "Figur wird platziert…" : placementMessage}</p>

          <section aria-labelledby="board-players"><h2 id="board-players" className="mb-2 font-semibold">Spieler</h2>
            <ul className="space-y-2 text-sm">{data.participants.map((participant) => <li key={participant.id} className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: participant.color }} />{participant.name}</li>)}</ul>
            {!data.participants.length && <p className="text-sm text-zinc-500">Noch keine Teilnehmer.</p>}
          </section>
          <section aria-labelledby="board-selection" aria-live="polite"><h2 id="board-selection" className="mb-2 font-semibold">Figur</h2>
            {selected ? <dl className="space-y-2 text-sm">
              <div><dt className="text-zinc-500">Name</dt><dd>{selected.name}</dd></div>
              <div><dt className="text-zinc-500">Spieler</dt><dd>{player(selected.participantId)?.name}</dd></div>
              {!isMovement && <div><dt className="text-zinc-500">Aktuelle Lebenspunkte</dt><dd>{selected.wounds}</dd></div>}
              <div><dt className="text-zinc-500">Position (cm)</dt><dd>{selected.position ? `${positionOf(selected).x.toFixed(1)} / ${positionOf(selected).y.toFixed(1)}` : "Noch nicht platziert"}</dd></div>
              {isMovement && <div><dt className="text-zinc-500">Bewegt in Runde {data.currentRound}</dt><dd>{selected.movementDistanceCm.toFixed(1)} cm</dd></div>}
              {isMovement && <div><dt className="text-zinc-500">Verbleibende Bewegung</dt><dd>{Math.max(0, selected.speedCm - selected.movementDistanceCm).toFixed(1)} cm</dd></div>}
              {isMovement && <div><dt className="text-zinc-500">Nahkampf</dt><dd>{selected.engaged ? "Gebunden" : "Nicht gebunden"}</dd></div>}
              {isMovement && <div><dt className="text-zinc-500">Geplante Bewegung</dt><dd className="tabular-nums">{cursorWorld && selected.position
                ? `${Math.hypot(cursorWorld.x - positionOf(selected).x, cursorWorld.y - positionOf(selected).y).toFixed(1)} cm`
                : "—"}</dd></div>}
            </dl> : <p className="text-sm text-zinc-500">{isPlacement ? "Wähle eine Figur aus der Liste aus." : "Wähle eine platzierte Figur aus."}</p>}
          </section>
          {!isPlacement && <label className="block text-sm">Platzierte Figuren
            <select className="mt-2 w-full rounded border border-zinc-300 bg-transparent p-2 dark:border-zinc-700" value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value || null)}>
              <option value="" className="bg-white text-zinc-900">Figur auswählen</option>
              {figures.filter((figure) => !isMovement || !figure.engaged).map((figure) => <option key={figure.id} value={figure.id} className="bg-white text-zinc-900">{figure.name} · {player(figure.participantId)?.name}</option>)}
            </select>
          </label>}
          <p className="text-sm text-zinc-500">{figures.length} auf dem Feld · {data.figures.filter((figure) => !figure.position && !figure.removed).length} noch nicht platziert</p>
          <p className="text-xs text-zinc-500">Ursprung oben links. X = Länge, Y = Breite. {isPlacement ? "Platzierte Figuren lassen sich ziehen; die Base bleibt vollständig auf dem Spielfeld." : isMovement ? "Figur links auswählen und mit Rechtsklick bewegen; die Base bleibt vollständig auf dem Spielfeld." : "Figuren können in dieser Phase nicht bewegt werden."}</p>
        </aside>
      </div>
      {!figures.length && <p role="status" className="mt-3 text-sm text-zinc-500">Noch keine aktiven Figuren platziert. Das Spielfeld zeigt die gespeicherten Positionen, sobald Bewegungen vorhanden sind.</p>}
    </div>
  );
}
