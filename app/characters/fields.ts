export const numericFields = [
  { name: "number", label: "Number", optional: true, decimal: false },
  { name: "fightValueNear", label: "Fight (near)", optional: false, decimal: false },
  { name: "fightValueFar", label: "Fight (far)", optional: true, decimal: false },
  { name: "strength", label: "Strength", optional: false, decimal: false },
  { name: "defense", label: "Defense", optional: false, decimal: false },
  { name: "attacks", label: "Attacks", optional: false, decimal: false },
  { name: "wounds", label: "Wounds", optional: false, decimal: false },
  { name: "courage", label: "Courage", optional: false, decimal: false },
  { name: "baseDiameterCm", label: "Base diameter (cm)", optional: false, decimal: true },
  { name: "heightCm", label: "Height (cm)", optional: true, decimal: true },
  { name: "speedCm", label: "Speed (cm)", optional: false, decimal: true },
] as const;

export const typeLabels = {
  NAMED_HERO: "Named hero",
  HERO: "Hero",
  WARRIOR: "Warrior",
};
