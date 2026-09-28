/** Both board and combat participants are ordered by ID. */
export function participantColor(index: number, alpha = 1) {
  return `hsl(${(index * 137.508 + 210) % 360} 65% 48% / ${alpha})`;
}
