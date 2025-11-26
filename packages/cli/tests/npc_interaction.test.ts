import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter, SessionLoader } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

describe('NPC Interaction System', () => {
  const sessionId = 'npc-test-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_sessions_npc');
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
    
    await sessionWriter.createSession(sessionId, { startTime: Date.now(), player: "Talker" });

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

  it('should generate dialogue when talking to an NPC', async () => {
    // --- Initialization ---
    // 1. World Theme
    mockLLM.setNextResponse(JSON.stringify({ name: "Village", genre: "Fantasy", tone: "Cozy", keywords: [] })); 
    // 2. Starting Location
    mockLLM.setNextResponse(JSON.stringify({ id: "loc-1", name: "Tavern", description: "A cozy tavern", aspects: [], connections: [], presentNPCs: [], features: [], discovered: true, tier: "locale" }));
    // 3. Scenario
    mockLLM.setNextResponse(JSON.stringify({ description: "Start", hook: "Hook", title: "Tavern Talk" }));
    // 4. Character Creation
    mockLLM.setNextResponse(JSON.stringify({ 
        name: "Bard", 
        highConcept: "Bard", 
        trouble: "None", 
        aspects: [], 
        skills: [{ name: "Rapport", level: 4 }], 
        stunts: [], 
        personality: { traits: [], values: [], fears: [], quirks: [], speechPattern: "" }, 
        backstory: { summary: "", motivation: "", origin: "" }, 
        stressTracks: [], 
        consequences: [] 
    }));

    await gameMaster.start();
    await gameMaster.initializeWorld("Fantasy");
    await gameMaster.createCharacter("A bard");

    // Inject an NPC into the scene/world manually for testing
    const npcId = "npc-test-1";
    const npc = {
        id: npcId,
        name: "Innkeeper",
        highConcept: "Friendly Innkeeper",
        trouble: "Busy",
        aspects: [],
        skills: { Rapport: 3 },
        stunts: [],
        personality: { 
            traits: ["Friendly"], 
            values: ["Hospitality"], 
            fears: [], 
            quirks: [], 
            speechPattern: "Warm and welcoming" 
        },
        backstory: { summary: "", motivation: "", origin: "", secrets: [], keyEvents: [] },
        stress: { physical: [], mental: [] },
        consequences: {},
        fatePoints: 3,
        relationships: [],
        knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    };
    (gameMaster as any).npcs[npcId] = npc;
    // Add NPC to current scene location
    const currentScene = (gameMaster as any).currentScene;
    const location = (gameMaster as any).worldManager.getLocation(currentScene.locationId);
    location.presentNPCs = [npcId];

    // --- Player Action: "I ask the Innkeeper for rumors" ---
    
    // 1. Identify Target (DecisionEngine)
    mockLLM.setNextResponse("Innkeeper");
    
    // 2. Classify Action (DecisionEngine)
    mockLLM.setNextResponse("create_advantage"); // Asking for info is often Create Advantage or Overcome
    
    // 3. Select Skill (DecisionEngine)
    mockLLM.setNextResponse("Rapport");
    
    // 4. Set Opposition (DecisionEngine)
    mockLLM.setNextResponse("2");
    
    // 5. Knowledge Gain (DecisionEngine) - since roll is success
    mockLLM.setNextResponse("null"); // No specific knowledge item for this test
    
    // 6. Quest Update (DecisionEngine)
    mockLLM.setNextResponse("null");

    // 7. Generate Dialogue (DialogueSystem)
    const expectedDialogue = "Welcome traveler! The roads are dangerous lately.";
    mockLLM.setNextResponse(expectedDialogue);

    // 8. Narrate (NarrativeEngine)
    mockLLM.setNextResponse("The Innkeeper smiles warmly and shares some news.");

    const result = await gameMaster.processPlayerAction("I ask the Innkeeper for rumors");

    // Verify
    expect(result.result).toBe('success_with_style'); // 4 (roll) + 4 (skill) - 2 (opp) = 6 shifts
    
    // Check events for dialogue
    const turn = result.turn;
    expect(turn).not.toBeNull();
    if (!turn) return;
    
    const dialogueEvent = turn.events.find(e => e.type === 'dialogue');
    expect(dialogueEvent).toBeDefined();
    expect(dialogueEvent?.metadata?.speaker).toBe("Innkeeper");
    expect(dialogueEvent?.metadata?.text).toBe(expectedDialogue);
    expect(dialogueEvent?.description).toContain(expectedDialogue);
  });
});
