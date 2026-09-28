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

/** Search for up to 2 cm of retreat, maximizing the nearest enemy edge distance.
 * Friendly blockers move together; enemy bases and board edges are hard limits.
 * Control zones are a preference, so lack of space never blocks the next round.
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
  const epsilon = 1e-7;
  const inside = (point: Point, radius: number) => point.x >= radius - epsilon && point.y >= radius - epsilon
    && point.x <= data.lengthCm - radius + epsilon && point.y <= data.widthCm - radius + epsilon;
  const shifted = (point: Point, delta: Point) => ({ x: point.x + delta.x, y: point.y + delta.y });
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

  function enemyGap(figure: Placed, point: Point) {
    let gap = Infinity;
    for (const enemy of alive) {
      if (enemy.participantId !== figure.participantId) {
        gap = Math.min(gap, distance(point, positions.get(enemy.id)!) - (figure.baseDiameterCm + enemy.baseDiameterCm) / 2);
      }
    }
    // Beyond the control zone there is no additional reason to evade sideways.
    return Math.min(2, gap);
  }

  function movingGroup(retreat: Retreat, delta: Point): Placed[] | null {
    const group = new Set<Placed>([retreat.figure]);
    const ids = new Set([retreat.figure.id]);
    // Set iteration also visits newly added friends, including chains of blockers.
    // All members translate simultaneously and retain their relative positions.
    for (const figure of group) {
      const start = positions.get(figure.id)!;
      const end = shifted(start, delta);
      if (!inside(end, figure.baseDiameterCm / 2)
        || distance(end, figure.position) > 2 + epsilon) return null;
      for (const other of alive) {
        if (ids.has(other.id)) continue;
        const obstacle = positions.get(other.id)!;
        const bases = (figure.baseDiameterCm + other.baseDiameterCm) / 2;
        const pathDistance = segmentDistance(obstacle, start, end);
        if (other.participantId === figure.participantId) {
          if (pathDistance < bases - epsilon) {
            ids.add(other.id);
            group.add(other);
          }
        } else {
          if (pathDistance < bases - epsilon) return null;
          // Do not newly enter a control zone or move deeper into an occupied one.
          const clearance = Math.min(bases + 2, distance(start, obstacle));
          if (pathDistance < clearance - epsilon) return null;
        }
      }
    }
    return [...group];
  }

  // Revisit losers after their neighbours move. Total displacement of every
  // figure (including accompanying friends) stays within 2 cm of its origin.
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const retreat of retreats) {
      const start = positions.get(retreat.figure.id)!;
      const progress = (point: Point) => (point.x - retreat.figure.position.x) * retreat.away.x
        + (point.y - retreat.figure.position.y) * retreat.away.y;
      let best = { gap: enemyGap(retreat.figure, start), progress: progress(start), cost: 0,
        delta: { x: 0, y: 0 }, group: [] as Placed[] };
      function consider(angle: number) {
        const direction = {
          x: retreat.away.x * Math.cos(angle) - retreat.away.y * Math.sin(angle),
          y: retreat.away.x * Math.sin(angle) + retreat.away.y * Math.cos(angle),
        };
        let low = 0;
        let high = 2;
        let group: Placed[] = [];
        // Find the feasible prefix, including sub-centimetre space at the edge.
        for (let iteration = 0; iteration < 18; iteration++) {
          const length = iteration === 0 ? high : (low + high) / 2;
          const candidate = movingGroup(retreat, { x: direction.x * length, y: direction.y * length });
          if (candidate) {
            low = length;
            group = candidate;
            if (length === 2) break;
          } else high = length;
        }
        if (low < 0.001) return;
        const delta = { x: direction.x * low, y: direction.y * low };
        const target = shifted(start, delta);
        const gap = enemyGap(retreat.figure, target);
        const outward = progress(target);
        const cost = group.length * low;
        if (gap > best.gap + epsilon
          || (Math.abs(gap - best.gap) <= epsilon && outward > best.progress + epsilon)
          || (Math.abs(gap - best.gap) <= epsilon && Math.abs(outward - best.progress) <= epsilon && cost < best.cost)) {
          best = { gap, progress: outward, cost, delta, group };
        }
      }
      // Sweep the outward half-circle, then refine around the best direction.
      for (let step = -18; step <= 18; step++) consider(step * Math.PI / 36);
      if (best.group.length) {
        const angle = Math.atan2(best.delta.y, best.delta.x) - Math.atan2(retreat.away.y, retreat.away.x);
        const normalized = Math.atan2(Math.sin(angle), Math.cos(angle));
        for (let step = -4; step <= 4; step++) {
          consider(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, normalized + step * Math.PI / 180)));
        }
        for (const figure of best.group) positions.set(figure.id, shifted(positions.get(figure.id)!, best.delta));
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Include accompanying friends so the existing transaction stores every move.
  return { error: null, positions: Object.fromEntries(alive
    .filter((figure) => distance(figure.position, positions.get(figure.id)!) > epsilon)
    .map((figure) => [figure.id, positions.get(figure.id)!])) };
}
