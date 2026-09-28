import "server-only";
import { Prisma, type PhaseType } from "@/generated/prisma/client";
import { phaseOrder, phasesForRound } from "./game-phases";

export async function capturePhaseState(tx: Prisma.TransactionClient, gameId: string, number: number) {
  const round = await tx.round.findUniqueOrThrow({
    where: { gameId_number: { gameId, number } },
    select: {
      id: true, gameId: true, number: true, initiativeWinnerId: true, combatAssignmentsLocked: true,
      phases: { orderBy: { id: "asc" }, select: {
        id: true, roundId: true, type: true,
        turns: { orderBy: { id: "asc" } },
        movementSteps: { orderBy: { id: "asc" } },
        actions: { orderBy: { id: "asc" }, include: {
          shot: true, melee: { include: { combatants: { orderBy: { id: "asc" } } } },
          wounds: { orderBy: { id: "asc" } },
        } },
      } },
    },
  });
  const figures = await tx.figure.findMany({ where: { gameId }, orderBy: { id: "asc" },
    select: { id: true, currentWounds: true, removed: true } });
  return { version: 1 as const, round, figures };
}

type State = Awaited<ReturnType<typeof capturePhaseState>>;

function readState(value: Prisma.JsonValue | null): State | null {
  if (!value) return null;
  const state = value as unknown as State;
  if (state.version !== 1 || !state.round || !Array.isArray(state.figures)) {
    throw new Error("Unbekanntes Format des Phasenstands.");
  }
  return state;
}

export function previousPhase(round: number, phase: PhaseType) {
  const phases = phasesForRound(round);
  const index = phases.indexOf(phase);
  if (index > 0) return { round, phase: phases[index - 1] };
  if (phase === "INITIATIVE" && round > 0) {
    return { round: round - 1, phase: round === 1 ? "PLACEMENT" as const : "COMBAT" as const };
  }
  return null;
}

// Old games have no entry snapshot. Ordinary phase histories are reversible;
// old combat assignments cannot be reconstructed after editing/deletion.
function legacyBaseline(current: State, phase: PhaseType): State {
  const state = structuredClone(current);
  const actions = state.round.phases.flatMap((entry) => entry.actions
    .filter((action) => entry.type === phase || (phase === "COMBAT" && action.melee))
    .map((action) => ({ ...action, phase: entry.type })))
    .sort((a, b) => phaseOrder[b.phase] - phaseOrder[a.phase] || b.sequence - a.sequence);
  for (const action of actions) {
    for (const wound of action.wounds) {
      const figure = state.figures.find((entry) => entry.id === wound.figureId);
      if (figure) figure.currentWounds = wound.woundsBefore;
    }
  }
  const removedActions = new Set(actions.map((action) => action.id));
  for (const entry of state.round.phases) {
    entry.actions = entry.actions.filter((action) => !removedActions.has(action.id));
    if (entry.type === phase) {
      entry.movementSteps = [];
      entry.turns = [];
    }
  }
  if (phase === "INITIATIVE") state.round.initiativeWinnerId = null;
  if (phase === "COMBAT") state.round.combatAssignmentsLocked = false;
  return state;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

function comparable(state: State) {
  // Empty phase/turn records are infrastructure, not a played action.
  return JSON.stringify(canonical({ figures: state.figures,
    initiative: state.round.initiativeWinnerId, locked: state.round.combatAssignmentsLocked,
    movements: state.round.phases.flatMap((phase) => phase.movementSteps).sort((a, b) => a.id.localeCompare(b.id)),
    actions: state.round.phases.flatMap((phase) => phase.actions).sort((a, b) => a.id.localeCompare(b.id)),
  }));
}

export async function phaseHistory(tx: Prisma.TransactionClient, gameId: string, round: number, phase: PhaseType) {
  const current = await capturePhaseState(tx, gameId, round);
  const record = await tx.roundPhase.findUnique({ where: { roundId_type: { roundId: current.round.id, type: phase } } });
  const baseline = readState(record?.resetState ?? null) ?? legacyBaseline(current, phase);
  const previous = previousPhase(round, phase);
  const previousState = readState(record?.previousState ?? null);
  const changed = comparable(current) !== comparable(baseline);
  const missingBoundary = previous && previous.round !== round && round > 1 && !previousState;
  return { current, baseline, previous, previousState, changed,
    canGoBack: Boolean(previous && !changed && !missingBoundary),
    backReason: !previous ? "Die Aufstellung ist die erste Phase."
      : missingBoundary ? "Für diesen älteren Rundenwechsel fehlt der gesicherte Zustand vor Tod und Rückzug."
        : changed ? "Setze zuerst die aktuelle Phase zurück." : null,
    legacyCombat: phase === "COMBAT" && !record?.resetState,
  };
}

export async function savePhaseEntry(tx: Prisma.TransactionClient, gameId: string, round: number, phase: PhaseType, previous?: State) {
  const state = await capturePhaseState(tx, gameId, round);
  await tx.roundPhase.update({ where: { roundId_type: { roundId: state.round.id, type: phase } },
    data: { resetState: state, previousState: previous ?? Prisma.DbNull } });
}

async function clearRoundActions(tx: Prisma.TransactionClient, roundId: string) {
  const action = { phase: { roundId } };
  await tx.woundChange.deleteMany({ where: { action } });
  await tx.shotAction.deleteMany({ where: { action } });
  await tx.meleeCombatant.deleteMany({ where: { melee: { action } } });
  await tx.meleeAction.deleteMany({ where: { action } });
  await tx.gameAction.deleteMany({ where: { phase: { roundId } } });
  await tx.movementStep.deleteMany({ where: { phase: { roundId } } });
  await tx.phaseTurn.deleteMany({ where: { phase: { roundId } } });
}

export async function restorePhaseState(tx: Prisma.TransactionClient, state: State) {
  const { phases, ...round } = state.round;
  await clearRoundActions(tx, round.id);
  await tx.round.update({ where: { id: round.id }, data: {
    initiativeWinnerId: round.initiativeWinnerId, combatAssignmentsLocked: round.combatAssignmentsLocked,
  } });
  for (const figure of state.figures) {
    await tx.figure.update({ where: { id: figure.id }, data: { currentWounds: figure.currentWounds, removed: figure.removed } });
  }
  for (const { turns, movementSteps, actions, ...phase } of phases) {
    await tx.roundPhase.upsert({ where: { id: phase.id }, create: phase, update: {} });
    if (turns.length) await tx.phaseTurn.createMany({ data: turns });
    if (movementSteps.length) await tx.movementStep.createMany({ data: movementSteps });
    for (const { shot, melee, wounds, ...action } of actions) {
      await tx.gameAction.create({ data: action });
      if (shot) await tx.shotAction.create({ data: shot });
      if (melee) {
        const { combatants, ...entry } = melee;
        await tx.meleeAction.create({ data: entry });
        if (combatants.length) await tx.meleeCombatant.createMany({ data: combatants });
      }
      if (wounds.length) await tx.woundChange.createMany({ data: wounds });
    }
  }
}

export async function removeEmptyRound(tx: Prisma.TransactionClient, roundId: string) {
  await clearRoundActions(tx, roundId);
  await tx.roundPhase.deleteMany({ where: { roundId } });
  await tx.round.delete({ where: { id: roundId } });
}
