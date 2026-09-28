"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { savePhaseEntry } from "./phase-history";

export async function confirmArmySetup(gameId: string, form: FormData) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
      const game = await tx.game.findUnique({ where: { id: gameId }, include: {
        participants: { orderBy: { id: "asc" }, include: { user: { select: { name: true } } } },
        _count: { select: { figures: true } },
      } });
      if (!game) return { error: "Das Spiel existiert nicht mehr." };
      if (game.setupCompleted) return { error: "Die Armeen wurden bereits übernommen. Öffne das Spielfeld." };
      if (game.currentRound !== 0 || game.currentPhase !== "PLACEMENT" || game._count.figures) {
        return { error: "Dieses Spiel wurde bereits vorbereitet. Es wurden keine Figuren verändert." };
      }
      if (!game.participants.length) return { error: "Füge zuerst die Teilnehmer hinzu." };
      const choices = game.participants.map((participant) => ({ participant,
        armyId: String(form.get(`army-${participant.id}`) ?? "").trim(),
      }));
      const armies = await tx.army.findMany({ where: { id: { in: choices.map((choice) => choice.armyId) } }, include: {
        figures: { orderBy: [{ platoon: "asc" }, { id: "asc" }], include: { character: true } },
      } });
      // Validate the entire selection before the first write.
      for (const { participant, armyId } of choices) {
        const army = armies.find((entry) => entry.id === armyId);
        if (!army || army.ownerId !== participant.userId) return { error: `Wähle eine eigene Armee für ${participant.user.name}.` };
        if (!army.figures.length) return { error: `Die Armee „${army.name}“ enthält noch keine Figuren.` };
      }
      const figures: Prisma.FigureCreateManyInput[] = [];
      for (const { participant, armyId } of choices) {
        const army = armies.find((entry) => entry.id === armyId)!;
        const numbers = new Map<string, number>();
        for (const entry of army.figures) {
          const character = entry.character;
          const number = (numbers.get(character.id) ?? 0) + 1;
          numbers.set(character.id, number);
          figures.push({
            gameId, participantId: participant.id, characterId: character.id,
            number: character.type === "NAMED_HERO" ? null : number,
            short: character.short, platoon: entry.platoon,
            initialFightValueNear: character.fightValueNear, currentFightValueNear: character.fightValueNear,
            initialFightValueFar: character.fightValueFar, currentFightValueFar: character.fightValueFar,
            initialStrength: character.strength, currentStrength: character.strength,
            initialDefense: character.defense, currentDefense: character.defense,
            initialAttacks: character.attacks, currentAttacks: character.attacks,
            initialWounds: character.wounds, currentWounds: character.wounds,
            initialCourage: character.courage, currentCourage: character.courage,
            baseDiameterCm: character.baseDiameterCm, speedCm: character.speedCm,
          });
        }
        await tx.gameParticipant.update({ where: { id: participant.id }, data: { sourceArmyId: army.id, armyName: army.name } });
      }
      await tx.figure.createMany({ data: figures });
      await tx.round.upsert({ where: { gameId_number: { gameId, number: 0 } },
        create: { gameId, number: 0, phases: { create: { type: "PLACEMENT" } } }, update: {} });
      await savePhaseEntry(tx, gameId, 0, "PLACEMENT");
      await tx.game.update({ where: { id: gameId }, data: { setupCompleted: true, currentRound: 0, currentPhase: "PLACEMENT" } });
      return { error: null };
    }, { isolationLevel: "Serializable", timeout: 15000 });
    if (result.error) return result;
  } catch (error) {
    console.error("[confirmArmySetup] Army import transaction failed", { gameId, error });
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return { error: "Das Spiel wurde gleichzeitig geändert. Bitte versuche die Übernahme erneut. Es wurden keine Teiländerungen gespeichert." };
    }
    return { error: "Die Armeen konnten nicht übernommen werden. Bitte aktualisiere die Ansicht und versuche es erneut. Es wurden keine Teiländerungen gespeichert." };
  }
  // The transaction has committed; a cache failure must not report a rollback.
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/board`, "layout");
  return { error: null };
}
