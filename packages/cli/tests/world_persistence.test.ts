import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter, SessionLoader } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

describe('World Persistence System', () => {
  const sessionId = 'world-test-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_sessions_world');
  let gameMaster: GameMaster;
  let mockLLM: MockAdapter;

  beforeEach(async () => {
    if (fs.existsSync(storagePath)) {
      fs.rmSync(storagePath, { recursive: true, force: true });
    }
    fs.mkdirSync(storagePath, { recursive: true });

    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    const sessionLoader = new SessionLoader(fsAdapter);
    
    await sessionWriter.createSession(sessionId, { startTime: Date.now(), player: "Builder" });

    mockLLM = new MockAdapter();
    gameMaster = new GameMaster(sessionId, mockLLM, sessionWriter, sessionLoader);
    
    // Mock FateDice to ensure success
    (gameMaster as any).fateDice = {
        roll: () => ({ total: 4, faces: [1, 1, 1, 1] })
    };
  });

  afterEach(() => {
    if (fs.existsSync(storagePath)) {
      fs.rmSync(storagePath, { recursive: true, force: true });
    }
  });

  it('should persist world changes (aspects) based on actions', async () => {
    // --- Initialization ---
    mockLLM.setNextResponse(JSON.stringify({ name: "Dungeon", genre: "Fantasy", tone: "Dark", keywords: [] })); 
    mockLLM.setNextResponse(JSON.stringify({ id: "loc-1", name: "Room", description: "A dark room", aspects: [], connections: [], presentNPCs: [], features: [], discovered: true, tier: "locale" }));
    mockLLM.setNextResponse(JSON.stringify({ description: "Start", hook: "Hook", title: "Escape" }));
    mockLLM.setNextResponse(JSON.stringify({ 
        name: "Hero", 
        highConcept: "Hero", 
        trouble: "None", 
        aspects: [], 
        skills: [{ name: "Physique", level: 4 }], 
        stunts: [], 
        personality: { traits: [], values: [], fears: [], quirks: [], speechPattern: "" }, 
        backstory: { summary: "", motivation: "", origin: "" }, 
        stressTracks: [], 
        consequences: [] 
    }));

    await gameMaster.start();
    await gameMaster.initializeWorld("Fantasy");
    await gameMaster.createCharacter("A hero");

    // --- Player Action: "I smash the table" ---
    
    // 1. Identify Target
    mockLLM.setNextResponse("Table");
    
    // 2. Classify Action
    mockLLM.setNextResponse("overcome");
    
    // 3. Select Skill
    mockLLM.setNextResponse("Physique");
    
    // 4. Set Opposition
    mockLLM.setNextResponse("2");
    
    // 5. Knowledge Gain
    mockLLM.setNextResponse("null");
    
    // 6. Quest Update
    mockLLM.setNextResponse("null");

    // 7. World Updates (NEW)
    mockLLM.setNextResponse(JSON.stringify([
        { 
            type: "add_aspect", 
            targetId: "loc-1", 
            data: { name: "Broken Table", type: "situational" } 
        }
    ]));

    // 8. Narrate
    mockLLM.setNextResponse("You smash the table into splinters.");

    const result = await gameMaster.processPlayerAction("I smash the table");

    // Verify
    expect(result.result).toBe('success_with_style');
    
    // Check World State
    const worldState = gameMaster.getWorldState();
    const currentScene = (gameMaster as any).currentScene;
    const location = worldState.locations[currentScene.locationId];
    
    const brokenTableAspect = location.aspects.find((a: any) => a.name === "Broken Table");
    expect(brokenTableAspect).toBeDefined();
    expect(brokenTableAspect?.type).toBe("situational");

    // Check Events
    const turn = result.turn;
    expect(turn).not.toBeNull();
    if (!turn) return;
    const changeEvent = turn.events.find(e => e.type === 'state_change');
    expect(changeEvent).toBeDefined();
    expect(changeEvent?.description).toContain("Broken Table");
  });
});
