import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateMovement, remainingMovement } from "./movement-rules.ts";
import { nextPhaseInRound } from "../game-phases.ts";

test("free movement is capped along the requested direction", () => {
  assert.deepEqual(calculateMovement({ x: 10, y: 10 }, { x: 16, y: 18 }, 2, 5, []), {
    target: { x: 13, y: 14 }, attackedId: null, limited: true,
  });
  assert.deepEqual(calculateMovement({ x: 10, y: 10 }, { x: 13, y: 14 }, 2, 5, []), {
    target: { x: 13, y: 14 }, attackedId: null, limited: false,
  });
});

test("zero movement and a stationary request produce finite positions", () => {
  assert.equal(remainingMovement(5, 7), 0);
  for (const requested of [{ x: 0, y: 0 }, { x: 10, y: 0 }]) {
    assert.deepEqual(calculateMovement({ x: 0, y: 0 }, requested, 2, 0, []).target, { x: 0, y: 0 });
  }
});

test("an unengaged control zone preserves the existing approach beyond remaining movement", () => {
  const opponent = { id: "enemy", position: { x: 10, y: 0 }, baseDiameterCm: 4, engaged: false };
  assert.deepEqual(calculateMovement({ x: 0, y: 0 }, { x: 5, y: 0 }, 2, 1, [opponent]), {
    target: { x: 7, y: 0 }, attackedId: "enemy", limited: false,
  });
  assert.equal(calculateMovement({ x: 0, y: 0 }, { x: 4.99, y: 0 }, 2, 1, [opponent]).attackedId, null);
});

test("joining an existing melee requires reachable base contact, including server tolerance", () => {
  const opponent = { id: "melee", position: { x: 10, y: 0 }, baseDiameterCm: 2, engaged: true };
  assert.equal(calculateMovement({ x: 0, y: 0 }, { x: 10, y: 0 }, 2, 7, [opponent]).attackedId, null);
  assert.equal(calculateMovement({ x: 0, y: 0 }, { x: 10, y: 0 }, 2, 8 - 5e-10, [opponent]).attackedId, "melee");
  assert.equal(calculateMovement({ x: 0, y: 0 }, { x: 7.99, y: 0 }, 2, 8, [opponent]).attackedId, null);
});

test("the nearest eligible opponent wins without mutating the input order", () => {
  const opponents = [
    { id: "far", position: { x: 10, y: 0 }, baseDiameterCm: 2, engaged: false },
    { id: "near", position: { x: 8, y: 0 }, baseDiameterCm: 2, engaged: false },
  ];
  assert.equal(calculateMovement({ x: 0, y: 0 }, { x: 7, y: 0 }, 2, 5, opponents).attackedId, "near");
  assert.deepEqual(opponents.map(({ id }) => id), ["far", "near"]);
});

test("overlapping centers do not produce NaN during a contact approach", () => {
  const position = { x: 10, y: 10 };
  assert.deepEqual(calculateMovement(position, position, 2, 0, [
    { id: "enemy", position, baseDiameterCm: 2, engaged: false },
  ]).target, position);
});

test("shooting advances to combat, and only combat ends a regular round", () => {
  assert.equal(nextPhaseInRound(0, "PLACEMENT"), null);
  for (const round of [1, 2, 2147483647]) {
    assert.equal(nextPhaseInRound(round, "INITIATIVE"), "MOVEMENT");
    assert.equal(nextPhaseInRound(round, "MOVEMENT"), "SHOOTING");
    assert.equal(nextPhaseInRound(round, "SHOOTING"), "COMBAT");
    assert.equal(nextPhaseInRound(round, "COMBAT"), null);
  }
});
