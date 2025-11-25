import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';
import { CharacterDefinition } from '@llmrpg/core';

describe('Combat System', () => {
  const sessionId = 'combat-test-' + Date.now();
  const storagePath = path.join(__dirname, 'temp_combat_sessions');
  
  beforeAll(() => {
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(storagePath)) {
      fs.rmSync(storagePath, { recursive: true, force: true });
    }
  });

  it('should handle a full combat loop', async () => {
    const fsAdapter = new FileSystemAdapter(storagePath);
    const sessionWriter = new SessionWriter(fsAdapter);
    
    await sessionWriter.createSession(sessionId, {
        startTime: Date.now(),
        player: "Combat Tester"
    });

    const llmProvider = new MockAdapter();
    
    // 1. Initialize World (Theme)
    // 2. Initialize World (Location)
    // 3. Initialize World (Scenario)
    // 4. Create Character
    // 5. Combat: Classify Action (Player)
    // 6. Combat: Select Skill (Player)
    // 7. Combat: Set Opposition (Player)
    // 8. Combat: Narrate (Player)
    // 9. Combat: Decide NPC Action
    // 10. Combat: Narrate (NPC)

    // We need to queue responses for the setup phase too, or let them fall through to default logic.
    // MockAdapter default logic handles theme, location, scenario, character.
    // So we only need to queue combat responses.
    
    // BUT, MockAdapter checks queue first. So we must queue EVERYTHING or nothing until setup is done.
    // Alternatively, we can set responses AFTER setup.

    const gameMaster = new GameMaster(sessionId, llmProvider, sessionWriter);
    await gameMaster.start();
    
    // Setup World & Player (using default mock logic)
    await gameMaster.initializeWorld("Fantasy");
    await gameMaster.createCharacter("Warrior");

    // NOW set combat responses
    llmProvider.setNextResponse("attack"); // Classify Action
    llmProvider.setNextResponse("Fight"); // Select Skill
    llmProvider.setNextResponse("2"); // Opposition
    llmProvider.setNextResponse("You swing your sword mightily!"); // Narration (Player)
    
    // NPC Decision Mock
    llmProvider.setNextResponse(JSON.stringify({
        action: "attack",
        description: "attacks with a rusty dagger",
        target: "Player"
    }));
    
    // NPC Narration Mock
    llmProvider.setNextResponse("The goblin lunges at you!");

    // Create Opponent
    const goblin: CharacterDefinition = {
        id: "goblin-1",
        name: "Goblin",
        highConcept: "Sneaky Goblin",
        trouble: "Cowardly",
        aspects: ["Small", "Vicious"],
        skills: { Fight: 2, Stealth: 3 },
        stunts: [],
        personality: { traits: [], values: [], fears: [], quirks: [], speechPattern: "" },
        backstory: { summary: "", origin: "", motivation: "", secrets: [], keyEvents: [] },
        stress: { physical: [false, false], mental: [false] },
        consequences: {},
        fatePoints: 1,
        relationships: [],
        knowledge: {
            knownLocations: [],
            knownCharacters: [],
            knownSecrets: [],
            knownQuests: []
        }
    };

    // Start Combat
    const conflict = await gameMaster.startCombat([goblin]);
    expect(conflict).toBeDefined();
    expect(conflict?.participants.length).toBe(2);

    // Process Player Turn
    const result = await gameMaster.processPlayerAction("I attack the goblin with my sword");
    
    expect(result.turn).toBeDefined();
    expect(result.turn.events.some(e => e.type === 'skill_check' && e.action === 'attack')).toBe(true);
    
    // Verify NPC Turn happened
    expect(result.narration).toContain("The goblin lunges at you!");
    
    // Check that history has advanced
    const sessionPath = path.join(storagePath, 'sessions', 'active', sessionId);
    const turnsPath = path.join(sessionPath, 'turns', 'turns-0001-0100.jsonl');
    const turnLines = fs.readFileSync(turnsPath, 'utf-8').trim().split('\n');
    
    // Should have at least 2 turns (Player + NPC)
    expect(turnLines.length).toBeGreaterThanOrEqual(2);
    
    const lastTurn = JSON.parse(turnLines[turnLines.length - 1]);
    expect(lastTurn.actor).toBe("Goblin");
  });
});
