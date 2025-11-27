import { describe, it, expect, beforeEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const STORAGE_PATH = path.join(__dirname, '../test-sessions');

describe('Concession System', () => {
  let gm: GameMaster;
  let mockLLM: MockAdapter;
  let sessionWriter: SessionWriter;
  let sessionLoader: SessionLoader;
  let sessionId: string;

  beforeEach(async () => {
    sessionId = `concession-test-${Date.now()}`;
    
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }
    
    const fsAdapter = new FileSystemAdapter(STORAGE_PATH);
    sessionWriter = new SessionWriter(fsAdapter);
    sessionLoader = new SessionLoader(fsAdapter);
    
    await sessionWriter.createSession(sessionId, {
      startTime: Date.now(),
      player: 'Test Player'
    });
    
    mockLLM = new MockAdapter();
    gm = new GameMaster(sessionId, mockLLM, sessionWriter, sessionLoader);
    
    await gm.initializeWorld('Dark Fantasy');
    await gm.createCharacter('A weary warrior');
    await gm.start();
  });

  it('should award FP and end conflict when conceding', async () => {
    // Start a conflict first
    const opponent = {
      id: 'npc-goblin',
      type: 'npc',
      name: 'Goblin',
      appearance: 'A nasty goblin',
      aspects: [{ id: 'asp-1', name: 'Nasty Goblin', type: 'high_concept', freeInvokes: 0 }],
      skills: [{ name: 'Fight', rank: 2 }],
      stunts: [],
      stressTracks: [{ type: 'physical', capacity: 2, boxes: [false, false] }],
      consequences: [],
      fatePoints: { current: 1, refresh: 1 },
      personality: { traits: [] },
      backstory: { summary: 'A goblin' },
      voice: { tone: 'Gruff' },
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} },
      relationships: [],
      currentLocation: 'loc-1',
      isAlive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await gm.startCombat([opponent as any]);
    
    // Mock classifyIntent to return 'concede'
    (gm as any).decisionEngine.classifyIntent = async () => 'concede';
    (gm as any).decisionEngine.generateCompel = async () => null;
    
    const initialFP = (gm as any).player?.fatePoints.current || 0;
    
    const result = await gm.processPlayerAction('I surrender and run away.') as any;
    
    expect(result.result).toBe('conceded');
    expect((gm as any).player?.fatePoints.current).toBe(initialFP + 1);
    expect((gm as any).currentScene?.conflict?.isResolved).toBe(true);
    expect((gm as any).currentScene?.conflict?.winner).toBe('opposition');
  });

  it('should award extra FP for consequences taken', async () => {
    const opponent = {
      id: 'npc-goblin',
      type: 'npc',
      name: 'Goblin',
      appearance: 'A nasty goblin',
      aspects: [{ id: 'asp-1', name: 'Nasty Goblin', type: 'high_concept', freeInvokes: 0 }],
      skills: [{ name: 'Fight', rank: 2 }],
      stunts: [],
      stressTracks: [{ type: 'physical', capacity: 2, boxes: [false, false] }],
      consequences: [],
      fatePoints: { current: 1, refresh: 1 },
      personality: { traits: [] },
      backstory: { summary: 'A goblin' },
      voice: { tone: 'Gruff' },
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} },
      relationships: [],
      currentLocation: 'loc-1',
      isAlive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await gm.startCombat([opponent as any]);
    
    // Give player a consequence
    if ((gm as any).player) {
      (gm as any).player.consequences.push({
        severity: 'mild',
        name: 'Bruised Ribs',
        freeInvokes: 0
      });
    }
    
    (gm as any).decisionEngine.classifyIntent = async () => 'concede';
    (gm as any).decisionEngine.generateCompel = async () => null;
    
    const initialFP = (gm as any).player?.fatePoints.current || 0;
    
    await gm.processPlayerAction('I surrender.');
    
    // Should get 1 base + 1 for consequence = 2 FP
    expect((gm as any).player?.fatePoints.current).toBe(initialFP + 2);
  });
});
