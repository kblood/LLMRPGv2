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
        hook: "An old man waves at you.",
        title: "Tavern Meeting"
    }));

    // 4. World Events
    mockLLM.setNextResponse(JSON.stringify([]));

    // 5. Factions
    mockLLM.setNextResponse(JSON.stringify([]));

    // 6. Character Creation
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

    // 4.5 Classify Intent
    mockLLM.setNextResponse("fate_action");
    // 5. Check Compels
    mockLLM.setNextResponse("null");
    // 6. Identify Target
    mockLLM.setNextResponse("null");
    // 7. Classify Action
    mockLLM.setNextResponse("overcome");

    // 8. Select Skill
    mockLLM.setNextResponse("Rapport");

    // 9. Set Opposition
    mockLLM.setNextResponse("2");

    // Note: No generateBoostName because Rapport skill is 0, 
    // roll is +4, total is 4, opposition is 2, shifts = 2
    // That's regular success, not success_with_style

    // 10. Knowledge Gain (None)
    mockLLM.setNextResponse("null");

    // 11. Quest Update (NEW QUEST)
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

    // 12. World Updates
    mockLLM.setNextResponse("[]");

    // 13. Narration
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
    mockLLM.setNextResponse(JSON.stringify({ description: "Start", hook: "Hook", title: "Quest Time" }));
    // 4. World Events
    mockLLM.setNextResponse(JSON.stringify([]));
    // 5. Factions
    mockLLM.setNextResponse(JSON.stringify([]));
    // 6. Character
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

    // 4.5 Classify Intent
    mockLLM.setNextResponse("fate_action");
    // 5. Check Compels
    mockLLM.setNextResponse("null");
    // 6. Identify Target
    mockLLM.setNextResponse("null");
    // 7. Classify Action
    mockLLM.setNextResponse("overcome");
    // 8. Select Skill
    mockLLM.setNextResponse("Investigate");
    // 9. Set Opposition
    mockLLM.setNextResponse("2");
    
    // Note: No generateBoostName because Investigate skill is 0,
    // roll is +4, total is 4, opposition is 2, shifts = 2
    // That's regular success, not success_with_style
    
    // 10. Knowledge Gain
    mockLLM.setNextResponse("null");
    
    // 11. Quest Update (UPDATE OBJECTIVE)
    mockLLM.setNextResponse(JSON.stringify({
        type: "update_objective",
        questId: "quest-1",
        objectiveId: "obj-1",
        count: 1,
        status: "completed"
    }));

    // 12. World Updates
    mockLLM.setNextResponse("[]");

    // 13. Narration
    mockLLM.setNextResponse("You found the cat under a table!");

    await gameMaster.processPlayerAction("I look for the cat.");

    // Verify Quest State
    const updatedQuest = gameMaster.getWorldState().quests[0];
    expect(updatedQuest.objectives[0].status).toBe("completed");
    expect(updatedQuest.status).toBe("completed"); // Should auto-complete
  });
});

describe('Quest Prerequisites', () => {
  it('should check knowledge prerequisites correctly', async () => {
    const { QuestManager } = await import('@llmrpg/core');

    // Quest with prerequisites
    const quest = {
      id: "quest-secret",
      title: "The Hidden Temple",
      description: "Find the ancient temple",
      status: 'active' as const,
      objectives: [],
      isHidden: false,
      prerequisites: {
        locations: ["temple-ruins"],
        npcs: ["old-sage"]
      }
    };

    // Player without knowledge
    const contextMissing = {
      knowledge: {
        locations: {},
        npcs: {},
        quests: {},
        factions: {},
        secrets: {},
        items: {},
        topics: {}
      },
      completedQuestIds: []
    };

    const resultMissing = QuestManager.checkPrerequisites(quest, contextMissing);
    expect(resultMissing.met).toBe(false);
    expect(resultMissing.missing.length).toBe(2);
    expect(resultMissing.missing).toContain("locations: temple-ruins");
    expect(resultMissing.missing).toContain("npcs: old-sage");

    // Player with knowledge - using correct KnowledgeProfile structure
    const contextComplete = {
      knowledge: {
        locations: { 
          "temple-ruins": { 
            locationId: "temple-ruins",
            name: "Ancient Temple Ruins", 
            known: true,
            confidence: "high" as const,
            visited: false,
            knownSince: 5 
          } 
        },
        npcs: { 
          "old-sage": { 
            npcId: "old-sage",
            name: "Old Sage", 
            known: true,
            confidence: "medium" as const,
            knownSince: 3 
          } 
        },
        quests: {},
        factions: {},
        secrets: {},
        items: {},
        topics: {}
      },
      completedQuestIds: []
    };

    const resultComplete = QuestManager.checkPrerequisites(quest, contextComplete);
    expect(resultComplete.met).toBe(true);
    expect(resultComplete.missing.length).toBe(0);
  });

  it('should check faction reputation prerequisites', async () => {
    const { QuestManager } = await import('@llmrpg/core');

    const quest = {
      id: "quest-guild",
      title: "Guild Mission",
      description: "A mission for trusted members",
      status: 'active' as const,
      objectives: [],
      isHidden: false,
      prerequisites: {
        factionReputation: { "shadow-guild": 20 }
      }
    };

    // Player with insufficient reputation
    const contextLowRep = {
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} },
      completedQuestIds: [],
      factionReputations: { "shadow-guild": 10 }
    };

    const resultLowRep = QuestManager.checkPrerequisites(quest, contextLowRep);
    expect(resultLowRep.met).toBe(false);
    expect(resultLowRep.missing).toContain("faction reputation: shadow-guild (need 20, have 10)");

    // Player with sufficient reputation
    const contextHighRep = {
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} },
      completedQuestIds: [],
      factionReputations: { "shadow-guild": 50 }
    };

    const resultHighRep = QuestManager.checkPrerequisites(quest, contextHighRep);
    expect(resultHighRep.met).toBe(true);
  });

  it('should filter available quests based on prerequisites', async () => {
    const { QuestManager } = await import('@llmrpg/core');

    const quests = [
      {
        id: "quest-1",
        title: "Easy Quest",
        description: "No prerequisites",
        status: 'active' as const,
        objectives: [],
        isHidden: false
        // No prerequisites
      },
      {
        id: "quest-2",
        title: "Medium Quest",
        description: "Requires location knowledge",
        status: 'active' as const,
        objectives: [],
        isHidden: false,
        prerequisites: {
          locations: ["known-location"]
        }
      },
      {
        id: "quest-3",
        title: "Hard Quest",
        description: "Requires unknown location",
        status: 'active' as const,
        objectives: [],
        isHidden: false,
        prerequisites: {
          locations: ["unknown-location"]
        }
      }
    ];

    const context = {
      knowledge: {
        locations: { 
          "known-location": { 
            locationId: "known-location",
            name: "Known Place", 
            known: true,
            confidence: "high" as const,
            visited: true,
            knownSince: 1 
          } 
        },
        npcs: {},
        quests: {},
        factions: {},
        secrets: {},
        items: {},
        topics: {}
      },
      completedQuestIds: []
    };

    const available = QuestManager.getAvailableQuests(quests, context);
    expect(available.length).toBe(2);
    expect(available.map(q => q.id)).toContain("quest-1");
    expect(available.map(q => q.id)).toContain("quest-2");
    expect(available.map(q => q.id)).not.toContain("quest-3");
  });
});
