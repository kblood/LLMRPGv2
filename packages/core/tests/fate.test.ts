import { describe, it, expect } from 'vitest';
import { FateDice, ActionResolver, FATE_LADDER, getLadderName } from '../src';

describe('Fate System', () => {
  describe('FateDice', () => {
    it('should be deterministic with the same seed', () => {
      const seed = 12345;
      const roller1 = new FateDice(seed);
      const roller2 = new FateDice(seed);

      const roll1 = roller1.roll();
      const roll2 = roller2.roll();

      expect(roll1).toEqual(roll2);
    });

    it('should produce different results with different seeds', () => {
      const roller1 = new FateDice(12345);
      const roller2 = new FateDice(67890);

      const roll1 = roller1.roll();
      const roll2 = roller2.roll();

      // It is statistically possible but highly unlikely they are identical
      expect(roll1).not.toEqual(roll2);
    });

    it('should always return values between -4 and +4', () => {
      const roller = new FateDice(Date.now());
      for (let i = 0; i < 100; i++) {
        const roll = roller.roll();
        expect(roll.total).toBeGreaterThanOrEqual(-4);
        expect(roll.total).toBeLessThanOrEqual(4);
        expect(roll.dice.length).toBe(4);
        roll.dice.forEach((die) => {
          expect([-1, 0, 1]).toContain(die);
        });
      }
    });
  });

  describe('ActionResolver', () => {
    const mockRoll = (total: number) => ({
      dice: [0, 0, 0, 0] as any,
      total,
    });

    it('should detect failure (shifts < 0)', () => {
      // Roll 0 + Skill 2 = 2. Difficulty 3. Shifts = -1.
      const result = ActionResolver.resolve(mockRoll(0), 2, 3);
      expect(result.outcome).toBe('failure');
      expect(result.shifts).toBe(-1);
    });

    it('should detect tie (shifts = 0)', () => {
      // Roll 0 + Skill 2 = 2. Difficulty 2. Shifts = 0.
      const result = ActionResolver.resolve(mockRoll(0), 2, 2);
      expect(result.outcome).toBe('tie');
      expect(result.shifts).toBe(0);
    });

    it('should detect success (0 < shifts < 3)', () => {
      // Roll 1 + Skill 2 = 3. Difficulty 2. Shifts = 1.
      const result = ActionResolver.resolve(mockRoll(1), 2, 2);
      expect(result.outcome).toBe('success');
      expect(result.shifts).toBe(1);
    });

    it('should detect success with style (shifts >= 3)', () => {
      // Roll 2 + Skill 3 = 5. Difficulty 2. Shifts = 3.
      const result = ActionResolver.resolve(mockRoll(2), 3, 2);
      expect(result.outcome).toBe('success_with_style');
      expect(result.shifts).toBe(3);
    });
  });

  describe('The Ladder', () => {
    it('should have correct values', () => {
      expect(FATE_LADDER.LEGENDARY).toBe(8);
      expect(FATE_LADDER.MEDIOCRE).toBe(0);
      expect(FATE_LADDER.TERRIBLE).toBe(-2);
    });

    it('should resolve names correctly', () => {
      expect(getLadderName(4)).toBe('GREAT');
      expect(getLadderName(0)).toBe('MEDIOCRE');
      expect(getLadderName(10)).toBe('LEGENDARY+');
    });
  });
});
