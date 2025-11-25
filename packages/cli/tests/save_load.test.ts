import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

describe('Save and Load System', () => {
  const sessionId = 'save-load-test-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_save_load');
  
  beforeAll(() => {
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(storagePath)) {
      fs.rmSync(storagePath, { recursive: true, force: true });
    }
  });

  it('should save and load game state correctly', async () => {
    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    const sessionLoader = new SessionLoader(fsAdapter);
    
    // 1. Initialize Session
    await sessionWriter.createSession(sessionId, {
        startTime: Date.now(),
        player: "Test Player"
    });

    const llmProvider = new MockAdapter();
    let gameMaster = new GameMaster(sessionId, llmProvider, sessionWriter, sessionLoader);

    // 2. Initialize World & Character
    await gameMaster.initializeWorld("Cyberpunk");
    const player = await gameMaster.createCharacter("A hacker");
    
    expect(player).toBeDefined();
    expect(player.name).toBe("Mock Character");

    // 3. Play a Turn (should generate deltas and save state)
    const result = await gameMaster.processPlayerAction("Hack the terminal");
    expect(result.turn).toBeDefined();
    // expect(result.result).toBe("Success"); // Outcome depends on random dice, so we skip this check

    // 4. Verify Files Exist
    const sessionPath = path.join(storagePath, 'sessions', 'active', sessionId);
    expect(fs.existsSync(path.join(sessionPath, 'world.state.json'))).toBe(true);
    expect(fs.existsSync(path.join(sessionPath, 'player.state.json'))).toBe(true);
    
    // Verify Deltas
    const deltasPath = path.join(sessionPath, 'deltas');
    const deltaFiles = fs.readdirSync(deltasPath);
    expect(deltaFiles.length).toBeGreaterThan(0);
    
    // 5. Load State into NEW GameMaster
    const newGameMaster = new GameMaster(sessionId, llmProvider, sessionWriter, sessionLoader);
    await newGameMaster.loadState();

    // 6. Verify Loaded State
    const loadedState = newGameMaster.getWorldState();
    expect(loadedState.theme.name).toBe("Mock World");
    
    // Access private player property via any cast for testing
    const loadedPlayer = (newGameMaster as any).player;
    expect(loadedPlayer).toBeDefined();
    expect(loadedPlayer.name).toBe("Mock Character");
    expect(loadedPlayer.id).toBe(player.id);

    // Access private currentScene property
    const loadedScene = (newGameMaster as any).currentScene;
    expect(loadedScene).toBeDefined();
    expect(loadedScene.name).toBe("Mock Scenario");
  });
});
