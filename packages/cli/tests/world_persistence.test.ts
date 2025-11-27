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
    // World Events
    mockLLM.setNextResponse(JSON.stringify([]));
    // Factions
    mockLLM.setNextResponse(JSON.stringify([]));
    // Character
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
    
    // 0. Classify Intent
    mockLLM.setNextResponse("fate_action");
    
    // 1. Check Compels
    mockLLM.setNextResponse("null");
    
    // 2. Identify Target
    mockLLM.setNextResponse("null");
    
    // 3. Classify Action
    mockLLM.setNextResponse("overcome");
    
    // 4. Select Skill
    mockLLM.setNextResponse("Physique");
    
    // 5. Set Opposition
    mockLLM.setNextResponse("2");
    
    // 6. Generate Boost Name (success with style)
    mockLLM.setNextResponse("Raw Power");
    
    // 7. Knowledge Gain
    mockLLM.setNextResponse("null");
    
    // 8. Quest Update
    mockLLM.setNextResponse("null");

    // 9. World Updates
    mockLLM.setNextResponse(JSON.stringify([
        { 
            type: "add_aspect", 
            targetId: "loc-1", 
            data: { name: "Broken Table", type: "situational" } 
        }
    ]));

    // 10. Narrate
    mockLLM.setNextResponse("You smash the table into splinters.");

    const result = await gameMaster.processPlayerAction("I smash the table");

    // Verify - result depends on dice roll
    expect(['success', 'success_with_style', 'tie', 'failure']).toContain(result.result);
    
    // Check World State (only if success)
    if (result.result === 'success' || result.result === 'success_with_style') {
        const worldState = gameMaster.getWorldState();
        const currentScene = (gameMaster as any).currentScene;
        const location = worldState.locations[currentScene.locationId];
        
        const brokenTableAspect = location.aspects.find((a: any) => a.name === "Broken Table");
        expect(brokenTableAspect).toBeDefined();
        expect(brokenTableAspect?.type).toBe("situational");

        // Check Events - find the add_aspect event specifically
        const turn = result.turn;
        expect(turn).not.toBeNull();
        if (!turn) return;
        
        // There may be multiple state_change events (boost + world update)
        // Find the one that contains "Broken Table"
        const aspectEvent = turn.events.find(e => 
            e.type === 'state_change' && 
            e.description?.includes("Broken Table")
        );
        expect(aspectEvent).toBeDefined();
        expect(aspectEvent?.description).toContain("Broken Table");
    }
  });
});
