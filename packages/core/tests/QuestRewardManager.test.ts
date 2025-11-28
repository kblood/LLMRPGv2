import { describe, it, expect, beforeEach } from 'vitest';
import { QuestRewardManager } from '../src/engine/QuestRewardManager';
import { PlayerCharacter, Quest, WorldState } from '@llmrpg/protocol';
import { v4 as uuidv4 } from 'uuid';

describe('QuestRewardManager', () => {
  let rewardManager: QuestRewardManager;
  let worldState: WorldState;
  let player: PlayerCharacter;
  let mockQuest: Quest;

  beforeEach(() => {
    worldState = {
      id: 'world-001',
      theme: { name: 'Default', description: 'Default theme' },
      locations: {},
      npcs: [],
      quests: [],
      factions: {
        'faction-1': {
          id: 'faction-1',
          name: 'Guild of Warriors',
          description: 'A warrior guild',
          aspects: [],
          goals: [],
          members: [],
          relationships: {},
          territory: [],
          resources: [],
          isHidden: false,
        },
        'faction-2': {
          id: 'faction-2',
          name: 'Mage Circle',
          description: 'A mage circle',
          aspects: [],
          goals: [],
          members: [],
          relationships: {},
          territory: [],
          resources: [],
          isHidden: false,
        },
        'faction-3': {
          id: 'faction-3',
          name: 'Dark Order',
          description: 'A dark order',
          aspects: [],
          goals: [],
          members: [],
          relationships: {},
          territory: [],
          resources: [],
          isHidden: false,
        },
      },
      turns: [],
      totalTurns: 0,
      currentScene: '',
      gameStatus: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    rewardManager = new QuestRewardManager(worldState);

    player = {
      id: 'player-001',
      type: 'player' as const,
      name: 'Hero',
      aspects: [],
      skills: [],
      stunts: [],
      stressTracks: [],
      consequences: [],
      fatePoints: { current: 3, refresh: 3 },
      personality: {
        traits: ['brave'],
        values: ['honor'],
        desires: ['glory'],
      },
      backstory: {
        origin: 'Kingdom',
        formativeEvent: 'Became a hero',
        summary: 'A brave adventurer',
      },
      voice: {
        speechPattern: 'formal',
        vocabulary: 'moderate',
      },
      knowledge: {
        locations: {},
        npcs: {},
        quests: {},
        factions: {},
        secrets: {},
        items: {},
        topics: {},
      },
      appearance: 'Brave looking',
      currentLocation: 'loc-1',
      isAlive: true,
      wealth: 100,
      inventory: [],
      relationships: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      goals: [],
      milestones: { minor: 0, significant: 0, major: 0 },
      completedQuestIds: [],
      appliedRewardQuestIds: [],
    };

    mockQuest = {
      id: 'quest-001',
      title: 'Find the Lost Sword',
      description: 'Search for a legendary sword',
      status: 'completed' as const,
      objectives: [],
      rewards: {
        xp: 150,
        reputation: { 'faction-1': 50 },
        items: ['sword-legendary'],
      },
    };

    worldState.quests.push(mockQuest);
  });

  describe('Reward Application', () => {
    it('should apply XP rewards and track milestones', () => {
      const result = rewardManager.applyQuestRewards(player, mockQuest, null, worldState);

      expect(result.success).toBe(true);
      expect(result.appliedRewards.xp).toBe(150);
      expect(player.milestones.minor).toBe(1);
      expect(player.appliedRewardQuestIds).toContain('quest-001');
    });

    it('should apply reputation rewards', () => {
      const result = rewardManager.applyQuestRewards(player, mockQuest, null, worldState);

      expect(result.success).toBe(true);
      expect(result.appliedRewards.reputation).toBeDefined();
      expect(result.appliedRewards.reputation?.['faction-1']).toBeDefined();
    });

    it('should track item rewards', () => {
      const result = rewardManager.applyQuestRewards(player, mockQuest, null, worldState);

      expect(result.success).toBe(true);
      expect(result.appliedRewards.items).toEqual(['sword-legendary']);
    });

    it('should prevent duplicate reward application', () => {
      rewardManager.applyQuestRewards(player, mockQuest, null, worldState);
      const secondResult = rewardManager.applyQuestRewards(player, mockQuest, null, worldState);

      expect(secondResult.success).toBe(false);
      expect(player.appliedRewardQuestIds.filter(id => id === 'quest-001')).toHaveLength(1);
    });

    it('should not apply rewards for incomplete quests', () => {
      const incompleteQuest = { ...mockQuest, status: 'active' as const };
      const result = rewardManager.applyQuestRewards(player, incompleteQuest, null, worldState);

      expect(result.success).toBe(false);
    });
  });

  describe('XP Reward Handling', () => {
    it('should correctly calculate minor milestones (100 XP)', () => {
      const quest100xp = { ...mockQuest, rewards: { xp: 100 } };
      rewardManager.applyQuestRewards(player, quest100xp, null, worldState);

      expect(player.milestones.minor).toBe(1);
      expect(player.milestones.significant).toBe(0);
    });

    it('should correctly calculate significant milestones (300 XP)', () => {
      const quest300xp = { ...mockQuest, rewards: { xp: 300 } };
      rewardManager.applyQuestRewards(player, quest300xp, null, worldState);

      expect(player.milestones.significant).toBe(1);
    });

    it('should correctly calculate major milestones (900 XP)', () => {
      const quest900xp = { ...mockQuest, rewards: { xp: 900 } };
      rewardManager.applyQuestRewards(player, quest900xp, null, worldState);

      expect(player.milestones.major).toBe(1);
    });

    it('should handle multiple XP rewards', () => {
      const quest1 = { ...mockQuest, id: 'quest-001', rewards: { xp: 100 } };
      const quest2 = { ...mockQuest, id: 'quest-002', rewards: { xp: 300 } };

      worldState.quests = [quest1, quest2];

      rewardManager.applyQuestRewards(player, quest1, null, worldState);
      rewardManager.applyQuestRewards(player, quest2, null, worldState);

      // Quest 1: 100 XP = 1 minor milestone
      // Quest 2: 300 XP = 1 significant milestone
      expect(player.milestones.minor).toBe(1);
      expect(player.milestones.significant).toBe(1);
    });
  });

  describe('Pending Reward Handling', () => {
    it('should identify pending quest rewards on session load', () => {
      // Simulate completing quest in previous session
      player.completedQuestIds = ['quest-001'];
      player.appliedRewardQuestIds = [];

      const pending = rewardManager.getPendingRewardQuests(player, worldState);

      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('quest-001');
    });

    it('should apply all pending rewards on session load', () => {
      player.appliedRewardQuestIds = [];
      const quest1 = { ...mockQuest, id: 'quest-001', rewards: { xp: 100 } };
      const quest2 = { ...mockQuest, id: 'quest-002', status: 'completed' as const, rewards: { xp: 150 } };

      worldState.quests = [quest1, quest2];

      const results = rewardManager.applyPendingQuestRewards(player, worldState);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(player.milestones.minor).toBe(2); // 100 + 150 XP = 2 minor milestones
    });

    it('should not re-apply already applied rewards', () => {
      player.appliedRewardQuestIds = ['quest-001'];

      const results = rewardManager.applyPendingQuestRewards(player, worldState);

      expect(results).toHaveLength(0);
    });
  });

  describe('Quest Completion Tracking', () => {
    it('should track quest completion', () => {
      rewardManager.trackQuestCompletion(player, 'quest-001');

      expect(player.completedQuestIds).toContain('quest-001');
    });

    it('should prevent duplicate completion tracking', () => {
      rewardManager.trackQuestCompletion(player, 'quest-001');
      rewardManager.trackQuestCompletion(player, 'quest-001');

      expect(player.completedQuestIds.filter(id => id === 'quest-001')).toHaveLength(1);
    });

    it('should track multiple quest completions', () => {
      rewardManager.trackQuestCompletion(player, 'quest-001');
      rewardManager.trackQuestCompletion(player, 'quest-002');
      rewardManager.trackQuestCompletion(player, 'quest-003');

      expect(player.completedQuestIds).toHaveLength(3);
    });
  });

  describe('Reward Context Generation', () => {
    it('should generate context for no pending rewards', () => {
      player.appliedRewardQuestIds = ['quest-001'];

      const context = rewardManager.generateRewardContext(player, worldState);

      expect(context).toContain('no pending quest rewards');
    });

    it('should generate context for single pending reward', () => {
      player.appliedRewardQuestIds = [];

      const context = rewardManager.generateRewardContext(player, worldState);

      expect(context).toContain('1 quest');
      expect(context).toContain('Find the Lost Sword');
      expect(context).toContain('150 XP');
    });

    it('should generate context for multiple pending rewards', () => {
      const quest1 = { ...mockQuest, id: 'quest-001', rewards: { xp: 100 } };
      const quest2 = { ...mockQuest, id: 'quest-002', title: 'Defeat the Dragon', rewards: { xp: 200 } };

      worldState.quests = [quest1, quest2];
      player.appliedRewardQuestIds = [];

      const context = rewardManager.generateRewardContext(player, worldState);

      expect(context).toContain('2 quests');
      expect(context).toContain('Find the Lost Sword');
      expect(context).toContain('Defeat the Dragon');
    });

    it('should include reputation rewards in context', () => {
      player.appliedRewardQuestIds = [];

      const context = rewardManager.generateRewardContext(player, worldState);

      expect(context).toContain('Reputation');
      expect(context).toContain('faction-1');
    });

    it('should include item rewards in context', () => {
      player.appliedRewardQuestIds = [];

      const context = rewardManager.generateRewardContext(player, worldState);

      expect(context).toContain('1 item(s)');
    });
  });

  describe('Reward Initialization', () => {
    it('should initialize appliedRewardQuestIds if missing', () => {
      delete player.appliedRewardQuestIds;

      rewardManager.applyQuestRewards(player, mockQuest, null, worldState);

      expect(player.appliedRewardQuestIds).toBeDefined();
      expect(player.appliedRewardQuestIds).toContain('quest-001');
    });

    it('should handle player with no milestones', () => {
      delete player.milestones;

      const quest100xp = { ...mockQuest, rewards: { xp: 100 } };
      rewardManager.applyQuestRewards(player, quest100xp, null, worldState);

      expect(player.milestones).toBeDefined();
      expect(player.milestones.minor).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle quest with no rewards', () => {
      const noRewardQuest = { ...mockQuest, rewards: undefined };
      const result = rewardManager.applyQuestRewards(player, noRewardQuest, null, worldState);

      expect(result.success).toBe(true);
      expect(result.appliedRewards).toEqual({});
    });

    it('should handle quest with empty rewards object', () => {
      const emptyRewardQuest = { ...mockQuest, rewards: {} };
      const result = rewardManager.applyQuestRewards(player, emptyRewardQuest, null, worldState);

      expect(result.success).toBe(true);
      expect(result.appliedRewards).toEqual({});
    });

    it('should handle quest with only XP reward', () => {
      const xpOnlyQuest = { ...mockQuest, rewards: { xp: 100 } };
      const result = rewardManager.applyQuestRewards(player, xpOnlyQuest, null, worldState);

      expect(result.success).toBe(true);
      expect(result.appliedRewards.xp).toBe(100);
      expect(player.milestones.minor).toBe(1);
    });

    it('should handle quest with only reputation reward', () => {
      const repOnlyQuest = { ...mockQuest, id: 'quest-rep-only', rewards: { reputation: { 'faction-1': 50 } } };
      worldState.quests.push(repOnlyQuest);
      const result = rewardManager.applyQuestRewards(player, repOnlyQuest, null, worldState);

      expect(result.success).toBe(true);
      expect(result.appliedRewards.reputation).toBeDefined();
      expect(result.appliedRewards.reputation?.['faction-1']).toBe(50);
    });

    it('should handle multiple faction reputation rewards', () => {
      const multiRepQuest = {
        ...mockQuest,
        id: 'quest-multi-rep',
        rewards: {
          reputation: {
            'faction-1': 50,
            'faction-2': 30,
            'faction-3': -20,
          },
        },
      };
      worldState.quests.push(multiRepQuest);
      const result = rewardManager.applyQuestRewards(player, multiRepQuest, null, worldState);

      expect(result.success).toBe(true);
      expect(Object.keys(result.appliedRewards.reputation || {})).toHaveLength(3);
      expect(result.appliedRewards.reputation?.['faction-1']).toBe(50);
      expect(result.appliedRewards.reputation?.['faction-2']).toBe(30);
      expect(result.appliedRewards.reputation?.['faction-3']).toBe(-20);
    });
  });
});
