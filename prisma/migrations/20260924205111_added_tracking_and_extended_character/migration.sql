-- CreateEnum
CREATE TYPE "Race" AS ENUM ('DWARF', 'HUMAN', 'ORC', 'TROLL', 'ELF', 'HOBBIT', 'HORSE', 'WARG', 'ENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('SHOT', 'MELEE');

-- CreateEnum
CREATE TYPE "ShotResult" AS ENUM ('MISS', 'HIT_NO_WOUND', 'WOUND');

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "race" "Race" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "GameAction" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "type" "ActionType" NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "GameAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShotAction" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "shooterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "result" "ShotResult" NOT NULL,

    CONSTRAINT "ShotAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeleeAction" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "winnerParticipantId" TEXT,

    CONSTRAINT "MeleeAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeleeCombatant" (
    "id" TEXT NOT NULL,
    "meleeId" TEXT NOT NULL,
    "figureId" TEXT NOT NULL,

    CONSTRAINT "MeleeCombatant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WoundChange" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "figureId" TEXT NOT NULL,
    "woundsBefore" INTEGER NOT NULL,
    "woundsAfter" INTEGER NOT NULL,

    CONSTRAINT "WoundChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameAction_phaseId_sequence_key" ON "GameAction"("phaseId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ShotAction_actionId_key" ON "ShotAction"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "MeleeAction_actionId_key" ON "MeleeAction"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "MeleeCombatant_meleeId_figureId_key" ON "MeleeCombatant"("meleeId", "figureId");

-- CreateIndex
CREATE INDEX "WoundChange_figureId_actionId_idx" ON "WoundChange"("figureId", "actionId");

-- AddForeignKey
ALTER TABLE "GameAction" ADD CONSTRAINT "GameAction_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "RoundPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotAction" ADD CONSTRAINT "ShotAction_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "GameAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotAction" ADD CONSTRAINT "ShotAction_shooterId_fkey" FOREIGN KEY ("shooterId") REFERENCES "Figure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotAction" ADD CONSTRAINT "ShotAction_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Figure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeleeAction" ADD CONSTRAINT "MeleeAction_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "GameAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeleeAction" ADD CONSTRAINT "MeleeAction_winnerParticipantId_fkey" FOREIGN KEY ("winnerParticipantId") REFERENCES "GameParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeleeCombatant" ADD CONSTRAINT "MeleeCombatant_meleeId_fkey" FOREIGN KEY ("meleeId") REFERENCES "MeleeAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeleeCombatant" ADD CONSTRAINT "MeleeCombatant_figureId_fkey" FOREIGN KEY ("figureId") REFERENCES "Figure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WoundChange" ADD CONSTRAINT "WoundChange_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "GameAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WoundChange" ADD CONSTRAINT "WoundChange_figureId_fkey" FOREIGN KEY ("figureId") REFERENCES "Figure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
