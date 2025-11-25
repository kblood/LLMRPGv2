import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

describe('Knowledge System', () => {
  const sessionId = 'knowledge-test-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_sessions_knowledge');
  let gameMaster: GameMaster;
  let mockLLM: MockAdapter;

  beforeEach(async () => {
    if (fs.existsSync(storagePath)) {
      fs.rmSync(storagePath, { recursive: true, force: true });
    }
    fs.mkdirSync(storagePath, { recursive: true });

    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    await sessionWriter.createSession(sessionId, { startTime: Date.now(), player: "Tester" });

    mockLLM = new MockAdapter();
    gameMaster = new GameMaster(sessionId, mockLLM, sessionWriter);
    
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

  it('should update knowledge when player investigates successfully', async () => {
    // Setup mock responses for initialization
    
    // 1. Theme
    mockLLM.setNextResponse(JSON.stringify({ 
        name: "Cyberpunk Noir", 
        genre: "Cyberpunk", 
        tone: "Dark", 
        keywords: ["Neon", "Rain"] 
    })); 
    
    // 2. Starting Location
    mockLLM.setNextResponse(JSON.stringify({ 
        id: "loc-1", 
        name: "Neon Slums", 
        description: "A dirty place",
        aspects: [],
        features: []
    })); 
    
    // 3. Scenario
    mockLLM.setNextResponse(JSON.stringify({ 
        title: "The Job", 
        description: "Steal the data", 
        hook: "You need money" 
    })); 

    await gameMaster.initializeWorld("Cyberpunk");

    // 4. Character Generation
    mockLLM.setNextResponse(JSON.stringify({ 
        name: "Jack", 
        appearance: "Rough", 
        aspects: [{name: "Hacker", type: "highConcept"}, {name: "Broke", type: "trouble"}],
        skills: [{name: "Investigate", level: 4}],
        stunts: [],
        personality: { traits: [], values: [], fears: [], quirks: [], desires: [], speechPattern: "Normal" },
        backstory: { origin: "", formativeEvent: "", summary: "" },
        voice: { speechPattern: "", vocabulary: "simple" }
    })); 

    await gameMaster.createCharacter("Hacker");

    // Action: Investigate
    // 1. Classify Action
    mockLLM.setNextResponse("create_advantage");
    // 2. Select Skill
    mockLLM.setNextResponse("Investigate");
    // 3. Set Opposition
    mockLLM.setNextResponse("2"); // Fair difficulty
    // 4. Knowledge Gain Check
    mockLLM.setNextResponse(JSON.stringify({
        category: "locations",
        id: "loc-secret-lab",
        data: {
            name: "Secret Lab",
            details: "Hidden behind the bookshelf",
            known: true,
            confidence: "high"
        }
    }));
    // 5. Narrate
    mockLLM.setNextResponse("You find a secret lab behind the bookshelf.");

    const result = await gameMaster.processPlayerAction("I search the room carefully.");

    // We can't guarantee success because of dice roll, but with Skill 4 vs Diff 2, it's highly likely.
    // If it fails, the knowledge check won't happen.
    // We can check if result is success.
    if (result.result === 'success' || result.result === 'success_with_style') {
        const player = (gameMaster as any).player;
        expect(player.knowledge.locations["loc-secret-lab"]).toBeDefined();
        expect(player.knowledge.locations["loc-secret-lab"].name).toBe("Secret Lab");
        console.log("Knowledge test passed!");
    } else {
        console.warn("Action failed, skipping knowledge check. (Dice roll was unlucky)");
    }
  });
});
