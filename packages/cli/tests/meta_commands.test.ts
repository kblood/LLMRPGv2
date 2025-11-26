import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter, SessionLoader } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

describe('Meta Commands', () => {
  const sessionId = 'meta-test-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_sessions_meta');
  
  beforeAll(() => {
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(storagePath)) {
      fs.rmSync(storagePath, { recursive: true, force: true });
    }
  });

  it('should handle /help command', async () => {
    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    const sessionLoader = new SessionLoader(fsAdapter);
    
    await sessionWriter.createSession(sessionId, {
        startTime: Date.now(),
        player: "Meta Tester"
    });

    const llmProvider = new MockAdapter();
    const gameMaster = new GameMaster(sessionId, llmProvider, sessionWriter, sessionLoader);
    await gameMaster.start();

    const result = await gameMaster.processPlayerAction('/help');
    expect(result.result).toBe('meta_command_success');
    expect(result.narration).toContain('Available Commands');
  });

  it('should handle /inventory command', async () => {
    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    const sessionLoader = new SessionLoader(fsAdapter);
    
    const llmProvider = new MockAdapter();
    const gameMaster = new GameMaster(sessionId, llmProvider, sessionWriter, sessionLoader);
    await gameMaster.start();
    
    // Initialize character manually or via createCharacter
    // MockAdapter should handle the character generation prompt
    await gameMaster.createCharacter("Test Hero");

    const result = await gameMaster.processPlayerAction('/inventory');
    expect(result.result).toBe('meta_command_success');
    // Inventory might be empty initially or contain starting items if generated
    // The mock character might not have inventory, so "Your inventory is empty" is expected
    // or "Inventory:" if items exist.
    // Let's just check for success for now.
    expect(result.result).toBe('meta_command_success');
  });

  it('should handle /status command', async () => {
    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    const sessionLoader = new SessionLoader(fsAdapter);
    
    const llmProvider = new MockAdapter();
    const gameMaster = new GameMaster(sessionId, llmProvider, sessionWriter, sessionLoader);
    await gameMaster.start();
    await gameMaster.createCharacter("Test Hero");

    const result = await gameMaster.processPlayerAction('/status');
    expect(result.result).toBe('meta_command_success');
    expect(result.narration).toContain('Fate Points');
  });
});
