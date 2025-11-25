import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

describe('Full Playthrough', () => {
  const sessionId = 'test-session-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_sessions');
  
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

  it('should run a complete session flow', async () => {
    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    
    await sessionWriter.createSession(sessionId, {
        startTime: Date.now(),
        player: "Test Player"
    });

    const llmProvider = new MockAdapter();
    const gameMaster = new GameMaster(sessionId, llmProvider, sessionWriter);

    await gameMaster.start();

    // Turn 1
    const result1 = await gameMaster.processPlayerAction("Look around");
    expect(result1.turn).toBeDefined();
    expect(result1.turn.turnNumber).toBe(1);
    expect(result1.turn.events.length).toBeGreaterThan(0);
    expect(result1.narration).toContain("Game Master narrates");
    expect(result1.result).toBeDefined();

    // Turn 2
    const result2 = await gameMaster.processPlayerAction("Open the door");
    expect(result2.turn).toBeDefined();
    expect(result2.turn.turnNumber).toBe(2);
    expect(result2.narration).toContain("Game Master narrates");

    // Verify Storage
    const sessionPath = path.join(storagePath, 'sessions', 'active', sessionId);
    
    // 1. Check Metadata
    const metaPath = path.join(sessionPath, 'session.meta.json');
    expect(fs.existsSync(metaPath)).toBe(true);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    expect(meta.player).toBe("Test Player");

    // 2. Check Turn Log
    const turnsPath = path.join(sessionPath, 'turns', 'turns-0001-0100.jsonl');
    expect(fs.existsSync(turnsPath)).toBe(true);
    
    const turnLines = fs.readFileSync(turnsPath, 'utf-8').trim().split('\n');
    expect(turnLines.length).toBe(2);
    
    const turn1 = JSON.parse(turnLines[0]);
    expect(turn1.turnNumber).toBe(1);
    
    // Let's check GameMaster.ts again. 
    // It does: const turn = this.turnManager.startTurn("player", "scene-1", gameTime);
    // Then: this.turnManager.addEvent('skill_check', ...)
    // It doesn't seem to explicitly store the "playerAction" string as a property of the turn, 
    // but maybe it should be an event?
    // In GameMaster.ts: 
    // this.turnManager.addEvent('skill_check', fateAction, { description: `Player attempted to ${playerAction}` ... })
    
    const event1 = turn1.events.find((e: any) => e.type === 'skill_check');
    expect(event1).toBeDefined();
    expect(event1.description).toContain("Look around");

  });
});
