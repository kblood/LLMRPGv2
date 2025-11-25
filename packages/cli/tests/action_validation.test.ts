import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { OllamaAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

// Set a long timeout for LLM interactions
const TEST_TIMEOUT = 180000; // 3 minutes

describe('System Action Validation (Ollama)', () => {
  const sessionId = 'action-test-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_sessions_action');
  
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

  it('should track LLM decisions and Game Master actions', async () => {
    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    
    await sessionWriter.createSession(sessionId, {
        startTime: Date.now(),
        player: "Action Tester"
    });

    const llmProvider = new OllamaAdapter({
        model: process.env.OLLAMA_MODEL || 'granite4:3b',
        host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
    });

    const gameMaster = new GameMaster(sessionId, llmProvider, sessionWriter);

    console.log("\n=== INITIALIZATION ===");
    await gameMaster.start();
    console.log("Game initialized.");

    // Action 1: Search for traps
    const action1 = "I search the room for hidden traps";
    console.log(`\n=== PLAYER ACTION 1: "${action1}" ===`);
    
    const result1 = await gameMaster.processPlayerAction(action1);
    
    // Inspect the turn events to see what happened
    const skillCheckEvent1 = result1.turn.events.find(e => e.type === 'skill_check');
    
    if (skillCheckEvent1) {
        console.log(`[GM Action] Created Skill Check Event`);
        console.log(`[LLM Decision] Opposition Difficulty: ${skillCheckEvent1.difficulty}`);
        console.log(`[Dice Roll] Total: ${skillCheckEvent1.roll?.total}`);
        console.log(`[Result] Shifts: ${skillCheckEvent1.shifts}`);
    } else {
        console.warn("[GM Action] No skill check event found!");
    }

    console.log(`[LLM Action] Generated Narration:`);
    console.log(`"${result1.narration.substring(0, 100)}..."`); // Truncate for readability

    expect(result1.turn).toBeDefined();
    expect(skillCheckEvent1).toBeDefined();
    expect(typeof skillCheckEvent1?.difficulty).toBe('number');
    expect(result1.narration.length).toBeGreaterThan(0);


    // Action 2: Disarm trap (assuming one was found, or just trying)
    const action2 = "I try to disarm the trap carefully";
    console.log(`\n=== PLAYER ACTION 2: "${action2}" ===`);
    
    const result2 = await gameMaster.processPlayerAction(action2);
    
    const skillCheckEvent2 = result2.turn.events.find(e => e.type === 'skill_check');
    
    if (skillCheckEvent2) {
        console.log(`[GM Action] Created Skill Check Event`);
        console.log(`[LLM Decision] Opposition Difficulty: ${skillCheckEvent2.difficulty}`);
        console.log(`[Dice Roll] Total: ${skillCheckEvent2.roll?.total}`);
        console.log(`[Result] Shifts: ${skillCheckEvent2.shifts}`);
    }

    console.log(`[LLM Action] Generated Narration:`);
    console.log(`"${result2.narration.substring(0, 100)}..."`);

    expect(result2.turn).toBeDefined();
    expect(skillCheckEvent2).toBeDefined();
    expect(typeof skillCheckEvent2?.difficulty).toBe('number');

  }, TEST_TIMEOUT);
});
