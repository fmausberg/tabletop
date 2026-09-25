import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { phaseOrder } from "../game-phases.ts";

const orderSource = readFileSync(new URL("./movements-order.ts", import.meta.url), "utf8");
const orderExports = {};
runInNewContext(ts.transpileModule(orderSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: orderExports,
  require: () => ({ phaseOrder }),
});
const { newestMovementFirst } = orderExports;

const source = readFileSync(new URL("./movement-reset-actions.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });

function fixture(currentPhase, currentRound, steps) {
  const deleted = [];
  const tx = {
    $queryRaw: async () => [],
    game: { findUnique: async () => ({ currentPhase, currentRound }) },
    movementStep: {
      findMany: async () => [...steps],
      delete: async ({ where }) => { deleted.push(where.id); },
    },
  };
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === "@/lib/prisma") return { prisma: { $transaction: (callback) => callback(tx) } };
      if (name === "next/cache") return { revalidatePath() {} };
      if (name === "./movements-order") return { newestMovementFirst };
      if (name === "../game-phases") return {};
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { ...exports, deleted };
}

const step = (type, number, sequence = 1) => ({
  id: `${type}-${number}-${sequence}`, sequence, phase: { type, round: { number } },
});

for (const checkMovementId of [false, true]) {
  const mode = checkMovementId ? "with movement ID" : "without movement ID";
  test(`undoLastMovement ${mode} rejects other phases, stale rounds and steps outside the current movement phase`, async () => {
    const current = step("MOVEMENT", 2);
    const cases = [
      ...["PLACEMENT", "INITIATIVE", "SHOOTING", "COMBAT"].map((phase) => [phase, 2, [current], 2]),
      ["MOVEMENT", 3, [current], 2],
      ["MOVEMENT", 2, [step("MOVEMENT", 1)], 2],
      ["MOVEMENT", 2, [step("PLACEMENT", 0)], 2],
      ["MOVEMENT", 2, [current, step("SHOOTING", 2)], 2],
      ["MOVEMENT", 2, [], 2],
    ];
    for (const [phase, round, steps, expectedRound] of cases) {
      const api = fixture(phase, round, steps);
      assert.ok((await api.undoLastMovement("game", expectedRound, checkMovementId ? current.id : undefined)).error);
      assert.deepEqual(api.deleted, []);
    }
  });

  test(`undoLastMovement ${mode} deletes only the latest movement of the current phase`, async () => {
    const latest = step("MOVEMENT", 2, 2);
    const api = fixture("MOVEMENT", 2, [step("MOVEMENT", 1), step("MOVEMENT", 2), latest]);
    assert.equal((await api.undoLastMovement("game", 2, checkMovementId ? latest.id : undefined)).error, null);
    assert.deepEqual(api.deleted, [latest.id]);
  });
}

test("history undo rejects a stale displayed movement ID", async () => {
  const api = fixture("MOVEMENT", 2, [step("MOVEMENT", 2, 2)]);
  assert.ok((await api.undoLastMovement("game", 2, step("MOVEMENT", 2).id)).error);
  assert.deepEqual(api.deleted, []);
});
