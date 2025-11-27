import { FateRollResult, FateDieResult } from './FateDice';

export type FateOutcome = 'failure' | 'tie' | 'success' | 'success_with_style';

export interface InvokeBonus {
  aspectId: string;
  bonus: number | 'reroll'; // +2 or reroll
  fatePointSpent: boolean;
}

export interface ResolutionResult {
  roll: FateRollResult;
  skillRating: number;
  difficulty: number;
  invokes: InvokeBonus[];
  total: number;
  shifts: number;
  outcome: FateOutcome;
}

export class ActionResolver {
  /**
   * Resolves an action by comparing a roll + skill + invokes against a difficulty.
   *
   * @param roll The result of the 4dF roll
   * @param skillRating The character's skill level (e.g., +3 for Good)
   * @param difficulty The target number to beat (e.g., +2 for Fair)
   * @param invokes Array of aspect invocations applied to this roll
   */
  static resolve(
    roll: FateRollResult,
    skillRating: number,
    difficulty: number,
    invokes: InvokeBonus[] = [],
  ): ResolutionResult {
    // Calculate invoke bonuses
    let invokeBonus = 0;
    const rerollUsed = invokes.some(invoke => invoke.bonus === 'reroll');
    
    // Apply reroll if used (take the better of original or reroll)
    let finalRoll = roll;
    if (rerollUsed) {
      const dice: [FateDieResult, FateDieResult, FateDieResult, FateDieResult] = [
          (Math.floor(Math.random() * 3) - 1) as FateDieResult,
          (Math.floor(Math.random() * 3) - 1) as FateDieResult,
          (Math.floor(Math.random() * 3) - 1) as FateDieResult,
          (Math.floor(Math.random() * 3) - 1) as FateDieResult
      ];
      const total = dice.reduce((sum: number, die: number) => sum + die, 0);
      const reroll: FateRollResult = { dice, total };
      
      finalRoll = reroll.total > roll.total ? reroll : roll;
      // Reroll itself doesn't add +2, it just replaces the roll.
      // But if we are invoking for a reroll, we don't add +2.
    }
    
    // Add other invoke bonuses
    invokeBonus += invokes
      .filter(invoke => invoke.bonus !== 'reroll')
      .reduce((sum, invoke) => sum + (typeof invoke.bonus === 'number' ? invoke.bonus : 0), 0);

    const total = finalRoll.total + skillRating + invokeBonus;
    const shifts = total - difficulty;

    let outcome: FateOutcome;

    if (shifts < 0) {
      outcome = 'failure';
    } else if (shifts === 0) {
      outcome = 'tie';
    } else if (shifts >= 3) {
      outcome = 'success_with_style';
    } else {
      outcome = 'success';
    }

    return {
      roll: finalRoll,
      skillRating,
      difficulty,
      invokes,
      total,
      shifts,
      outcome,
    };
  }
}
