"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { phaseOrder } from "../game-phases";
import { readCombatData } from "./combat-data";
import { combatEvaluationIssue, isCombatResolved, type CombatCommand, type CombatData, type CombatEntry } from "./combat-model";

class CombatError extends Error {}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CombatError(message);
}

function validateCommand(command: CombatCommand) {
  requireCondition(command && typeof command === "object", "Ungültige Nahkampfaktion.");
  const id = (value: unknown) => typeof value === "string" && value.length > 0;
  switch (command.type) {
    case "create": return;
    case "assign":
      requireCondition(id(command.figureId) && (command.fromCombatId === null || id(command.fromCombatId))
        && (command.toCombatId === null || id(command.toCombatId))
        && command.fromCombatId !== command.toCombatId, "Ungültige Figurenzuordnung.");
      return;
    case "delete": case "reset":
      requireCondition(id(command.combatId), "Ungültiger Nahkampf.");
      return;
    case "split":
      requireCondition(id(command.combatId) && Array.isArray(command.figureIds)
        && command.figureIds.length > 0 && command.figureIds.every(id)
        && new Set(command.figureIds).size === command.figureIds.length, "Wähle Figuren zum Aufteilen aus.");
      return;
    case "resolve": case "correct":
      requireCondition(id(command.combatId) && id(command.winnerParticipantId) && Array.isArray(command.wounds)
        && command.wounds.every((wound) => wound && id(wound.figureId) && Number.isSafeInteger(wound.woundsAfter)
          && wound.woundsAfter >= 0 && wound.woundsAfter <= 2147483647)
        && new Set(command.wounds.map((wound) => wound.figureId)).size === command.wounds.length,
      "Bitte gib einen Sieger und gültige ganze Lebenspunkte ein.");
      return;
    default: throw new CombatError("Unbekannte Nahkampfaktion.");
  }
}

function getCombat(data: CombatData, id: string, open = false) {
  const combat = data.combats.find((entry) => entry.id === id);
  requireCondition(combat, "Dieser Nahkampf gehört nicht zur aktuellen Runde dieses Spiels.");
  requireCondition(!open || !isCombatResolved(combat), "Setze zuerst die Auswertung dieses Nahkampfs zurück.");
  return combat;
}

function validateAssignments(data: CombatData) {
  const assigned = new Set<string>();
  for (const combat of data.combats) {
    for (const id of combat.figureIds) {
      const figure = data.figures.find((entry) => entry.id === id);
      requireCondition(figure && figure.participantGameId === data.gameId,
        "Eine zugeordnete Figur gehört nicht zu diesem Spiel.");
      requireCondition(!assigned.has(id), "Eine Figur ist in dieser Runde mehreren Nahkämpfen zugeordnet. Bitte bereinige die Zuordnung.");
      assigned.add(id);
    }
  }
}

async function combatPhase(tx: Prisma.TransactionClient, gameId: string, round: number) {
  const entry = await tx.round.upsert({
    where: { gameId_number: { gameId, number: round } }, create: { gameId, number: round }, update: {},
  });
  return tx.roundPhase.upsert({
    where: { roundId_type: { roundId: entry.id, type: "COMBAT" } },
    create: { roundId: entry.id, type: "COMBAT" }, update: {},
  });
}

async function nextSequence(tx: Prisma.TransactionClient, phaseId: string) {
  const last = await tx.gameAction.aggregate({ where: { phaseId }, _max: { sequence: true } });
  return (last._max.sequence ?? 0) + 1;
}

async function createCombat(tx: Prisma.TransactionClient, data: CombatData) {
  const phase = await combatPhase(tx, data.gameId, data.round);
  const action = await tx.gameAction.create({ data: {
    phaseId: phase.id, type: "MELEE", sequence: await nextSequence(tx, phase.id), melee: { create: {} },
  }, include: { melee: true } });
  return action.melee!;
}

