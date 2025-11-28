import { describe, it, expect, beforeEach } from 'vitest';
import { QuestGiverManager } from '../src/engine/QuestGiverManager';
import { NPC, Quest } from '@llmrpg/protocol';
import { v4 as uuidv4 } from 'uuid';

describe('QuestGiverManager', () => {
  let manager: QuestGiverManager;
  let mockNPC: NPC;
  let mockQuest: Quest;

  beforeEach(() => {
    manager = new QuestGiverManager();

    mockNPC = {
      id: uuidv4(),
      type: 'npc',
      name: 'Quest Giver',
      aspects: [],
      skills: [],
      stunts: [],
      stressTracks: [],
      consequences: [],
      fatePoints: { current: 1, refresh: 3 },
      personality: {
        traits: ['helpful'],
        values: ['justice'],
        quirks: [],
        fears: [],
        desires: ['recognition']
      },
      backstory: {
        origin: 'Town',
        formativeEvent: 'Saved a town',
        summary: 'A helpful NPC'
      },
      voice: {
        speechPattern: 'formal',
        vocabulary: 'moderate',
        phrases: [],
        quirks: []
      },
      knowledge: {
        knownFacts: {},
        discoveredLocations: new Set(),
        discoveredNPCs: new Set()
      },
      appearance: 'Wise looking',
      currentLocation: 'loc-1',
      isAlive: true,
      wealth: 100,
      inventory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      relationships: [],
      importance: 'major',
      affiliations: [],
      interactionHistory: [],
      questsGiven: []
    };

    mockQuest = {
      id: 'quest-001',
      title: 'Find the Lost Sword',
      description: 'Search for a legendary sword',
      status: 'active' as const,
      giverId: mockNPC.id,
      objectives: [],
      rewards: { xp: 100, reputation: { 'faction-1': 50 } }
    };
  });

  describe('Quest Assignment', () => {
    it('should assign quest to NPC', () => {
      manager.assignQuestToNPC(mockNPC, mockQuest, 10, 'session-001');

      expect(mockNPC.questsGiven).toHaveLength(1);
      expect(mockNPC.questsGiven[0].questId).toBe('quest-001');
      expect(mockNPC.questsGiven[0].givenTurn).toBe(10);
    });

    it('should prevent duplicate quest assignment', () => {
      manager.assignQuestToNPC(mockNPC, mockQuest, 10, 'session-001');
      manager.assignQuestToNPC(mockNPC, mockQuest, 20, 'session-002');

      expect(mockNPC.questsGiven).toHaveLength(1);
    });

    it('should throw if quest has no giverId', () => {
      mockQuest.giverId = undefined;
      expect(() =>
        manager.assignQuestToNPC(mockNPC, mockQuest, 10, 'session-001')
      ).toThrow();
    });
  });

  describe('Status Updates', () => {
    beforeEach(() => {
      manager.assignQuestToNPC(mockNPC, mockQuest, 10, 'session-001');
    });

    it('should update quest status', () => {
      const success = manager.updateQuestStatus(mockNPC, 'quest-001', 'completed');

      expect(success).toBe(true);
      expect(mockNPC.questsGiven[0].currentStatus).toBe('completed');
    });

    it('should record last player action', () => {
      manager.recordQuestAction(
        mockNPC,
        'quest-001',
        'delivered the sword',
        50,
        'session-001'
      );

      const questGiven = mockNPC.questsGiven[0];
      expect(questGiven.playerLastAction?.description).toBe('delivered the sword');
      expect(questGiven.playerLastAction?.turn).toBe(50);
    });

    it('should return false for non-existent quest', () => {
      const success = manager.updateQuestStatus(mockNPC, 'quest-999', 'completed');
      expect(success).toBe(false);
    });
  });

  describe('Quest Queries', () => {
    beforeEach(() => {
      const quest1 = { ...mockQuest, id: 'quest-001', status: 'active' as const };
      const quest2 = { ...mockQuest, id: 'quest-002', status: 'active' as const };
      const quest3 = { ...mockQuest, id: 'quest-003', status: 'completed' as const };

      manager.assignQuestToNPC(mockNPC, quest1, 5, 'session-001');
      manager.assignQuestToNPC(mockNPC, quest2, 10, 'session-001');
      manager.assignQuestToNPC(mockNPC, quest3, 15, 'session-001');
    });

    it('should get active quests', () => {
      const active = manager.getActiveQuests(mockNPC);
      expect(active).toHaveLength(2);
      expect(active.every(q => q.currentStatus === 'active')).toBe(true);
    });

    it('should get completed quests', () => {
      const completed = manager.getCompletedQuests(mockNPC);
      expect(completed).toHaveLength(1);
      expect(completed[0].questId).toBe('quest-003');
    });

    it('should get total quests given', () => {
      const total = manager.getTotalQuestsGiven(mockNPC);
      expect(total).toBe(3);
    });
  });

  describe('Dialogue Context', () => {
    it('should generate context for NPC with no quests', () => {
      const context = manager.generateQuestContext(mockNPC);
      expect(context).toContain('not given any quests');
    });

    it('should generate general quest context', () => {
      const quest1 = { ...mockQuest, id: 'quest-001', status: 'active' as const };
      const quest2 = { ...mockQuest, id: 'quest-002', status: 'completed' as const };

      manager.assignQuestToNPC(mockNPC, quest1, 5, 'session-001');
      manager.assignQuestToNPC(mockNPC, quest2, 10, 'session-001');

      const context = manager.generateQuestContext(mockNPC);
      expect(context).toContain('2 quests');
      expect(context).toContain('Active quests: 1');
      expect(context).toContain('Completed quests: 1');
    });

    it('should generate specific quest context', () => {
      manager.assignQuestToNPC(mockNPC, mockQuest, 10, 'session-001');
      manager.recordQuestAction(
        mockNPC,
        'quest-001',
        'made progress',
        20,
        'session-001'
      );

      const context = manager.generateQuestContext(mockNPC, 'quest-001');
      expect(context).toContain('Status: active');
      expect(context).toContain('made progress');
    });
  });

  describe('Relationship Checks', () => {
    it('should detect ongoing quest relationship', () => {
      const quest1 = { ...mockQuest, id: 'quest-001', status: 'active' as const };
      const quest2 = { ...mockQuest, id: 'quest-002', status: 'completed' as const };

      manager.assignQuestToNPC(mockNPC, quest1, 5, 'session-001');
      manager.assignQuestToNPC(mockNPC, quest2, 10, 'session-001');

      expect(manager.hasOngoingQuestRelationship(mockNPC)).toBe(true);
    });

    it('should return false when no active quests', () => {
      const quest = { ...mockQuest, id: 'quest-001', status: 'completed' as const };
      manager.assignQuestToNPC(mockNPC, quest, 10, 'session-001');

      expect(manager.hasOngoingQuestRelationship(mockNPC)).toBe(false);
    });

    it('should determine NPC reaction based on quest status', () => {
      const quest1 = { ...mockQuest, id: 'quest-001', status: 'active' as const };
      const quest2 = { ...mockQuest, id: 'quest-002', status: 'completed' as const };

      manager.assignQuestToNPC(mockNPC, quest1, 5, 'session-001');
      manager.assignQuestToNPC(mockNPC, quest2, 10, 'session-001');

      const reaction1 = manager.getNPCQuestReaction(mockNPC, 'quest-001');
      const reaction2 = manager.getNPCQuestReaction(mockNPC, 'quest-002');

      expect(['eager', 'anxious']).toContain(reaction1);
      expect(reaction2).toBe('satisfied');
    });
  });

  describe('Static Utility Methods', () => {
    it('should find all quest givers', () => {
      const npc1 = { ...mockNPC, id: uuidv4(), questsGiven: [] };
      const npc2 = { ...mockNPC, id: uuidv4(), questsGiven: [] };

      manager.assignQuestToNPC(npc1, { ...mockQuest, giverId: npc1.id }, 5, 'session-001');
      // npc2 has no quests

      const givers = QuestGiverManager.getAllQuestGivers([npc1, npc2]);
      expect(givers).toHaveLength(1);
      expect(givers[0].id).toBe(npc1.id);
    });

    it('should find NPC by quest', () => {
      const npc1 = { ...mockNPC, id: uuidv4(), questsGiven: [] };
      const npc2 = { ...mockNPC, id: uuidv4(), questsGiven: [] };

      manager.assignQuestToNPC(npc1, { ...mockQuest, id: 'quest-001', giverId: npc1.id }, 5, 'session-001');

      const found = QuestGiverManager.findNPCByQuest([npc1, npc2], 'quest-001');
      expect(found?.id).toBe(npc1.id);
    });

    it('should generate quest giver summary', () => {
      const npc1 = { ...mockNPC, id: uuidv4(), questsGiven: [] };

      manager.assignQuestToNPC(npc1, { ...mockQuest, id: 'quest-001', status: 'active' as const, giverId: npc1.id }, 5, 'session-001');
      manager.assignQuestToNPC(npc1, { ...mockQuest, id: 'quest-002', status: 'completed' as const, giverId: npc1.id }, 10, 'session-001');

      const summary = QuestGiverManager.generateQuestGiverSummary([npc1]);
      expect(summary[npc1.id].questCount).toBe(2);
      expect(summary[npc1.id].completedCount).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle NPC with undefined questsGiven', () => {
      delete mockNPC.questsGiven;

      expect(manager.getActiveQuests(mockNPC)).toEqual([]);
      expect(manager.getCompletedQuests(mockNPC)).toEqual([]);
      expect(manager.getTotalQuestsGiven(mockNPC)).toBe(0);
    });

    it('should handle empty quest context', () => {
      mockNPC.questsGiven = [];
      const context = manager.generateQuestContext(mockNPC);
      expect(context).toContain('not given any quests');
    });
  });
});
