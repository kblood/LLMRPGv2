import { FateRollResult } from './FateDice';

export type FateOutcome = 'failure' | 'tie' | 'success' | 'success_with_style';

export interface ResolutionResult {
  roll: FateRollResult;
  skillRating: number;
  difficulty: number;
  total: number;
  shifts: number;
  outcome: FateOutcome;
}

export class ActionResolver {
  /**
   * Resolves an action by comparing a roll + skill against a difficulty.
   *
   * @param roll The result of the 4dF roll
   * @param skillRating The character's skill level (e.g., +3 for Good)
   * @param difficulty The target number to beat (e.g., +2 for Fair)
   */
  static resolve(
    roll: FateRollResult,
    skillRating: number,
    difficulty: number,
  ): ResolutionResult {
    const total = roll.total + skillRating;
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
      roll,
      skillRating,
      difficulty,
      total,
      shifts,
      outcome,
    };
  }
}
