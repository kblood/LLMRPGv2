import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { OllamaAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

// Set a long timeout for LLM interactions
const TEST_TIMEOUT = 120000; // 2 minutes

describe('Ollama Full Playthrough', () => {
  const sessionId = 'ollama-test-session-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_sessions_ollama');
  
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

  it('should run a complete session flow with Granite4:3b', async () => {
    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    
    await sessionWriter.createSession(sessionId, {
        startTime: Date.now(),
        player: "Ollama Tester"
    });

    // Initialize Ollama Adapter with the requested model
    const llmProvider = new OllamaAdapter({
        model: process.env.OLLAMA_MODEL || 'granite4:3b', // User requested model, overridable via env
        host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434' // Default host
    });

    const gameMaster = new GameMaster(sessionId, llmProvider, sessionWriter);

    console.log("Starting GameMaster with Ollama...");
    await gameMaster.start();
    console.log("GameMaster started.");

    // Turn 1
    console.log("Processing Turn 1: Look around");
    const result1 = await gameMaster.processPlayerAction("Look around");
    
    console.log("Turn 1 Result:", result1.narration);
    
    expect(result1.turn).toBeDefined();
    expect(result1.turn.turnNumber).toBe(1);
    expect(result1.turn.events.length).toBeGreaterThan(0);
    expect(result1.narration).toBeDefined();
    expect(result1.narration.length).toBeGreaterThan(10); // Ensure we got some text back

    // Turn 2
    console.log("Processing Turn 2: Check inventory");
    const result2 = await gameMaster.processPlayerAction("Check inventory");
    
    console.log("Turn 2 Result:", result2.narration);

    expect(result2.turn).toBeDefined();
    expect(result2.turn.turnNumber).toBe(2);
    expect(result2.narration).toBeDefined();

    // Verify Storage
    const sessionPath = path.join(storagePath, 'sessions', 'active', sessionId);
    
    // 1. Check Metadata
    const metaPath = path.join(sessionPath, 'session.meta.json');
    expect(fs.existsSync(metaPath)).toBe(true);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    expect(meta.player).toBe("Ollama Tester");

    // 2. Check Turn Log
    const turnsPath = path.join(sessionPath, 'turns', 'turns-0001-0100.jsonl');
    expect(fs.existsSync(turnsPath)).toBe(true);
    
    const turnLines = fs.readFileSync(turnsPath, 'utf-8').trim().split('\n');
    expect(turnLines.length).toBe(2);
    
    const turn1 = JSON.parse(turnLines[0]);
    expect(turn1.turnNumber).toBe(1);
    
    const event1 = turn1.events.find((e: any) => e.type === 'skill_check');
    // Note: Depending on how the LLM interprets "Look around", it might not always result in a skill check 
    // if the GM decides it's trivial, but usually it should. 
    // If the LLM is working, we should at least have events.
    expect(turn1.events.length).toBeGreaterThan(0);

  }, TEST_TIMEOUT);
});
