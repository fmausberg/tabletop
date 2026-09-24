ALTER TABLE "Figure" ADD COLUMN "number" INTEGER;

CREATE UNIQUE INDEX "Figure_gameId_participantId_characterId_number_key"
ON "Figure"("gameId", "participantId", "characterId", "number");
