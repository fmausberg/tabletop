ALTER TABLE "Round" ADD COLUMN "combatAssignmentsLocked" BOOLEAN NOT NULL DEFAULT false;

-- Preserve rounds whose combat evaluation already started before this change.
UPDATE "Round" AS r SET "combatAssignmentsLocked" = true
WHERE EXISTS (
  SELECT 1 FROM "RoundPhase" p
  JOIN "GameAction" a ON a."phaseId" = p.id
  JOIN "MeleeAction" m ON m."actionId" = a.id
  WHERE p."roundId" = r.id AND (m."winnerParticipantId" IS NOT NULL
    OR EXISTS (SELECT 1 FROM "WoundChange" w WHERE w."actionId" = a.id))
);