async function correctionBaseline(tx: Prisma.TransactionClient, data: CombatData, combat: CombatEntry) {
  requireCondition(isCombatResolved(combat), "Dieser Nahkampf ist noch offen.");
  requireCondition(combat.wounds.length === combat.figureIds.length
    && new Set(combat.wounds.map((wound) => wound.figureId)).size === combat.figureIds.length
    && combat.wounds.every((wound) => combat.figureIds.includes(wound.figureId)),
  "Die gespeicherte Auswertung ist unvollständig. Eine sichere automatische Rücksetzung ist nicht möglich.");
  for (const wound of combat.wounds) {
    requireCondition(data.figures.find((figure) => figure.id === wound.figureId)?.wounds === wound.woundsAfter,
      "Lebenspunkte wurden nach dieser Auswertung verändert. Bitte mache zuerst die späteren Änderungen rückgängig.");
  }
  const otherChanges = await tx.woundChange.findMany({
    where: { figureId: { in: combat.figureIds }, actionId: { not: combat.actionId } },
    include: { action: { include: { phase: { include: { round: true } } } } },
  });
  requireCondition(!otherChanges.some(({ action }) => action.phase.round.number > data.round
    || (action.phase.round.number === data.round && (phaseOrder[action.phase.type] > phaseOrder[combat.phase]
      || (action.phase.type === combat.phase && action.sequence > combat.sequence)))),
  "Spätere Wundänderungen bauen auf dieser Auswertung auf. Setze diese zuerst zurück.");
  return new Map(combat.wounds.map((wound) => [wound.figureId, wound.woundsBefore]));
}

