import { describe, it, expect, beforeEach } from 'vitest';
import { ContextBuilder } from '../src/ContextBuilder';
import { CharacterDefinition } from '@llmrpg/core';

// Mock character for testing
const mockCharacter: CharacterDefinition = {
    id: 'test-char-1',
    name: 'Aldric the Brave',
    highConcept: 'Seasoned Monster Hunter',
    trouble: 'Haunted by Past Failures',
    aspects: [
      'I Never Leave a Job Unfinished',
      'Quick Thinking in a Pinch',
      'Distrusts Magic'
    ],
    personality: {
      traits: ['Determined', 'Cautious', 'Pragmatic', 'Sarcastic'],
      values: ['Loyalty', 'Justice', 'Competence'],
      fears: ['Losing Friends', 'Becoming a Monster', 'Powerlessness'],
      quirks: ['Talks to weapons', 'Keeps trophies', 'Drinks too much coffee'],
      speechPattern: 'Direct, uses hunting metaphors, occasional dark humor'
    },
    backstory: {
      summary: 'A seasoned monster hunter who lost his mentor to a cursed creature.',
      origin: 'Grew up in the borderlands between civilization and wilderness',
      motivation: 'Protect others from the horrors he has seen',
      secrets: [
        'The creature that killed his mentor is still alive',
        'He sometimes questions if hunting is worth the cost'
      ],
      keyEvents: [
        'Mentors death - 5 years ago',
        'Discovered the creatures source - 2 years ago',
        'Formed alliance with mages - 1 year ago'
      ]
    },
    skills: {
      Combat: 4,
      Lore: 3,
      Empathy: 2,
      Notice: 3,
      Provoke: 2,
      Will: 3,
      Athletics: 2
    },
    stunts: [
      {
        name: 'Monster Expert',
        description: 'Once per session, gain +2 to Lore when identifying a monster type',
        mechanical: '+2 Lore vs monsters'
      },
      {
        name: 'Quick Draw',
        description: 'Gain +2 to Combat for actions taken first in a conflict',
        mechanical: '+2 Combat first action'
      },
      {
        name: 'Unshakeable',
        description: 'Use Will instead of Empathy when resisting fear effects',
        mechanical: 'Will vs fear'
      }
    ],
    affiliations: [
      {
        factionId: 'hunters-guild',
        factionName: 'Hunters Guild',
        role: 'Master Hunter',
        loyalty: 80
      }
    ],
    stress: {
      physical: [false, false, true],
      mental: [false, false, false]
    },
    consequences: {
      mild: 'Bruised shoulder',
      moderate: undefined,
      severe: undefined
    },
    fatePoints: 3,
    relationships: [
      {
        targetId: 'npc-1',
        targetName: 'Lysandra',
        aspect: 'Saved her from bandits years ago',
        attitude: 60,
        history: 'Mentor-like relationship'
      }
    ],
    knowledge: {
      discovered: ['creatures-of-night', 'ancient-curse'],
      rumors: ['dragon-sightings-east'],
      familiarLocations: ['home-village', 'hunters-lodge']
    }
  };

