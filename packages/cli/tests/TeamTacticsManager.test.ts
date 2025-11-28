import { describe, it, expect, beforeEach } from 'vitest';
import { TeamTacticsManager } from '../src/systems/TeamTacticsManager';
import { ConflictState, PlayerCharacter } from '@llmrpg/protocol';
import { CharacterDefinition } from '@llmrpg/core';
import { v4 as uuidv4 } from 'uuid';

describe('TeamTacticsManager', () => {
  let tacticsManager: TeamTacticsManager;
  let mockConflict: ConflictState;
  let mockPlayer: PlayerCharacter;
  let mockAlly1: CharacterDefinition;
  let mockAlly2: CharacterDefinition;
  let mockOpponent: CharacterDefinition;

  beforeEach(() => {
    tacticsManager = new TeamTacticsManager();

    mockPlayer = {
      id: 'player-001',
      type: 'player',
      name: 'Hero',
      aspects: [],
      skills: [],
      stunts: [],
      stressTracks: [],
      consequences: [],
      fatePoints: { current: 3, refresh: 3 },
      personality: { traits: ['brave'], values: ['honor'], desires: ['glory'] },
      backstory: { origin: 'Kingdom', formativeEvent: 'Became a hero', summary: 'A brave adventurer' },
      voice: { speechPattern: 'formal', vocabulary: 'moderate' },
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} },
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
    } as any;

    mockAlly1 = {
      id: 'ally-001',
      name: 'Ally One',
      aspects: [],
      skills: [],
      stunts: [],
      stressTracks: [],
      consequences: [],
      personality: { traits: ['loyal'], values: ['friendship'], desires: ['adventure'] },
      backstory: { origin: 'Village', formativeEvent: 'Met Hero', summary: 'A loyal companion' },
      voice: { speechPattern: 'casual', vocabulary: 'simple' },
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} },
      appearance: 'Friendly',
      currentLocation: 'loc-1',
      isAlive: true,
    } as any;

    mockAlly2 = {
      id: 'ally-002',
      name: 'Ally Two',
      aspects: [],
      skills: [],
      stunts: [],
      stressTracks: [],
      consequences: [],
      personality: { traits: ['clever'], values: ['knowledge'], desires: ['truth'] },
      backstory: { origin: 'Tower', formativeEvent: 'Learned magic', summary: 'A clever wizard' },
      voice: { speechPattern: 'formal', vocabulary: 'sophisticated' },
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} },
      appearance: 'Mysterious',
      currentLocation: 'loc-1',
      isAlive: true,
    } as any;

    mockOpponent = {
      id: 'opponent-001',
      name: 'Enemy',
      aspects: [],
      skills: [],
      stunts: [],
      stressTracks: [],
      consequences: [],
      personality: { traits: ['fierce'], values: ['power'], desires: ['dominance'] },
      backstory: { origin: 'Wasteland', formativeEvent: 'Survived alone', summary: 'A fierce foe' },
      voice: { speechPattern: 'growl', vocabulary: 'simple' },
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} },
      appearance: 'Intimidating',
      currentLocation: 'loc-1',
      isAlive: true,
    } as any;

    mockConflict = {
      id: 'conflict-001',
      type: 'physical',
      name: 'Test Conflict',
      aspects: [],
      participants: [
        { characterId: 'player-001', side: 'player' as const, hasActed: false, hasConceded: false },
        { characterId: 'ally-001', side: 'player' as const, hasActed: false, hasConceded: false },
        { characterId: 'ally-002', side: 'player' as const, hasActed: false, hasConceded: false },
        { characterId: 'opponent-001', side: 'opposition' as const, hasActed: false, hasConceded: false },
      ],
      turnOrder: ['player-001', 'ally-001', 'ally-002', 'opponent-001'],
      currentTurnIndex: 0,
      currentExchange: 1,
      isResolved: false,
    };
  });

  describe('Coordination', () => {
    it('should identify available coordinators', () => {
      const coordinators = tacticsManager.getAvailableCoordinators(
        mockConflict,
        'player-001',
        'zone-1',
        [mockAlly1, mockAlly2]
      );

      expect(coordinators).toHaveLength(2);
      expect(coordinators.map(c => c.id)).toContain('ally-001');
      expect(coordinators.map(c => c.id)).toContain('ally-002');
    });

    it('should not include conceded allies as coordinators', () => {
      mockConflict.participants[1].hasConceded = true; // Concede ally-001

      const coordinators = tacticsManager.getAvailableCoordinators(
        mockConflict,
        'player-001',
        'zone-1',
        [mockAlly1, mockAlly2]
      );

      expect(coordinators).toHaveLength(1);
      expect(coordinators[0].id).toBe('ally-002');
    });

    it('should calculate coordination bonus', () => {
      const bonus = tacticsManager.calculateCoordinationBonus([mockAlly1, mockAlly2]);

      expect(bonus).toBe(2);
    });

    it('should cap coordination bonus at 3', () => {
      const opponents = [mockAlly1, mockAlly2, mockOpponent];
      opponents.push({
        ...mockOpponent,
        id: 'opponent-002',
        name: 'Enemy Two',
      } as any);

      const bonus = tacticsManager.calculateCoordinationBonus(opponents);

      expect(bonus).toBeLessThanOrEqual(3);
    });

    it('should record coordination', () => {
      tacticsManager.recordCoordination('player-001', ['ally-001', 'ally-002']);

      const recent = tacticsManager.getRecentCoordinators('player-001');
      expect(recent).toHaveLength(2);
      expect(recent).toContain('ally-001');
      expect(recent).toContain('ally-002');
    });
  });

  describe('Coordination Narrative', () => {
    it('should generate single ally coordination narrative', () => {
      const narrative = tacticsManager.generateCoordinationNarrative(
        'player-001',
        [mockAlly1],
        'attack the goblin'
      );

      expect(narrative).toContain('Ally One');
      expect(narrative).toContain('support');
    });

    it('should generate multiple ally coordination narrative', () => {
      const narrative = tacticsManager.generateCoordinationNarrative(
        'player-001',
        [mockAlly1, mockAlly2],
        'cast fireball'
      );

      expect(narrative).toContain('Ally One');
      expect(narrative).toContain('Ally Two');
    });

    it('should return empty string for no coordinators', () => {
      const narrative = tacticsManager.generateCoordinationNarrative('player-001', [], 'act');

      expect(narrative).toBe('');
    });
  });

  describe('Formation Analysis', () => {
    it('should detect tight formation', () => {
      const allyZones = new Map([
        ['ally-001', 'zone-1'],
        ['ally-002', 'zone-1'],
      ]);

      const isTight = tacticsManager.isTightFormation('zone-1', allyZones);

      expect(isTight).toBe(true);
    });

    it('should not detect tight formation when spread out', () => {
      const allyZones = new Map([
        ['ally-001', 'zone-1'],
        ['ally-002', 'zone-2'],
        ['ally-003', 'zone-3'],
      ]);

      const isTight = tacticsManager.isTightFormation('zone-1', allyZones);

      expect(isTight).toBe(false);
    });
  });

  describe('Morale Calculation', () => {
    it('should calculate morale bonus for team size', () => {
      const bonus = tacticsManager.getTeamMoraleBonus(3, 0);

      expect(bonus).toBeGreaterThan(0);
    });

    it('should increase morale with recent coordinations', () => {
      const bonus1 = tacticsManager.getTeamMoraleBonus(2, 0);
      const bonus2 = tacticsManager.getTeamMoraleBonus(2, 3);

      expect(bonus2).toBeGreaterThan(bonus1);
    });
  });

  describe('Combined Attacks', () => {
    it('should identify combined attackers', () => {
      const result = tacticsManager.canPerformCombinedAttack(mockConflict, 'player', 'opponent-001');

      expect(result.canAttack).toBe(true);
      expect(result.combinedAttackers.length).toBeGreaterThan(0);
    });

    it('should cap combined attackers at 3', () => {
      const result = tacticsManager.canPerformCombinedAttack(mockConflict, 'player', 'opponent-001');

      expect(result.combinedAttackers.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Tactical Analysis', () => {
    it('should analyze strong team position', () => {
      const analysis = tacticsManager.getTacticalAnalysis(mockConflict, 'player');

      expect(analysis.teamStrength).toBe('strong');
      expect(analysis.recommendation).toContain('coordinated');
    });

    it('should analyze weak team position', () => {
      mockConflict.participants = [
        { characterId: 'player-001', side: 'player' as const, hasActed: false, hasConceded: false },
        { characterId: 'opponent-001', side: 'opposition' as const, hasActed: false, hasConceded: false },
        { characterId: 'opponent-002', side: 'opposition' as const, hasActed: false, hasConceded: false },
      ];

      const analysis = tacticsManager.getTacticalAnalysis(mockConflict, 'player');

      expect(analysis.teamStrength).toBe('weak');
    });
  });

  describe('Team Composition', () => {
    it('should generate composition with allies', () => {
      const composition = tacticsManager.generateTeamComposition(mockPlayer, [mockAlly1]);

      expect(composition).toContain('Ally One');
    });

    it('should generate solo composition without allies', () => {
      const composition = tacticsManager.generateTeamComposition(mockPlayer, []);

      expect(composition).toContain('stand alone');
    });
  });

  describe('Reset', () => {
    it('should reset coordination tracking', () => {
      tacticsManager.recordCoordination('player-001', ['ally-001']);
      tacticsManager.resetCoordinationTracking();

      const recent = tacticsManager.getRecentCoordinators('player-001');

      expect(recent).toHaveLength(0);
    });
  });
});
