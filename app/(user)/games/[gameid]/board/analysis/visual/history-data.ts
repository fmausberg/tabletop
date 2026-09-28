import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { phaseOrder } from "../../../game-phases";
import { newestMovementFirst } from "../../movement/movements-order";
import { participantColor } from "../../participant-color";
import type { BoardData } from "../../board-model";

export async function loadRoundHistory(gameId: string, requestedRound?: string, requestedFrom?: string) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({
      where: { id: gameId }, include: {
        board: true,
        rounds: {
          orderBy: { number: "asc" }, select: {
            number: true,
            initiativeWinner: { select: { user: { select: { name: true } } } }
          }
        },
        participants: { orderBy: { id: "asc" }, include: { user: { select: { name: true } } } },
      }
    });
    if (!game) notFound();
    const rounds = [...new Set([...game.rounds.map((round) => round.number), game.currentRound])]
      .filter((round) => round <= game.currentRound).sort((a, b) => a - b);
    const requested = requestedRound && /^\d+$/.test(requestedRound) ? Number(requestedRound) : NaN;
    const end = rounds.includes(requested) ? requested
      : rounds.filter((round) => round < game.currentRound).at(-1) ?? game.currentRound;
    const requestedStart = requestedFrom && /^\d+$/.test(requestedFrom) ? Number(requestedFrom) : NaN;
    const start = rounds.includes(requestedStart) ? requestedStart : end;
    const fromRound = Math.min(start, end);
    const selectedRound = Math.max(start, end);
    const figures = await tx.figure.findMany({
      where: { gameId }, orderBy: [{ number: "asc" }, { id: "asc" }], include: {
        character: { select: { name: true } },
        movementSteps: {
          where: { phase: { round: { gameId, number: { lte: selectedRound } } } },
          select: {
            id: true, fromXcm: true, fromYcm: true, toXcm: true, toYcm: true, sequence: true,
            phase: { select: { type: true, round: { select: { number: true } } } }
          },
        },
        woundChanges: {
          where: { action: { phase: { round: { gameId, number: { lte: selectedRound } } } } },
          include: { action: { select: { sequence: true, phase: { select: { type: true, round: { select: { number: true } } } } } } },
        },
      }
    });
    const participants = game.participants.map((participant, index) => ({
      id: participant.id, name: participant.user.name, color: participantColor(index),
    }));
    const participantColors = new Map(participants.map((participant) => [participant.id, participant.color]));
    const fadedFigureIds: string[] = [];
    const movementTrails: { id: string; from: { x: number; y: number }; to: { x: number; y: number }; color: string }[] = [];
    const roundMovementTrails: typeof movementTrails = [];
    const data: BoardData = {
      gameId, currentRound: selectedRound, currentPhase: selectedRound === 0 ? "PLACEMENT" : "COMBAT",
      lengthCm: game.board.lengthCm, widthCm: game.board.widthCm,
      participants,
      figures: figures.flatMap((figure) => {
        const steps = figure.movementSteps.sort(newestMovementFirst);
        if (!steps.length) return [];
        const wounds = figure.woundChanges.sort((a, b) => a.action.phase.round.number - b.action.phase.round.number
          || phaseOrder[a.action.phase.type] - phaseOrder[b.action.phase.type] || a.action.sequence - b.action.sequence);
        const remaining = wounds.at(-1)?.woundsAfter ?? figure.initialWounds;
        const death = remaining <= 0 ? [...wounds].reverse().find((wound) => wound.woundsBefore > 0 && wound.woundsAfter <= 0) : undefined;
        if (remaining <= 0 && (!death || death.action.phase.round.number < fromRound)) return [];
        // Later phases must not relocate a casualty in the historical view.
        const visibleSteps = death ? steps.filter((step) => step.phase.round.number < death.action.phase.round.number
          || (step.phase.round.number === death.action.phase.round.number
            && phaseOrder[step.phase.type] <= phaseOrder[death.action.phase.type])) : steps;
        const position = visibleSteps[0];
        if (!position) return [];
        const roundTrails = new Map<number, (typeof movementTrails)[number]>();
        // Steps are newest first: retain the latest endpoint and extend the start
        // backwards through every phase of the same round, including COMBAT.
        for (const step of visibleSteps) {
          if (step.phase.round.number < fromRound) continue;
          const round = step.phase.round.number;
          const existing = roundTrails.get(round);
          const from = { x: step.fromXcm, y: step.fromYcm };
          if (existing) existing.from = from;
          else roundTrails.set(round, {
            id: `${figure.id}-${round}`, from,
            to: { x: step.toXcm, y: step.toYcm },
            color: participantColors.get(figure.participantId) ?? "#64748b",
          });
        }
        roundMovementTrails.push(...[...roundTrails.values()].filter((trail) =>
          trail.from.x !== trail.to.x || trail.from.y !== trail.to.y));
        for (const step of visibleSteps) {
          if (step.phase.round.number < fromRound || (step.fromXcm === step.toXcm && step.fromYcm === step.toYcm)) continue;
          movementTrails.push({
            id: step.id,
            from: { x: step.fromXcm, y: step.fromYcm },
            to: { x: step.toXcm, y: step.toYcm },
            color: participantColors.get(figure.participantId) ?? "#64748b",
          });
        }
        if (death) fadedFigureIds.push(figure.id);
        return [{
          id: figure.id, name: `${figure.character.name}${figure.number === null ? "" : ` ${figure.number}`}`,
          short: figure.short, participantId: figure.participantId, wounds: remaining,
          baseDiameterCm: figure.baseDiameterCm, speedCm: figure.speedCm,
          movementDistanceCm: 0, engaged: false, removed: false,
          position: { x: position.toXcm, y: position.toYcm },
        }];
      }),
    };
    return {
      data, fadedFigureIds, movementTrails, roundMovementTrails, rounds, fromRound, selectedRound, currentRound: game.currentRound,
      gameName: game.name, boardName: game.board.name,
      initiativeWinnerName: game.rounds.find((round) => round.number === selectedRound)?.initiativeWinner?.user.name ?? null
    };
  }, { isolationLevel: "RepeatableRead" });
}