describe('Phase 28b: Context Optimization', () => {
  let contextBuilder: ContextBuilder;

  beforeEach(() => {
    contextBuilder = new ContextBuilder();
  });

  describe('buildCharacterContextForDecisions', () => {
    it('should create optimized character context with essential fields only', () => {
      const context = contextBuilder.buildCharacterContextForDecisions(mockCharacter);

      // Should include essential fields
      expect(context).toContain('Aldric the Brave');
      expect(context).toContain('Seasoned Monster Hunter');
      expect(context).toContain('Haunted by Past Failures');
      expect(context).toContain('I Never Leave a Job Unfinished');
      expect(context).toContain('Combat (+4)');
      expect(context).toContain('Lore (+3)');

      // Should NOT include detailed personality/backstory
      expect(context).not.toContain('Determined');
      expect(context).not.toContain('Loyalty');
      expect(context).not.toContain('Monster Expert');
      expect(context).not.toContain('seasoned monster hunter who lost');
      expect(context).not.toContain('speechPattern');
    });

    it('should be significantly smaller than full character context', () => {
      const optimized = contextBuilder.buildCharacterContextForDecisions(mockCharacter);
      const full = contextBuilder.buildCharacterContext(mockCharacter);

      // Optimized context should be much smaller - typically 25-35% of full size (65-75% reduction)
      const ratio = optimized.length / full.length;
      expect(ratio).toBeLessThan(0.4); // More than 60% reduction
      expect(ratio).toBeGreaterThan(0.2); // Less than 80% reduction
    });

    it('should include skill ratings in correct format', () => {
      const context = contextBuilder.buildCharacterContextForDecisions(mockCharacter);

      expect(context).toContain('Combat (+4)');
      expect(context).toContain('Lore (+3)');
      expect(context).toContain('Empathy (+2)');
      expect(context).toContain('Notice (+3)');
    });
  });

  describe('buildCharacterContext', () => {
    it('should create full character context with all fields', () => {
      const context = contextBuilder.buildCharacterContext(mockCharacter);

      // Essential fields
      expect(context).toContain('Aldric the Brave');
      expect(context).toContain('Seasoned Monster Hunter');

      // Personality details
      expect(context).toContain('Determined');
      expect(context).toContain('Loyalty');
      expect(context).toContain('Quick Thinking in a Pinch');

      // Backstory details
      expect(context).toContain('seasoned monster hunter');
      expect(context).toContain('Protect others');

      // Stunts with descriptions
      expect(context).toContain('Monster Expert');
      expect(context).toContain('Once per session');
    });
  });

  describe('assemblePrompt with forDecisions flag', () => {
    it('should use optimized context when forDecisions is true', () => {
      const prompt = contextBuilder.assemblePrompt(
        {
          systemPrompt: 'You are a test system',
          characterDefinition: mockCharacter,
          immediateContext: 'Test situation'
        },
        true // forDecisions: true
      );

      // Should use optimized character context
      expect(prompt.user).toContain('Aldric the Brave');
      expect(prompt.user).toContain('Seasoned Monster Hunter');
      expect(prompt.user).not.toContain('Determined'); // personality trait not in optimized
    });

    it('should use full context when forDecisions is false', () => {
      const prompt = contextBuilder.assemblePrompt(
        {
          systemPrompt: 'You are a test system',
          characterDefinition: mockCharacter,
          immediateContext: 'Test situation'
        },
        false // forDecisions: false
      );

      // Should use full character context
      expect(prompt.user).toContain('Aldric the Brave');
      expect(prompt.user).toContain('Determined'); // personality trait in full
      expect(prompt.user).toContain('Monster Expert'); // stunts in full
    });

    it('should have significantly different sizes based on forDecisions flag', () => {
      const optimized = contextBuilder.assemblePrompt(
        {
          systemPrompt: 'You are a test system',
          characterDefinition: mockCharacter,
          immediateContext: 'Test situation'
        },
        true
      );

      const full = contextBuilder.assemblePrompt(
        {
          systemPrompt: 'You are a test system',
          characterDefinition: mockCharacter,
          immediateContext: 'Test situation'
        },
        false
      );

      const ratio = optimized.user.length / full.user.length;
      expect(ratio).toBeLessThan(0.7); // Optimized should be at least 30% smaller
    });
  });

  describe('estimateContextTokens', () => {
    it('should estimate tokens based on character length', () => {
      const text = 'A'.repeat(350); // ~100 tokens (350 / 3.5)
      const tokens = contextBuilder.estimateContextTokens(text);

      expect(tokens).toBeGreaterThan(90);
      expect(tokens).toBeLessThan(110);
    });

    it('should estimate correctly for decision vs full context', () => {
      const optimized = contextBuilder.buildCharacterContextForDecisions(mockCharacter);
      const full = contextBuilder.buildCharacterContext(mockCharacter);

      const optimizedTokens = contextBuilder.estimateContextTokens(optimized);
      const fullTokens = contextBuilder.estimateContextTokens(full);

      // Optimized should use significantly fewer tokens
      expect(optimizedTokens / fullTokens).toBeLessThan(0.6);
    });

    it('should handle empty strings', () => {
      const tokens = contextBuilder.estimateContextTokens('');
      expect(tokens).toBe(0);
    });
  });

  describe('Context Optimization Impact', () => {
    it('should reduce context size for decision making', () => {
      const optimized = contextBuilder.buildCharacterContextForDecisions(mockCharacter);
      const full = contextBuilder.buildCharacterContext(mockCharacter);

      const reduction = 1 - optimized.length / full.length;
      expect(reduction).toBeGreaterThan(0.6); // At least 60% reduction
      expect(reduction).toBeLessThan(0.8); // At most 80% reduction
    });

    it('should preserve critical decision-making fields', () => {
      const optimized = contextBuilder.buildCharacterContextForDecisions(mockCharacter);

      // All aspects should be present
      mockCharacter.aspects.forEach(aspect => {
        expect(optimized).toContain(aspect);
      });

      // All skills should be present
      Object.entries(mockCharacter.skills).forEach(([skill, rating]) => {
        expect(optimized).toContain(`${skill} (+${rating})`);
      });
    });

    it('should remove non-essential narrative fields from optimized context', () => {
      const optimized = contextBuilder.buildCharacterContextForDecisions(mockCharacter);

      // Personality should not be in optimized
      expect(optimized).not.toContain('PERSONALITY');
      expect(optimized).not.toContain('Determined');
      expect(optimized).not.toContain('Loyalty');

      // Backstory should not be in optimized
      expect(optimized).not.toContain('BACKSTORY');
      expect(optimized).not.toContain('seasoned monster hunter');

      // Stunts should not be in optimized
      expect(optimized).not.toContain('STUNTS');
      expect(optimized).not.toContain('Monster Expert');
    });
  });
});
