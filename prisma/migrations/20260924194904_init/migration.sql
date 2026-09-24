-- CreateEnum
CREATE TYPE "CharacterType" AS ENUM ('NAMED_HERO', 'HERO', 'WARRIOR');

-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('PLACEMENT', 'INITIATIVE', 'MOVEMENT', 'SHOOTING', 'COMBAT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "name" TEXT NOT NULL,
    "lengthCm" DOUBLE PRECISION NOT NULL,
    "widthCm" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "name" TEXT NOT NULL,
    "type" "CharacterType" NOT NULL,
    "fightValueNear" INTEGER NOT NULL,
    "fightValueFar" INTEGER,
    "strength" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "attacks" INTEGER NOT NULL,
    "wounds" INTEGER NOT NULL,
    "courage" INTEGER NOT NULL,
    "baseDiameterCm" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION,
    "speedCm" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Figure" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "initialFightValueNear" INTEGER NOT NULL,
    "initialFightValueFar" INTEGER,
    "initialStrength" INTEGER NOT NULL,
    "initialDefense" INTEGER NOT NULL,
    "initialAttacks" INTEGER NOT NULL,
    "initialWounds" INTEGER NOT NULL,
    "initialCourage" INTEGER NOT NULL,
    "currentFightValueNear" INTEGER NOT NULL,
    "currentFightValueFar" INTEGER,
    "currentStrength" INTEGER NOT NULL,
    "currentDefense" INTEGER NOT NULL,
    "currentAttacks" INTEGER NOT NULL,
    "currentWounds" INTEGER NOT NULL,
    "currentCourage" INTEGER NOT NULL,
    "baseDiameterCm" DOUBLE PRECISION NOT NULL,
    "speedCm" DOUBLE PRECISION NOT NULL,
    "removed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Figure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "initiativeWinnerId" TEXT,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundPhase" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "type" "PhaseType" NOT NULL,

    CONSTRAINT "RoundPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseTurn" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "PhaseTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementStep" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "figureId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "fromXcm" DOUBLE PRECISION NOT NULL,
    "fromYcm" DOUBLE PRECISION NOT NULL,
    "toXcm" DOUBLE PRECISION NOT NULL,
    "toYcm" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MovementStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Character_number_key" ON "Character"("number");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_gameId_userId_key" ON "GameParticipant"("gameId", "userId");

-- CreateIndex
CREATE INDEX "Figure_gameId_participantId_idx" ON "Figure"("gameId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_gameId_number_key" ON "Round"("gameId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "RoundPhase_roundId_type_key" ON "RoundPhase"("roundId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseTurn_phaseId_sequence_key" ON "PhaseTurn"("phaseId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseTurn_phaseId_participantId_key" ON "PhaseTurn"("phaseId", "participantId");

-- CreateIndex
CREATE INDEX "MovementStep_figureId_phaseId_idx" ON "MovementStep"("figureId", "phaseId");

-- CreateIndex
CREATE UNIQUE INDEX "MovementStep_phaseId_sequence_key" ON "MovementStep"("phaseId", "sequence");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Figure" ADD CONSTRAINT "Figure_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Figure" ADD CONSTRAINT "Figure_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Figure" ADD CONSTRAINT "Figure_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_initiativeWinnerId_fkey" FOREIGN KEY ("initiativeWinnerId") REFERENCES "GameParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundPhase" ADD CONSTRAINT "RoundPhase_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseTurn" ADD CONSTRAINT "PhaseTurn_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "RoundPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseTurn" ADD CONSTRAINT "PhaseTurn_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "GameParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementStep" ADD CONSTRAINT "MovementStep_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "RoundPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementStep" ADD CONSTRAINT "MovementStep_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "PhaseTurn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementStep" ADD CONSTRAINT "MovementStep_figureId_fkey" FOREIGN KEY ("figureId") REFERENCES "Figure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
