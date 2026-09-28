// All distances are in board centimetres. Rendering alone converts cm to pixels.
export type Translation = { x: number; y: number };
export type LayoutCircle = Translation & { id: string; radius: number };
export type SeparationInput = {
  lengthCm: number;
  widthCm: number;
  groups: { id: string; figures: LayoutCircle[] }[];
  obstacles: LayoutCircle[];
};
export type SeparationResult = {
  offsets: Record<string, Translation>;
  positions: Record<string, Translation>;
  minGapCm: number | null;
  targetReached: boolean;
  totalDisplacementCm: number;
};

const TARGET = 2;
const EPSILON = 1e-9;
const copy = (points: Translation[]) => points.map((point) => ({ ...point }));

export function validateSeparation(input: SeparationInput, offsets: Record<string, Translation>, gap = 0) {
  let minGap = Infinity;
  const shifted = input.groups.map((group) => {
    const offset = offsets[group.id];
    if (!offset || ![offset.x, offset.y].every(Number.isFinite)) return null;
    return group.figures.map((figure) => ({ ...figure, x: figure.x + offset.x, y: figure.y + offset.y }));
  });
  for (let i = 0; i < shifted.length; i++) {
    const figures = shifted[i];
    if (!figures) return { valid: false, minGapCm: null };
    for (const figure of figures) {
      if (figure.x - figure.radius < -EPSILON || figure.y - figure.radius < -EPSILON
        || figure.x + figure.radius > input.lengthCm + EPSILON || figure.y + figure.radius > input.widthCm + EPSILON) {
        return { valid: false, minGapCm: null };
      }
      for (const obstacle of input.obstacles) {
        if (Math.hypot(figure.x - obstacle.x, figure.y - obstacle.y) - figure.radius - obstacle.radius < 0) {
          return { valid: false, minGapCm: null };
        }
      }
      for (let j = i + 1; j < shifted.length; j++) {
        const opponents = shifted[j];
        if (!opponents) return { valid: false, minGapCm: null };
        for (const opponent of opponents) {
          const distance = Math.hypot(figure.x - opponent.x, figure.y - opponent.y) - figure.radius - opponent.radius;
          minGap = Math.min(minGap, distance);
          if (distance < Math.max(0, gap - EPSILON)) return { valid: false, minGapCm: null };
        }
      }
    }
  }
  return { valid: true, minGapCm: Number.isFinite(minGap) ? Math.max(0, minGap) : null };
}

/** Deterministic multi-start constraint projection, followed by max-min search.
 * Circle pairs (not group centres or bounding circles) define the clearances.
 * This is a bounded numerical search, not a proof of global optimality.
 * Only fully validated arrangements are ever returned.
 */
