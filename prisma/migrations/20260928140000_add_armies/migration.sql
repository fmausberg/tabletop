CREATE TABLE "Army" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Army_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArmyFigure" (
    "id" TEXT NOT NULL,
    "armyId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "platoon" INTEGER NOT NULL,
    CONSTRAINT "ArmyFigure_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ArmyFigure" ADD CONSTRAINT "ArmyFigure_armyId_fkey"
    FOREIGN KEY ("armyId") REFERENCES "Army"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArmyFigure" ADD CONSTRAINT "ArmyFigure_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
