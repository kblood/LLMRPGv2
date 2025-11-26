import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

describe('Quest System', () => {
  const sessionId = 'quest-test-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_sessions_quest');
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

  it('should start a new quest when triggered by LLM', async () => {
    // Setup mock responses for initialization
    
    // 1. Theme
    mockLLM.setNextResponse(JSON.stringify({ 
        name: "Fantasy", 
        genre: "Fantasy", 
        tone: "Epic", 
        keywords: ["Magic", "Dragons"] 
    })); 
    
    // 2. Starting Location
    mockLLM.setNextResponse(JSON.stringify({ 
        id: "loc-1", 
        name: "Tavern", 
        description: "A busy tavern", 
        aspects: [], 
        connections: [], 
        presentNPCs: [], 
        features: [], 
        discovered: true, 
        tier: "locale" 
    }));

    // 3. Scenario
    mockLLM.setNextResponse(JSON.stringify({ 
        description: "You are in a tavern.", 
        hook: "An old man waves at you." 
    }));

    // 4. Character Creation
    mockLLM.setNextResponse(JSON.stringify({ 
        name: "Hero", 
        highConcept: "Brave Knight", 
        trouble: "Reckless", 
        aspects: [], 
        skills: [{ name: "Fight", level: 4 }], 
        stunts: [], 
        personality: { traits: [], values: [], fears: [], quirks: [], speechPattern: "Normal" }, 
        backstory: { summary: "A hero", motivation: "Glory", origin: "Village" }, 
        stressTracks: [], 
        consequences: [] 
    }));

    await gameMaster.start();
    await gameMaster.initializeWorld("Fantasy");
    await gameMaster.createCharacter("A brave knight");

    // --- Action Phase ---

    // 5. Classify Action
    mockLLM.setNextResponse("overcome");

    // 6. Select Skill
    mockLLM.setNextResponse("Rapport");

    // 7. Set Opposition
    mockLLM.setNextResponse("2");

    // 8. Knowledge Gain (None)
    mockLLM.setNextResponse("null");

    // 9. Quest Update (NEW QUEST)
    mockLLM.setNextResponse(JSON.stringify({
        type: "new",
        quest: {
            id: "quest-1",
            title: "Find the Lost Cat",
            description: "The tavern keeper lost his cat.",
            objectives: [
                { id: "obj-1", description: "Find the cat", type: "visit", requiredCount: 1, currentCount: 0, status: "active" }
            ],
            status: "active"
        }
    }));

    // 10. Narration
    mockLLM.setNextResponse("You agree to find the cat. The keeper is relieved.");

    await gameMaster.processPlayerAction("I agree to find the cat.");

    // Verify Quest State
    const worldState = gameMaster.getWorldState();
    expect(worldState.quests).toHaveLength(1);
    expect(worldState.quests[0].title).toBe("Find the Lost Cat");
    expect(worldState.quests[0].status).toBe("active");
  });

  it('should update an objective when triggered by LLM', async () => {
    // ... (Initialization similar to above, but manually inject a quest first)
    
    // 1. Theme
    mockLLM.setNextResponse(JSON.stringify({ name: "Fantasy", genre: "Fantasy", tone: "Epic", keywords: [] })); 
    // 2. Location
    mockLLM.setNextResponse(JSON.stringify({ id: "loc-1", name: "Tavern", description: "Tavern", aspects: [], connections: [], presentNPCs: [], features: [], discovered: true, tier: "locale" }));
    // 3. Scenario
    mockLLM.setNextResponse(JSON.stringify({ description: "Start", hook: "Hook" }));
    // 4. Character
    mockLLM.setNextResponse(JSON.stringify({ name: "Hero", highConcept: "Hero", trouble: "None", aspects: [], skills: [{ name: "Fight", level: 4 }], stunts: [], personality: { traits: [], values: [], fears: [], quirks: [], speechPattern: "" }, backstory: { summary: "", motivation: "", origin: "" }, stressTracks: [], consequences: [] }));

    await gameMaster.start();
    await gameMaster.initializeWorld("Fantasy");
    await gameMaster.createCharacter("Hero");

    // Inject Quest
    const worldState = gameMaster.getWorldState();
    worldState.quests.push({
        id: "quest-1",
        title: "Find the Lost Cat",
        description: "Find it.",
        status: "active",
        objectives: [
            { id: "obj-1", description: "Find the cat", type: "visit", requiredCount: 1, currentCount: 0, status: "active", isHidden: false }
        ],
        isHidden: false
    });

    // --- Action Phase ---

    // 5. Classify Action
    mockLLM.setNextResponse("overcome");
    // 6. Select Skill
    mockLLM.setNextResponse(JSON.stringify({ name: "Investigate", rating: 3 }));
    // 7. Set Opposition
    mockLLM.setNextResponse("2");
    // 8. Knowledge Gain
    mockLLM.setNextResponse("null");
    
    // 9. Quest Update (UPDATE OBJECTIVE)
    mockLLM.setNextResponse(JSON.stringify({
        type: "update_objective",
        questId: "quest-1",
        objectiveId: "obj-1",
        count: 1,
        status: "completed"
    }));

    // 10. Narration
    mockLLM.setNextResponse("You found the cat under a table!");

    await gameMaster.processPlayerAction("I look for the cat.");

    // Verify Quest State
    const updatedQuest = gameMaster.getWorldState().quests[0];
    expect(updatedQuest.objectives[0].status).toBe("completed");
    expect(updatedQuest.status).toBe("completed"); // Should auto-complete
  });
});
