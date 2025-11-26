import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import { CharacterDefinition } from '@llmrpg/core';
import path from 'path';
import fs from 'fs';

describe('Social Conflict System', () => {
  const sessionId = 'social-test-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_sessions_social');
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

  it('should run a social conflict loop', async () => {
    // --- Initialization ---
    mockLLM.setNextResponse(JSON.stringify({ name: "Court", genre: "Political", tone: "Tense", keywords: [] })); 
    mockLLM.setNextResponse(JSON.stringify({ id: "loc-1", name: "Throne Room", description: "Throne Room", aspects: [], connections: [], presentNPCs: [], features: [], discovered: true, tier: "locale" }));
    mockLLM.setNextResponse(JSON.stringify({ description: "Start", hook: "Hook", title: "Court Intrigue" }));
    mockLLM.setNextResponse(JSON.stringify({ 
        name: "Diplomat", 
        highConcept: "Diplomat", 
        trouble: "None", 
        aspects: [], 
        skills: [{ name: "Provoke", level: 4 }, { name: "Empathy", level: 3 }, { name: "Will", level: 3 }], 
        stunts: [], 
        personality: { traits: [], values: [], fears: [], quirks: [], speechPattern: "" }, 
        backstory: { summary: "", motivation: "", origin: "" }, 
        stressTracks: [
            { name: "Physical", capacity: 2, boxes: [false, false], type: "physical" },
            { name: "Mental", capacity: 4, boxes: [false, false, false, false], type: "mental" }
        ], 
        consequences: [] 
    }));

    await gameMaster.start();
    await gameMaster.initializeWorld("Political");
    await gameMaster.createCharacter("A diplomat");

    // --- Start Social Conflict ---
    const opponent: CharacterDefinition = {
        id: "npc-1",
        name: "Rival",
        highConcept: "Rival",
        trouble: "Jealous",
        aspects: [],
        skills: { Deceive: 3, Will: 2 },
        stunts: [],
        personality: { traits: [], values: [], fears: [], quirks: [], speechPattern: "" },
        backstory: { summary: "", motivation: "", origin: "", secrets: [], keyEvents: [] },
        stress: {
            physical: [false, false],
            mental: [false, false]
        },
        consequences: {},
        fatePoints: 3,
        relationships: [],
        knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    };

    const conflict = await gameMaster.startSocialConflict([opponent]);
    expect(conflict).toBeDefined();
    expect(conflict?.type).toBe('social');

    // --- Player Turn (Attack) ---
    
    // 1. Classify Action
    mockLLM.setNextResponse("attack"); // Social attack
    // 2. Select Skill
    mockLLM.setNextResponse("Provoke");
    // 3. Set Opposition (Will)
    mockLLM.setNextResponse("2"); // Opponent's Will
    // 4. Narration
    mockLLM.setNextResponse("You insult his honor!");

    // --- NPC Turn (Retaliate) ---
    // 7. NPC Decision
    mockLLM.setNextResponse(JSON.stringify({ action: "attack", description: "Lies about you" }));
    // 8. NPC Narration
    mockLLM.setNextResponse("He spreads a rumor.");

    const result = await gameMaster.processPlayerAction("I insult his honor!");

    expect(result.result).toBe('success_with_style'); // 4 (roll) + 4 (skill) - 2 (opp) = 6 shifts
    // Opponent has 2 mental stress boxes. 6 shifts should take them out.
    
    // Check if conflict is resolved
    const scene = (gameMaster as any).currentScene;
    expect(scene.conflict.isResolved).toBe(true);
    expect(scene.conflict.winner).toBe('player');
  });
});
