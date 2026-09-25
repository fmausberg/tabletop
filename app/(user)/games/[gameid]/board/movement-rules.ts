export type Position = { x: number; y: number };
export type MovementOpponent = {
  id: string;
  position: Position;
  baseDiameterCm: number;
  engaged: boolean;
};

export function remainingMovement(speedCm: number, distanceMovedCm: number) {
  return Math.max(0, speedCm - distanceMovedCm);
}

// Pure geometry shared by the preview and the authoritative server action.
// An unengaged opponent's control zone permits the existing contact approach
// even beyond remaining movement; joining an existing melee requires reach.
export function calculateMovement(
  current: Position,
  requested: Position,
  baseDiameterCm: number,
  remainingDistance: number,
  opponents: readonly MovementOpponent[],
) {
  const attacked = opponents.filter((opponent) => {
    const centerDistance = Math.hypot(current.x - opponent.position.x, current.y - opponent.position.y);
    const basesDistance = baseDiameterCm / 2 + opponent.baseDiameterCm / 2;
    const targetDistance = Math.hypot(requested.x - opponent.position.x, requested.y - opponent.position.y);
    return opponent.engaged
      ? centerDistance <= remainingDistance + basesDistance + 1e-9 && targetDistance <= basesDistance
      : targetDistance <= basesDistance + 2;
  }).sort((a, b) => Math.hypot(requested.x - a.position.x, requested.y - a.position.y)
    - Math.hypot(requested.x - b.position.x, requested.y - b.position.y))[0];

  if (attacked) {
    const x = attacked.position.x - current.x;
    const y = attacked.position.y - current.y;
    const centerDistance = Math.hypot(x, y);
    const baseContactDistance = baseDiameterCm / 2 + attacked.baseDiameterCm / 2;
    const travelDistance = Math.max(0, centerDistance - baseContactDistance);
    const factor = centerDistance > 0 ? travelDistance / centerDistance : 0;
    return {
      target: { x: current.x + x * factor, y: current.y + y * factor },
      attackedId: attacked.id,
      limited: false,
    };
  }

  const x = requested.x - current.x;
  const y = requested.y - current.y;
  const distance = Math.hypot(x, y);
  const limited = distance > remainingDistance;
  const factor = limited ? remainingDistance / distance : 1;
  return { target: { x: current.x + x * factor, y: current.y + y * factor }, attackedId: null, limited };
}
