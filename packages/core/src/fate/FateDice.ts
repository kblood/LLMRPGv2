import { SeededRNG } from '../utils/Random';

export type FateDieResult = -1 | 0 | 1;

export interface FateRollResult {
  dice: [FateDieResult, FateDieResult, FateDieResult, FateDieResult];
  total: number;
}

export class FateDice {
  private rng: SeededRNG;

  constructor(seed: number) {
    this.rng = new SeededRNG(seed);
  }

  /**
   * Rolls 4 Fate dice.
   * Each die is -1, 0, or +1.
   */
  roll(): FateRollResult {
    const dice: FateDieResult[] = [];
    let total = 0;

    for (let i = 0; i < 4; i++) {
      // nextInt(-1, 1) returns -1, 0, or 1
      const die = this.rng.nextInt(-1, 1) as FateDieResult;
      dice.push(die);
      total += die;
    }

    return {
      dice: dice as [FateDieResult, FateDieResult, FateDieResult, FateDieResult],
      total,
    };
  }
}
