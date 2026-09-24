ALTER TABLE "Game"
ADD COLUMN "currentRound" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currentPhase" "PhaseType" NOT NULL DEFAULT 'PLACEMENT';

-- Preserve the progress previously inferred from existing rounds and phases.
UPDATE "Game" AS game
SET "currentRound" = latest.number,
    "currentPhase" = COALESCE(latest.type,
      CASE WHEN latest.number = 0 THEN 'PLACEMENT'::"PhaseType" ELSE 'INITIATIVE'::"PhaseType" END)
FROM (
  SELECT DISTINCT ON (round."gameId") round."gameId", round.number, phase.type
  FROM "Round" AS round
  LEFT JOIN LATERAL (
    SELECT type FROM "RoundPhase"
    WHERE "roundId" = round.id
      AND ((round.number = 0 AND type = 'PLACEMENT') OR (round.number > 0 AND type <> 'PLACEMENT'))
    ORDER BY CASE type WHEN 'COMBAT' THEN 4 WHEN 'SHOOTING' THEN 3 WHEN 'MOVEMENT' THEN 2 WHEN 'INITIATIVE' THEN 1 ELSE 0 END DESC
    LIMIT 1
  ) AS phase ON true
  WHERE round.number >= 0
  ORDER BY round."gameId", round.number DESC
) AS latest
WHERE game.id = latest."gameId";