export function separateCombats(input: SeparationInput): SeparationResult | null {
  if (![input.lengthCm, input.widthCm].every((value) => Number.isFinite(value) && value > 0) || !input.groups.length) return null;
  const ids = new Set<string>();
  for (const circle of [...input.groups.flatMap((group) => group.figures), ...input.obstacles]) {
    if (ids.has(circle.id) || ![circle.x, circle.y, circle.radius].every(Number.isFinite) || circle.radius <= 0) return null;
    ids.add(circle.id);
  }
  if (new Set(input.groups.map((group) => group.id)).size !== input.groups.length || input.groups.some((group) => !group.figures.length)) return null;

  const bounds = input.groups.map((group) => ({
    minX: Math.max(...group.figures.map((figure) => figure.radius - figure.x)),
    maxX: Math.min(...group.figures.map((figure) => input.lengthCm - figure.radius - figure.x)),
    minY: Math.max(...group.figures.map((figure) => figure.radius - figure.y)),
    maxY: Math.min(...group.figures.map((figure) => input.widthCm - figure.radius - figure.y)),
  }));
  if (bounds.some((bound) => bound.minX > bound.maxX || bound.minY > bound.maxY)) return null;
  const clamp = (point: Translation, i: number) => ({
    x: Math.max(bounds[i].minX, Math.min(bounds[i].maxX, point.x)),
    y: Math.max(bounds[i].minY, Math.min(bounds[i].maxY, point.y)),
  });
  const toRecord = (points: Translation[]) => Object.fromEntries(input.groups.map((group, i) => [group.id, points[i]]));
  const valid = (points: Translation[], gap: number) => validateSeparation(input, toRecord(points), gap).valid;
  const cost = (points: Translation[]) => points.reduce((sum, point, i) => sum + Math.hypot(point.x, point.y) * input.groups[i].figures.length, 0);
  type Constraint = { a: number; b: number; first: LayoutCircle; second: LayoutCircle };
  const constraints: Constraint[] = [];
  for (let a = 0; a < input.groups.length; a++) {
    for (const first of input.groups[a].figures) {
      for (const second of input.obstacles) constraints.push({ a, b: -1, first, second });
      for (let b = a + 1; b < input.groups.length; b++) {
        for (const second of input.groups[b].figures) constraints.push({ a, b, first, second });
      }
    }
  }

  // Bound CPU work independently of wall-clock timing, keeping preview and save deterministic.
  let budget = 24_000_000;
  function project(seed: Translation[], gap: number, attempt: number, allowance: number) {
    const points = seed.map(clamp);
    for (let iteration = 0; iteration < 240 && budget > 0 && allowance > 0; iteration++) {
      if (iteration % 8 === 0 && valid(points, gap)) return points;
      for (let k = 0; k < constraints.length && budget > 0 && allowance > 0; k++, budget--, allowance--) {
        // Alternate order to avoid consistently favouring the first group.
        const index = iteration % 2 ? constraints.length - 1 - k : k;
        const { a, b, first, second } = constraints[index];
        const secondOffset = b < 0 ? { x: 0, y: 0 } : points[b];
        const x = second.x + secondOffset.x - first.x - points[a].x;
        const y = second.y + secondOffset.y - first.y - points[a].y;
        const distance = Math.hypot(x, y);
        const required = first.radius + second.radius + (b < 0 ? 0 : gap);
        const deficit = required - distance;
        if (deficit <= 0) continue;
        const angle = (index * 2.399963229728653 + attempt * Math.PI / 4);
        const nx = distance > EPSILON ? x / distance : Math.cos(angle);
        const ny = distance > EPSILON ? y / distance : Math.sin(angle);
        const amount = deficit + (gap > 0 ? 1e-6 : 0);
        const aWeight = b < 0 ? 1 : input.groups[b].figures.length / (input.groups[a].figures.length + input.groups[b].figures.length);
        points[a] = clamp({ x: points[a].x - nx * amount * aWeight, y: points[a].y - ny * amount * aWeight }, a);
        if (b >= 0) points[b] = clamp({ x: points[b].x + nx * amount * (1 - aWeight), y: points[b].y + ny * amount * (1 - aWeight) }, b);
      }
    }
    return valid(points, gap) ? points : null;
  }

  const origin = input.groups.map(() => ({ x: 0, y: 0 }));
  function find(gap: number, warm?: Translation[]) {
    let best: Translation[] | null = valid(origin, gap) ? copy(origin) : null;
    if (best) return best;
    const allowance = Math.min(225_000, Math.floor(budget / 8));
    for (let attempt = 0; attempt < 8 && budget > 0; attempt++) {
      const seed = attempt === 0 ? copy(warm ?? origin) : origin.map((point, i) => {
        const angle = (i + 1) * 2.399963229728653 + attempt * Math.PI / 4;
        const radius = attempt < 5 ? attempt * 0.75 : Math.min(input.lengthCm, input.widthCm) * 0.2;
        return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius };
      });
      const candidate = project(seed, gap, attempt, allowance);
      if (candidate && (!best || cost(candidate) < cost(best))) best = candidate;
    }
    return best;
  }

  // Preserve a valid zero-clearance fallback before spending work on the target.
  let best = find(0);
  if (!best) return null;
  const target = find(TARGET, best);
  let achieved = 0;
  if (target) { best = target; achieved = TARGET; }
  else {
    let upper = TARGET;
    for (let step = 0; step < 11 && budget > 0; step++) {
      const gap = (achieved + upper) / 2;
      const candidate = find(gap, best);
      if (candidate) { best = candidate; achieved = gap; }
      else upper = gap;
    }
  }

  // Minimize total figure displacement without sacrificing the clearance found.
  // Each proposal is checked against ALL groups and obstacles before acceptance.
  const measured = validateSeparation(input, toRecord(best)).minGapCm;
  achieved = Math.min(TARGET, measured ?? TARGET);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < best.length; i++) {
      const current = { ...best[i] };
      let lower = 0;
      let upper = 1;
      for (let step = 0; step < 12; step++) {
        const fraction = step === 0 ? 1 : (lower + upper) / 2;
        const proposal = copy(best);
        proposal[i] = clamp({ x: current.x * (1 - fraction), y: current.y * (1 - fraction) }, i);
        if (valid(proposal, achieved) && cost(proposal) <= cost(best)) {
          best = proposal;
          lower = fraction;
          if (fraction === 1) break;
        } else upper = fraction;
      }
    }
  }
  const finalPoints = best;
  const offsets = toRecord(finalPoints);
  const result = validateSeparation(input, offsets);
  if (!result.valid) return null;
  return {
    offsets,
    positions: Object.fromEntries(input.groups.flatMap((group, i) => group.figures.map((figure) =>
      [figure.id, { x: figure.x + finalPoints[i].x, y: figure.y + finalPoints[i].y }]))),
    minGapCm: result.minGapCm,
    targetReached: result.minGapCm === null || result.minGapCm >= TARGET - EPSILON,
    totalDisplacementCm: cost(finalPoints),
  };
}
