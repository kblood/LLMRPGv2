export const FATE_LADDER = {
  LEGENDARY: 8,
  EPIC: 7,
  FANTASTIC: 6,
  SUPERB: 5,
  GREAT: 4,
  GOOD: 3,
  FAIR: 2,
  AVERAGE: 1,
  MEDIOCRE: 0,
  POOR: -1,
  TERRIBLE: -2,
} as const;

export type FateLadderLevel = keyof typeof FATE_LADDER;

export function getLadderName(value: number): string {
  const entry = Object.entries(FATE_LADDER).find(([_, v]) => v === value);
  return entry ? entry[0] : value > 8 ? 'LEGENDARY+' : 'TERRIBLE-';
}
