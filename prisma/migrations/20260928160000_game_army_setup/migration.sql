ALTER TABLE "Game" ADD COLUMN "setupCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GameParticipant" ADD COLUMN "sourceArmyId" TEXT;
ALTER TABLE "GameParticipant" ADD COLUMN "armyName" TEXT;
ALTER TABLE "Figure" ADD COLUMN "platoon" INTEGER;

-- Preserve games already prepared using the previous manual figure workflow.
UPDATE "Game" g SET "setupCompleted" = true
WHERE g."currentRound" > 0 OR EXISTS (SELECT 1 FROM "Figure" f WHERE f."gameId" = g.id)
  OR EXISTS (SELECT 1 FROM "Round" r WHERE r."gameId" = g.id);
