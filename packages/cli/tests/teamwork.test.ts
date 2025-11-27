
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter } from '@llmrpg/storage';
import { CharacterDefinition } from '@llmrpg/core';

// Mock dependencies
const mockSessionWriter = {
  writeTurn: vi.fn(),
  writeDelta: vi.fn(),
  updateCurrentState: vi.fn(),
  createSession: vi.fn().mockResolvedValue('session-123')
} as unknown as SessionWriter;

describe('Teamwork System', () => {
  let gm: GameMaster;
  let mockLLM: MockAdapter;

  beforeEach(async () => {
    mockLLM = new MockAdapter();
    gm = new GameMaster('test-session', mockLLM, mockSessionWriter);
    
    // Initialize world and player
    await gm.initializeWorld('Fantasy');
    await gm.createCharacter('Warrior');
    
    // Mock NPC
    const npc: CharacterDefinition = {
        id: 'npc-1',
        name: 'Lysandra',
        highConcept: 'Mage',
        trouble: 'Fragile',
        aspects: ['Mage', 'Fragile'],
        skills: { Lore: 4 },
        stunts: [],
        personality: { traits: [], values: [], fears: [], quirks: [], speechPattern: '' },
        backstory: { summary: '', origin: '', motivation: '', secrets: [], keyEvents: [] },
        stress: { physical: [], mental: [] },
        consequences: {},
        fatePoints: 3,
        relationships: [],
        knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    };
    
    // Inject NPC into GM
    (gm as any).npcs['npc-1'] = npc;
    
    // Add NPC to current location
    const scene = (gm as any).currentScene;
    const location = (gm as any).worldManager.getLocation(scene.locationId);
    location.presentNPCs = ['npc-1'];
  });

  it('should process teamwork action successfully', async () => {
    // Mock DecisionEngine responses
    vi.spyOn((gm as any).decisionEngine, 'classifyIntent').mockResolvedValue('teamwork');
    vi.spyOn((gm as any).decisionEngine, 'parseTeamwork').mockResolvedValue({
        targetName: 'Lysandra',
        description: 'Helping her lift the rock'
    });
    vi.spyOn((gm as any).decisionEngine, 'selectSkill').mockResolvedValue({ name: 'Physique', rating: 3 });
    
    // Mock Dice to succeed (Roll 0 + Skill 3 vs Diff 2 = Success)
    vi.spyOn((gm as any).fateDice, 'roll').mockReturnValue({ dice: [0, 0, 0, 0], total: 0 });

    const result = await gm.processPlayerAction("I help Lysandra lift the rock");

    expect(result.result).toBe('success');
    expect(result.narration).toContain('You successfully help Lysandra');
    
    // Verify aspect creation
    const scene = (gm as any).currentScene;
    const location = (gm as any).worldManager.getLocation(scene.locationId);
    const aspect = location.aspects.find((a: any) => a.name.includes('Assisted by'));
    
    expect(aspect).toBeDefined();
    expect(aspect.freeInvokes).toBe(1); // Success = 1 free invoke
  });

  it('should fail teamwork if target not present', async () => {
    vi.spyOn((gm as any).decisionEngine, 'classifyIntent').mockResolvedValue('teamwork');
    vi.spyOn((gm as any).decisionEngine, 'parseTeamwork').mockResolvedValue({
        targetName: 'Ghost',
        description: 'Helping the ghost'
    });

    const result = await gm.processPlayerAction("I help the ghost");

    expect(result.result).toBe('failure');
    expect(result.narration).toContain('not here');
  });
});