export async function manageCombat(gameId: string, expectedRound: number, revision: string, command: CombatCommand) {
  try {
    requireCondition(typeof gameId === "string" && Number.isSafeInteger(expectedRound) && expectedRound > 0
      && typeof revision === "string", "Ungültiger Spielstand.");
    validateCommand(command);
    await prisma.$transaction(async (tx) => {
      // All movement, phase and combat writers serialize on this same game lock.
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const data = await readCombatData(tx, gameId);
      requireCondition(data, "Das Spiel existiert nicht mehr.");
      requireCondition(data.round === expectedRound && data.phase === "COMBAT",
        "Nahkämpfe können nur in der aktuellen Nahkampfphase verwaltet werden. Bitte lade die Seite neu.");
      requireCondition(data.revision === revision, "Der Spielstand wurde inzwischen geändert. Bitte lade die Ansicht neu.");
      validateAssignments(data);

      switch (command.type) {
        case "create":
          await createCombat(tx, data);
          break;
        case "delete": {
          const combat = getCombat(data, command.combatId, true);
          await tx.meleeCombatant.deleteMany({ where: { meleeId: combat.id } });
          await tx.meleeAction.delete({ where: { id: combat.id } });
          await tx.gameAction.delete({ where: { id: combat.actionId } });
          break;
        }
        case "assign": {
          const figure = data.figures.find((entry) => entry.id === command.figureId);
          requireCondition(figure && figure.participantGameId === gameId, "Diese Figur gehört nicht zum Spiel.");
          const source = command.fromCombatId ? getCombat(data, command.fromCombatId, true) : null;
          const target = command.toCombatId ? getCombat(data, command.toCombatId, true) : null;
          const owner = data.combats.find((entry) => entry.figureIds.includes(figure.id));
          requireCondition((owner?.id ?? null) === (source?.id ?? null), "Die Figurenzuordnung wurde inzwischen geändert.");
          requireCondition(!target || !figure.removed, "Eine entfernte Figur kann keinem Nahkampf zugeordnet werden.");
          if (source) await tx.meleeCombatant.delete({ where: { meleeId_figureId: { meleeId: source.id, figureId: figure.id } } });
          if (target) await tx.meleeCombatant.create({ data: { meleeId: target.id, figureId: figure.id } });
          break;
        }
        case "split": {
          const combat = getCombat(data, command.combatId, true);
          requireCondition(command.figureIds.length < combat.figureIds.length
            && command.figureIds.every((id) => combat.figureIds.includes(id)),
          "Wähle einen Teil der zugeordneten Figuren aus; mindestens eine Figur muss im bisherigen Nahkampf bleiben.");
          const created = await createCombat(tx, data);
          await tx.meleeCombatant.updateMany({
            where: { meleeId: combat.id, figureId: { in: command.figureIds } }, data: { meleeId: created.id },
          });
          break;
        }
        case "reset": {
          const combat = getCombat(data, command.combatId);
          const baseline = await correctionBaseline(tx, data, combat);
          for (const [figureId, currentWounds] of baseline) {
            await tx.figure.update({ where: { id: figureId }, data: { currentWounds } });
          }
          await tx.woundChange.deleteMany({ where: { actionId: combat.actionId } });
          await tx.meleeAction.update({ where: { id: combat.id }, data: { winnerParticipantId: null } });
          break;
        }
        case "resolve": case "correct": {
          const issue = combatEvaluationIssue(data);
          requireCondition(!issue, issue ?? "Die Nahkampfzuordnung ist noch nicht abgeschlossen.");
          const combat = getCombat(data, command.combatId);
          requireCondition(command.type === "correct" ? isCombatResolved(combat) : !isCombatResolved(combat),
            "Der Auswertungsstatus wurde geändert. Bitte lade die Ansicht neu.");
          const figures = combat.figureIds.map((id) => data.figures.find((figure) => figure.id === id)!);
          const sides = new Set(figures.map((figure) => figure.participantId));
          requireCondition(sides.size === 2 && sides.has(command.winnerParticipantId)
            && [...sides].every((id) => data.participants.some((participant) => participant.id === id)),
          "Zur Auswertung sind genau zwei gegnerische Spieler und eine zugehörige Siegerseite erforderlich.");
          requireCondition(figures.every((figure) => !figure.removed), "Entfernte Figuren müssen zuerst aus dem offenen Nahkampf entfernt werden.");
          requireCondition(command.wounds.length === figures.length
            && command.wounds.every((wound) => combat.figureIds.includes(wound.figureId)),
          "Bitte trage die verbleibenden Lebenspunkte aller zugeordneten Figuren ein.");
          const baseline = command.type === "correct"
            ? await correctionBaseline(tx, data, combat)
            : new Map(figures.map((figure) => [figure.id, figure.wounds]));
          for (const wound of command.wounds) {
            requireCondition(wound.woundsAfter <= baseline.get(wound.figureId)!,
              "Verbleibende Lebenspunkte dürfen die Lebenspunkte vor diesem Nahkampf nicht überschreiten.");
          }
          if (command.type === "resolve") {
            // Evaluation belongs to COMBAT, even when contact was created during MOVEMENT.
            // Sequence records evaluation order so later wound changes can be detected.
            const phase = await combatPhase(tx, gameId, data.round);
            await tx.gameAction.update({ where: { id: combat.actionId }, data: {
              phaseId: phase.id, sequence: await nextSequence(tx, phase.id),
            } });
            await tx.woundChange.createMany({ data: command.wounds.map((wound) => ({
              actionId: combat.actionId, figureId: wound.figureId,
              woundsBefore: baseline.get(wound.figureId)!, woundsAfter: wound.woundsAfter,
            })) });
          } else {
            for (const wound of command.wounds) {
              const previous = combat.wounds.find((entry) => entry.figureId === wound.figureId)!;
              await tx.woundChange.update({ where: { id: previous.id }, data: { woundsAfter: wound.woundsAfter } });
            }
          }
          for (const wound of command.wounds) {
            await tx.figure.update({ where: { id: wound.figureId }, data: { currentWounds: wound.woundsAfter } });
          }
          await tx.meleeAction.update({ where: { id: combat.id }, data: { winnerParticipantId: command.winnerParticipantId } });
          break;
        }
      }
    });
    revalidatePath(`/games/${gameId}/board`);
    revalidatePath(`/games/${gameId}`);
    return { error: null };
  } catch (error) {
    return { error: error instanceof CombatError ? error.message : "Der Nahkampf konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }
}
