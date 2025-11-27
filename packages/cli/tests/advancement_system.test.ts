import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const SESSION_ID = `advancement-test-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');

describe('Advancement System', () => {
    let gm: GameMaster;
    let llm: MockAdapter;
    let sessionWriter: SessionWriter;

    beforeEach(async () => {
        if (!fs.existsSync(STORAGE_PATH)) {
            fs.mkdirSync(STORAGE_PATH, { recursive: true });
        }
        const fsAdapter = new FileSystemAdapter(STORAGE_PATH);
        sessionWriter = new SessionWriter(fsAdapter);
        await sessionWriter.createSession(SESSION_ID, { startTime: Date.now(), player: 'Test Player' });

        llm = new MockAdapter();
        gm = new GameMaster(SESSION_ID, llm, sessionWriter);

        // Initialize World & Character
        // We need to queue responses for initialization
        // 1. Theme
        llm.setNextResponse(JSON.stringify({ name: "Test World", genre: "Fantasy", tone: "Dark", keywords: ["Magic"] }));
        // 2. Location
        llm.setNextResponse(JSON.stringify({ id: "loc-1", name: "Test Loc", description: "Desc", aspects: [], features: [] }));
        // 3. Scenario
        llm.setNextResponse(JSON.stringify({ title: "Test Scenario", description: "Desc", hook: "Hook" }));
        // 4. Factions
        llm.setNextResponse(JSON.stringify([]));
        
        await gm.initializeWorld("Fantasy");

        // 5. Character
        llm.setNextResponse(JSON.stringify({
            name: "Hero",
            appearance: "Heroic",
            aspects: [
                { name: "High Concept", type: "highConcept" },
                { name: "Trouble", type: "trouble" }
            ],
            skills: [
                { name: "Fight", level: 4 },
                { name: "Athletics", level: 3 }
            ],
            stunts: [],
            personality: { traits: [], values: [], quirks: [], fears: [], desires: [] },
            backstory: { origin: "", formativeEvent: "", summary: "" },
            voice: { speechPattern: "", vocabulary: "simple", phrases: [], quirks: [] }
        }));

        await gm.createCharacter("Hero");
    });

    it('should process skill increase advancement', async () => {
        // Setup: Give player a significant milestone
        const player = (gm as any).player;
        player.milestones.significant = 1;

        // Queue 1: Intent
        llm.setNextResponse("advance");
        
        // Queue 2: Parse Advancement
        llm.setNextResponse(JSON.stringify({
            type: "increase_skill",
            milestoneRequired: "significant",
            details: {
                skillName: "Athletics"
            }
        }));

        const result = await gm.processPlayerAction("I want to increase my Athletics skill.");

        expect(result.result).toBe("success");
        expect(player.milestones.significant).toBe(0);
        const athletics = player.skills.find((s: any) => s.name === "Athletics");
        expect(athletics.rank).toBe(4); // Was 3
    });

    it('should fail if no milestone available', async () => {
        const player = (gm as any).player;
        player.milestones.significant = 0;

        llm.setNextResponse("advance");
        llm.setNextResponse(JSON.stringify({
            type: "increase_skill",
            milestoneRequired: "significant",
            details: {
                skillName: "Athletics"
            }
        }));

        const result = await gm.processPlayerAction("I want to increase my Athletics skill.");

        expect(result.result).toBe("failure");
        expect(result.narration).toContain("You do not have a significant milestone available");
    });
});
