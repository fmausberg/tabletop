import type { CombatData, CombatFigure } from "./combat-model";

type Point = { x: number; y: number };
type Placed = CombatFigure & { position: Point };
type Retreat = { figure: Placed; away: Point };

function segmentDistance(point: Point, from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy);
}

/** Retreats are measured in cm. Prefer 2 cm directly away from the winning side;
 * detours can add lateral travel, but never reduce the 2 cm outward component.
 * Dead figures are absent from obstacles. Unmoved survivors remain fixed.
 */
export function calculateCombatRetreats(data: CombatData): { positions: Record<string, Point>; error: null } | { error: string; positions?: never } {
  const alive = data.figures.filter((figure): figure is Placed => !figure.removed && figure.wounds > 0 && figure.position !== null);
  if (![data.lengthCm, data.widthCm].every((value) => Number.isFinite(value) && value > 0)
    || alive.some((figure) => ![figure.position.x, figure.position.y, figure.baseDiameterCm].every(Number.isFinite) || figure.baseDiameterCm <= 0)) {
    return { error: "Ungültige Spielfeld- oder Figurengeometrie. Der Rückzug konnte nicht berechnet werden." };
  }
  const retreats: Retreat[] = [];
  const seen = new Set<string>();
  for (const combat of data.combats) {
    const winners = data.figures.filter((figure) => combat.figureIds.includes(figure.id)
      && figure.participantId === combat.winnerParticipantId && figure.position);
    for (const id of combat.figureIds) {
      if (seen.has(id)) return { error: "Eine Figur ist mehreren Nahkämpfen zugeordnet. Bitte korrigiere die Zuordnung." };
      seen.add(id);
      const figure = data.figures.find((entry) => entry.id === id);
      if (!figure || figure.participantGameId !== data.gameId) return { error: "Eine Nahkampffigur gehört nicht zu diesem Spiel." };
      if (figure.removed || figure.wounds <= 0 || figure.participantId === combat.winnerParticipantId) continue;
      if (!figure.position || !winners.length) return { error: "Für einen Rückzug fehlen die Positionen der Nahkämpfer." };
      const centre = winners.reduce((sum, winner) => ({ x: sum.x + winner.position!.x / winners.length, y: sum.y + winner.position!.y / winners.length }), { x: 0, y: 0 });
      let dx = figure.position.x - centre.x;
      let dy = figure.position.y - centre.y;
      if (Math.hypot(dx, dy) < 1e-9) {
        dx = figure.position.x - winners[0].position!.x;
        dy = figure.position.y - winners[0].position!.y;
      }
      const length = Math.hypot(dx, dy);
      retreats.push({ figure: { ...figure, position: figure.position }, away: length ? { x: dx / length, y: dy / length } : { x: 1, y: 0 } });
    }
  }

  const positions = new Map(alive.map((figure) => [figure.id, figure.position]));
  let geometryBudget = 1_000_000;
  const inside = (point: Point, radius: number) => point.x >= radius && point.y >= radius
    && point.x <= data.lengthCm - radius && point.y <= data.widthCm - radius;
  function clearPath(retreat: Retreat, path: Point[]) {
    const radius = retreat.figure.baseDiameterCm / 2;
    if (path.some((point) => !inside(point, radius))) return false;
    for (const other of alive) {
      if (--geometryBudget < 0) return false;
      if (other.id === retreat.figure.id) continue;
      const obstacle = positions.get(other.id)!;
      const clearance = radius + other.baseDiameterCm / 2 + (other.participantId === retreat.figure.participantId ? 0 : 2);
      const end = path[path.length - 1];
      if (Math.hypot(end.x - obstacle.x, end.y - obstacle.y) < clearance - 1e-9) return false;
      for (let i = 1; i < path.length; i++) {
        const startDistance = Math.hypot(path[i - 1].x - obstacle.x, path[i - 1].y - obstacle.y);
        // Starting inside an enemy control zone is expected after melee. Only exit it;
        // never approach its centre or enter any other zone along the path.
        if (segmentDistance(obstacle, path[i - 1], path[i]) < Math.min(clearance, startDistance) - 1e-9) return false;
      }
    }
    return true;
  }

  function candidates(retreat: Retreat) {
    const { position: start } = retreat.figure;
    const tangent = { x: -retreat.away.y, y: retreat.away.x };
    const options: { target: Point; cost: number }[] = [];
    const lateral = [0, ...Array.from({ length: 24 }, (_, i) => [(i + 1) * 0.25, -(i + 1) * 0.25]).flat()];
    const outward = 2;
    for (const side of lateral) {
      if (geometryBudget < 0) break;
      const target = { x: start.x + retreat.away.x * outward + tangent.x * side, y: start.y + retreat.away.y * outward + tangent.y * side };
      const waypoint = { x: start.x + tangent.x * side, y: start.y + tangent.y * side };
      if (clearPath(retreat, [start, target])) options.push({ target, cost: Math.hypot(outward, side) });
      else if (side && clearPath(retreat, [start, waypoint, target])) options.push({ target, cost: Math.abs(side) + outward });
    }
    return options.sort((a, b) => a.cost - b.cost).slice(0, 16);
  }

  // Try alternate orders/positions: moving one loser must not trap another.
  let remainingWork = 600;
  function place(pending: Retreat[]): boolean {
    if (!pending.length) return true;
    if (--remainingWork < 0 || geometryBudget < 0) return false;
    const choices = pending.map((retreat) => ({ retreat, options: candidates(retreat) }))
      .filter((entry) => entry.options.length).sort((a, b) => a.options.length - b.options.length);
    for (const { retreat, options } of choices.slice(0, 3)) {
      for (const { target } of options) {
        positions.set(retreat.figure.id, target);
        if (place(pending.filter((entry) => entry !== retreat))) return true;
        positions.set(retreat.figure.id, retreat.figure.position);
        if (remainingWork < 0) return false;
      }
    }
    return false;
  }
  if (!place(retreats)) return { error: "Für mindestens einen Verlierer wurde kein sicherer Rückzug gefunden. Bitte schaffe Platz an Figuren, Kontrollzonen oder dem Spielfeldrand. Die Runde wurde nicht gewechselt." };
  return { error: null, positions: Object.fromEntries(retreats.map(({ figure }) => [figure.id, positions.get(figure.id)!])) };
}
