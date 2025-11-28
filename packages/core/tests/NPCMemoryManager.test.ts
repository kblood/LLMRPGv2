import { describe, it, expect, beforeEach } from 'vitest';
import { NPCMemoryManager } from '../src/engine/NPCMemoryManager';
import { NPC, Relationship } from '@llmrpg/protocol';
import { v4 as uuidv4 } from 'uuid';

describe('NPCMemoryManager', () => {
  let memoryManager: NPCMemoryManager;
  let mockNPC: NPC;
  let mockRelationship: Relationship;

  beforeEach(() => {
    memoryManager = new NPCMemoryManager();

    // Create mock NPC
    mockNPC = {
      id: uuidv4(),
      type: 'npc',
      name: 'Blacksmith Bob',
      aspects: [],
      skills: [],
      stunts: [],
      stressTracks: [],
      consequences: [],
      fatePoints: { current: 1, refresh: 3 },
      personality: {
        traits: ['gruff', 'honest'],
        values: ['craftsmanship'],
        quirks: ['talks too much about metal'],
        fears: [],
        desires: ['recognition']
      },
      backstory: {
        origin: 'Mountain smithy',
        formativeEvent: 'Lost his hammer in a fire',
        summary: 'A weathered blacksmith'
      },
      voice: {
        speechPattern: 'gruff',
        vocabulary: 'simple',
        phrases: [],
        quirks: []
      },
      knowledge: {
        knownFacts: {},
        discoveredLocations: new Set(),
        discoveredNPCs: new Set()
      },
      appearance: 'Muscular, soot-covered',
      currentLocation: 'loc-1',
      isAlive: true,
      wealth: 50,
      inventory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      relationships: [],
      importance: 'supporting',
      affiliations: [],
      interactionHistory: []
    };

    // Create mock player relationship
    mockRelationship = {
      targetId: 'player-1',
      targetName: 'Hero',
      type: 'neutral',
      trust: 0,
      affection: 0,
      respect: 0,
      influence: 0,
      history: [],
      lastInteractionTurn: undefined
    };

    mockNPC.relationships.push(mockRelationship);
  });

  describe('Recording Interactions', () => {
    it('should record an interaction', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'helped fix the furnace',
        'success',
        { trust: 1, affection: 1, respect: 1 },
        10,
        'session-001'
      );

      expect(mockNPC.interactionHistory).toHaveLength(1);
      expect(mockNPC.interactionHistory[0].action).toBe('helped fix the furnace');
      expect(mockNPC.interactionHistory[0].outcome).toBe('success');
      expect(mockNPC.interactionHistory[0].turn).toBe(10);
    });

    it('should update relationship values on interaction', () => {
      const initialTrust = mockRelationship.trust;

      memoryManager.recordInteraction(
        mockNPC,
        'paid for custom sword',
        'success',
        { trust: 2, affection: 1, respect: 2 },
        5,
        'session-001'
      );

      expect(mockRelationship.trust).toBe(initialTrust + 2);
      expect(mockRelationship.affection).toBe(1);
      expect(mockRelationship.respect).toBe(2);
    });

    it('should cap relationship values at extremes', () => {
      // Try to push trust beyond +3
      memoryManager.recordInteraction(
        mockNPC,
        'act 1',
        'success',
        { trust: 2, affection: 0, respect: 0 },
        1,
        'session-001'
      );

      memoryManager.recordInteraction(
        mockNPC,
        'act 2',
        'success',
        { trust: 2, affection: 0, respect: 0 },
        2,
        'session-001'
      );

      expect(mockRelationship.trust).toBe(3); // Should be capped at 3
    });

    it('should handle negative interactions', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'insulted his work',
        'neutral',
        { trust: -2, affection: -1, respect: -2 },
        15,
        'session-001'
      );

      expect(mockRelationship.trust).toBe(-2);
      expect(mockRelationship.affection).toBe(-1);
      expect(mockRelationship.respect).toBe(-2);
    });
  });

  describe('Querying Interactions', () => {
    beforeEach(() => {
      memoryManager.recordInteraction(
        mockNPC,
        'helped fix furnace',
        'success',
        { trust: 1, affection: 1, respect: 1 },
        10,
        'session-001'
      );

      memoryManager.recordInteraction(
        mockNPC,
        'commissioned a sword',
        'success',
        { trust: 1, affection: 0, respect: 1 },
        20,
        'session-002'
      );
    });

    it('should get last interaction', () => {
      const last = memoryManager.getLastInteraction(mockNPC);
      expect(last?.action).toBe('commissioned a sword');
      expect(last?.sessionId).toBe('session-002');
    });

    it('should get interactions from specific session', () => {
      const session1 = memoryManager.getInteractionsInSession(mockNPC, 'session-001');
      expect(session1).toHaveLength(1);
      expect(session1[0].action).toBe('helped fix furnace');

      const session2 = memoryManager.getInteractionsInSession(mockNPC, 'session-002');
      expect(session2).toHaveLength(1);
      expect(session2[0].action).toBe('commissioned a sword');
    });

    it('should count total interactions', () => {
      const count = memoryManager.getTotalInteractionCount(mockNPC);
      expect(count).toBe(2);
    });

    it('should calculate cumulative relationship impact', () => {
      const impact = memoryManager.getCumulativeRelationshipImpact(mockNPC);
      expect(impact.trust).toBe(2);
      expect(impact.affection).toBe(1);
      expect(impact.respect).toBe(2);
    });
  });

  describe('Analyzing Interaction Patterns', () => {
    it('should calculate success rate', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'helped',
        'success',
        { trust: 1, affection: 0, respect: 0 },
        1,
        'session-001'
      );

      memoryManager.recordInteraction(
        mockNPC,
        'stole',
        'failure',
        { trust: -2, affection: 0, respect: 0 },
        2,
        'session-001'
      );

      memoryManager.recordInteraction(
        mockNPC,
        'negotiated',
        'success',
        { trust: 1, affection: 0, respect: 1 },
        3,
        'session-001'
      );

      const pattern = memoryManager.getInteractionPattern(mockNPC);
      expect(pattern.totalInteractions).toBe(3);
      expect(pattern.successRate).toBeCloseTo(2 / 3, 2); // 66%, rounded to 2 decimals = 0.67
    });

    it('should find most common action', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'traded gold',
        'success',
        { trust: 0, affection: 0, respect: 0 },
        1,
        'session-001'
      );

      memoryManager.recordInteraction(
        mockNPC,
        'traded gold',
        'success',
        { trust: 0, affection: 0, respect: 0 },
        2,
        'session-001'
      );

      memoryManager.recordInteraction(
        mockNPC,
        'chatted',
        'neutral',
        { trust: 0, affection: 0, respect: 0 },
        3,
        'session-001'
      );

      const pattern = memoryManager.getInteractionPattern(mockNPC);
      expect(pattern.mostCommonAction).toBe('traded gold');
    });

    it('should detect positive trend', () => {
      // Create sequence: bad, good, good, good, good (improving trend)
      memoryManager.recordInteraction(
        mockNPC,
        'insult',
        'failure',
        { trust: -2, affection: -2, respect: -2 },
        1,
        'session-001'
      );

      for (let i = 2; i <= 5; i++) {
        memoryManager.recordInteraction(
          mockNPC,
          'help',
          'success',
          { trust: 2, affection: 2, respect: 2 },
          i,
          'session-001'
        );
      }

      const pattern = memoryManager.getInteractionPattern(mockNPC);
      expect(pattern.recentTrend).toBe('improving');
    });
  });

  describe('Memory Context Generation', () => {
    it('should generate context for interactions', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'helped fix furnace',
        'success',
        { trust: 2, affection: 1, respect: 1 },
        10,
        'session-001'
      );

      const context = memoryManager.generateMemoryContext(mockNPC);
      expect(context).toContain('1 time');
      expect(context).toContain('trust them');
      expect(context).toContain('like them');
      expect(context).toContain('helped fix furnace');
    });

    it('should include negative relationship context', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'stole from',
        'failure',
        { trust: -2, affection: -1, respect: -2 },
        10,
        'session-001'
      );

      const context = memoryManager.generateMemoryContext(mockNPC);
      expect(context).toContain('distrust them');
      expect(context).toContain('dislike them');
    });

    it('should limit recent interactions shown', () => {
      for (let i = 1; i <= 10; i++) {
        memoryManager.recordInteraction(
          mockNPC,
          `action ${i}`,
          'success',
          { trust: 0, affection: 0, respect: 0 },
          i,
          'session-001'
        );
      }

      const context = memoryManager.generateMemoryContext(mockNPC, 3);
      expect(context).toContain('action 10');
      expect(context).toContain('action 9');
      expect(context).toContain('action 8');
      // Check that only 3 recent interactions are shown in the list
      const recentMatch = context.match(/Recent interactions:\n([\s\S]+)/);
      expect(recentMatch).toBeTruthy();
      if (recentMatch) {
        const recentLines = recentMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
        expect(recentLines).toHaveLength(3);
      }
    });
  });

  describe('Grudge and Regard Detection', () => {
    it('should detect grudge from repeated negative interactions', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'betrayed',
        'failure',
        { trust: -3, affection: 0, respect: -3 },
        1,
        'session-001'
      );

      memoryManager.recordInteraction(
        mockNPC,
        'insulted',
        'failure',
        { trust: -2, affection: 0, respect: 0 },
        2,
        'session-001'
      );

      expect(memoryManager.shouldHoldGrudge(mockNPC)).toBe(true);
    });

    it('should detect positive regard from repeated positive interactions', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'helped',
        'success',
        { trust: 3, affection: 2, respect: 0 },
        1,
        'session-001'
      );

      memoryManager.recordInteraction(
        mockNPC,
        'gifted',
        'success',
        { trust: 1, affection: 1, respect: 1 },
        2,
        'session-001'
      );

      expect(memoryManager.hasPositiveRegard(mockNPC)).toBe(true);
    });

    it('should get list of grudges', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'stole gold',
        'failure',
        { trust: -2, affection: 0, respect: 0 },
        1,
        'session-001'
      );

      memoryManager.recordInteraction(
        mockNPC,
        'insulted craft',
        'failure',
        { trust: 0, affection: 0, respect: -2 },
        2,
        'session-001'
      );

      memoryManager.recordInteraction(
        mockNPC,
        'helped',
        'success',
        { trust: 1, affection: 0, respect: 0 },
        3,
        'session-001'
      );

      const grudges = memoryManager.getGrudges(mockNPC);
      expect(grudges).toContain('stole gold');
      expect(grudges).toContain('insulted craft');
      expect(grudges).not.toContain('helped');
    });
  });

  describe('Applying Memory Effects', () => {
    it('should set grudge-based agenda', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'betrayed',
        'failure',
        { trust: -3, affection: 0, respect: -3 },
        1,
        'session-001'
      );

      memoryManager.applyMemoryEffects(mockNPC, mockRelationship);
      expect(mockNPC.currentAgenda).toContain('Teach');
    });

    it('should set helpful agenda for positive regard', () => {
      memoryManager.recordInteraction(
        mockNPC,
        'helped',
        'success',
        { trust: 3, affection: 2, respect: 1 },
        1,
        'session-001'
      );

      memoryManager.applyMemoryEffects(mockNPC, mockRelationship);
      expect(mockNPC.currentAgenda).toContain('Help');
    });
  });

  describe('Edge Cases', () => {
    it('should handle NPC with no interaction history', () => {
      mockNPC.interactionHistory = [];

      const last = memoryManager.getLastInteraction(mockNPC);
      expect(last).toBeUndefined();

      const count = memoryManager.getTotalInteractionCount(mockNPC);
      expect(count).toBe(0);

      const pattern = memoryManager.getInteractionPattern(mockNPC);
      expect(pattern.totalInteractions).toBe(0);
      expect(pattern.successRate).toBe(0);
    });

    it('should handle undefined interaction history', () => {
      delete mockNPC.interactionHistory;

      const count = memoryManager.getTotalInteractionCount(mockNPC);
      expect(count).toBe(0);
    });

    it('should generate context with no interactions', () => {
      const context = memoryManager.generateMemoryContext(mockNPC);
      expect(context).toContain('no prior interactions');
    });
  });
});
