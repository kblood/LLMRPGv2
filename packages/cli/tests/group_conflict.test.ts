import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter } from '@llmrpg/storage';
import { CharacterDefinition } from '@llmrpg/core';

// Mock SessionWriter
const mockSessionWriter = {
  writeTurn: vi.fn(),
  writeDelta: vi.fn(),
  updateCurrentState: vi.fn(),
  initializeSession: vi.fn()
} as unknown as SessionWriter;

describe('Group Conflict System', () => {
  let gameMaster: GameMaster;
  let llmProvider: MockAdapter;
  let originalRandom: () => number;

  beforeEach(async () => {
    llmProvider = new MockAdapter();
    gameMaster = new GameMaster('test-session', llmProvider, mockSessionWriter);
    
    // Mock Math.random to ensure deterministic dice rolls
    originalRandom = Math.random;
    Math.random = () => 0.5; // Should result in 0s for Fate dice usually.
    
    // Initialize World
    llmProvider.setNextResponse(JSON.stringify({ name: 'Mock World', genre: 'Mock Genre', tone: 'Mock Tone', keywords: ['Mock'] }));
    llmProvider.setNextResponse(JSON.stringify({ id: 'loc-1', name: 'Mock Location', description: 'Desc', aspects: [], features: [], presentNPCs: [] }));
    llmProvider.setNextResponse(JSON.stringify({ title: 'Mock Scenario', description: 'Desc', hook: 'A mock hook.' }));
    llmProvider.setNextResponse(JSON.stringify([])); // Factions

    await gameMaster.initializeWorld('Fantasy');

    // Create Player
    llmProvider.setNextResponse(JSON.stringify({
      name: 'Commander',
      appearance: 'Tough',
      aspects: [{ name: 'Commander', type: 'highConcept' }],
      skills: [{ name: 'Fight', level: 4 }, { name: 'Command', level: 3 }],
      stunts: [],
      personality: {
        traits: ['Brave'],
        values: ['Duty'],
        quirks: [],
        fears: [],
        desires: [],
        speechPattern: 'Direct'
      },
      backstory: {
        summary: 'A commander',
        origin: 'The Academy',
        motivation: 'Victory',
        secrets: [],
        keyEvents: []
      },
      voice: {
        speechPattern: 'Direct',
        vocabulary: 'moderate',
        phrases: [],
        quirks: []
      }
    }));

    await gameMaster.createCharacter('Commander');
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('should handle a group combat with allies', async () => {
    // Setup Combat
    const enemies: CharacterDefinition[] = [{
        id: 'npc-goblin',
        name: 'Goblin',
        highConcept: 'Sneaky Goblin',
        trouble: 'Cowardly',
        aspects: ['Small', 'Vicious'],
        skills: { 'Fight': 2 },
        stunts: [],
        stress: { physical: [false, false], mental: [false, false] },
        consequences: {},
        fatePoints: 1,
        personality: { 
            traits: ['Sneaky'], 
            values: ['Survival'], 
            fears: ['Light'], 
            quirks: ['Twitches'], 
            speechPattern: 'Hissing' 
        },
        backstory: { 
            summary: 'Just a goblin', 
            origin: 'Caves', 
            motivation: 'Gold', 
            secrets: [], 
            keyEvents: [] 
        },
        relationships: [],
        knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    }];

    const allies: CharacterDefinition[] = [{
        id: 'npc-ranger',
        name: 'Ranger',
        highConcept: 'Elven Ranger',
        trouble: 'Loner',
        aspects: ['Sharp Eye', 'Bow Master'],
        skills: { 'Shoot': 3 },
        stunts: [],
        stress: { physical: [false, false], mental: [false, false] },
        consequences: {},
        fatePoints: 1,
        personality: { 
            traits: ['Quiet'], 
            values: ['Nature'], 
            fears: ['Fire'], 
            quirks: [], 
            speechPattern: 'Soft' 
        },
        backstory: { 
            summary: 'A ranger', 
            origin: 'Forest', 
            motivation: 'Protect nature', 
            secrets: [], 
            keyEvents: [] 
        },
        relationships: [],
        knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    }];

    await gameMaster.startCombat(enemies, allies);

    // Mock Responses for Combat Turn
    
    // 1. Intent Classification (Called in processPlayerAction)
    llmProvider.setNextResponse('fate_action');

    // 2. Action Classification (Called in processCombatTurn)
    llmProvider.setNextResponse('attack');

    // 3. Skill Selection (Must match a skill name in character definition)
    llmProvider.setNextResponse('Fight');

    // 4. Opposition (Higher to prevent one-shot kill: 4 vs 6 = 2 shifts)
    llmProvider.setNextResponse('4');

    // 5. Player Narration (Boost skipped as not Success with Style)
    llmProvider.setNextResponse('You charge at the goblin!');

    // 6. Ally Action (Ranger)
    llmProvider.setNextResponse(JSON.stringify({
        action: 'attack',
        description: 'fires an arrow at the goblin',
        target: 'Goblin'
    }));

    // 7. Ally Narration
    llmProvider.setNextResponse('The Ranger\'s arrow flies true!');

    // 8. Enemy Action (Goblin)
    llmProvider.setNextResponse(JSON.stringify({
        action: 'attack',
        description: 'stabs at the player',
        target: 'Player'
    }));

    // 9. Enemy Narration
    llmProvider.setNextResponse('The goblin stabs back!');

    // Execute Turn
    const result = await gameMaster.processPlayerAction('I attack the goblin with my sword!');

    // Verify
    expect(result).toBeDefined();
    if (!result || !result.turn) throw new Error("Result or turn is undefined");
    expect(result.turn.events).toBeDefined();
    
    // Check Narration contains all parts
    expect(result.narration).toContain('You charge at the goblin!');
    expect(result.narration).toContain('The Ranger\'s arrow flies true!');
    expect(result.narration).toContain('The goblin stabs back!');
  });
});
