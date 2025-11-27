import { describe, it, expect, beforeEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const STORAGE_PATH = path.join(__dirname, '../test-sessions');

describe('Refresh Mechanics', () => {
  let gm: GameMaster;
  let mockLLM: MockAdapter;
  let sessionWriter: SessionWriter;
  let sessionLoader: SessionLoader;
  let sessionId: string;

  beforeEach(async () => {
    sessionId = `refresh-test-${Date.now()}`;
    
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
  });

  it('should calculate refresh based on stunts', async () => {
    // Mock character with 4 stunts (refresh = 3 - 1 = 2)
    const mockChar = {
      name: 'Stunt Master',
      appearance: 'Flashy',
      aspects: [{ name: 'High Concept', type: 'highConcept' }, { name: 'Trouble', type: 'trouble' }],
      skills: [{ name: 'Athletics', level: 4 }],
      stunts: [
        { name: 'Stunt 1', description: 'Desc' },
        { name: 'Stunt 2', description: 'Desc' },
        { name: 'Stunt 3', description: 'Desc' },
        { name: 'Stunt 4', description: 'Desc' }
      ],
      personality: {},
      backstory: {},
      voice: {}
    };
    
    (gm as any).contentGenerator.generateCharacter = async () => mockChar;
    
    await gm.createCharacter('Stunt Master');
    
    const player = (gm as any).player;
    expect(player?.fatePoints.refresh).toBe(2); // 3 base - 1 extra stunt cost
    expect(player?.fatePoints.current).toBe(2);
  });

  it('should refresh FP to refresh level when below', async () => {
    await gm.createCharacter('Test Character');
    await gm.start();
    
    const player = (gm as any).player;
    const refresh = player?.fatePoints.refresh || 3;
    
    // Set FP below refresh
    player.fatePoints.current = 0;
    
    // Start a turn so refreshFatePoints can log events
    const turnManager = (gm as any).turnManager;
    turnManager.startTurn('player', 'scene-test', { day: 1, timeOfDay: 'morning', timestamp: Date.now() });
    
    gm.refreshFatePoints();
    
    expect(player?.fatePoints.current).toBe(refresh);
  });

  it('should keep excess FP when above refresh', async () => {
    await gm.createCharacter('Test Character');
    await gm.start();
    
    const player = (gm as any).player;
    
    // Set FP above refresh
    player.fatePoints.current = 5;
    
    // Start a turn so refreshFatePoints can log events (even though it won't change FP)
    const turnManager = (gm as any).turnManager;
    turnManager.startTurn('player', 'scene-test', { day: 1, timeOfDay: 'morning', timestamp: Date.now() });
    
    gm.refreshFatePoints();
    
    expect(player?.fatePoints.current).toBe(5); // Should keep excess
  });
});
