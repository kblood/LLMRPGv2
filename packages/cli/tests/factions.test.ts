import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter } from '@llmrpg/storage';
import { FactionManager } from '@llmrpg/core';
import { WorldState } from '@llmrpg/protocol';

// Mock dependencies
const mockSessionWriter = {
  createSession: vi.fn().mockResolvedValue('session-123'),
  writeTurn: vi.fn().mockResolvedValue(undefined),
  writeDelta: vi.fn().mockResolvedValue(undefined),
  updateCurrentState: vi.fn().mockResolvedValue(undefined),
} as unknown as SessionWriter;

describe('Faction System', () => {
  let gm: GameMaster;
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
    gm = new GameMaster('session-123', mockAdapter, mockSessionWriter);
  });

  it('should generate factions during world initialization', async () => {
    // Mock LLM responses
    mockAdapter.setNextResponse(JSON.stringify({
      name: "Cyber-Noir City",
      genre: "Cyberpunk",
      tone: "Gritty",
      keywords: ["Neon", "Rain", "Tech"]
    })); // Theme

    mockAdapter.setNextResponse(JSON.stringify({
      name: "The Rusty Bolt",
      description: "A dive bar.",
      aspects: [{ name: "Smoky", type: "environment" }],
      features: []
    })); // Location

    mockAdapter.setNextResponse(JSON.stringify({
      title: "The Missing Chip",
      description: "Find the chip.",
      hook: "A stranger approaches."
    })); // Scenario

    // Mock Faction Generation Response
    mockAdapter.setNextResponse(JSON.stringify([
      {
        name: "The Syndicate",
        description: "Criminal organization",
        aspects: ["Ruthless", "Wealthy"],
        goals: ["Control the underworld"],
        resources: [{ type: "wealth", level: 4 }],
        isHidden: false
      },
      {
        name: "The Resistance",
        description: "Freedom fighters",
        aspects: ["Scrappy", "Hidden"],
        goals: ["Topple the corps"],
        resources: [{ type: "manpower", level: 2 }],
        isHidden: true
      }
    ]));

    await gm.initializeWorld("Cyberpunk city");

    // Access FactionManager (we need to cast to any to access private property or use a getter if we added one)
    // Since we didn't add a getter, we'll check the world state directly via WorldManager
    const worldState = (gm as any).worldManager.state as WorldState;
    
    expect(worldState.factions).toBeDefined();
    const factions = Object.values(worldState.factions);
    expect(factions.length).toBe(2);
    
    const syndicate = factions.find(f => f.name === "The Syndicate");
    expect(syndicate).toBeDefined();
    expect(syndicate?.resources[0].type).toBe("wealth");
    expect(syndicate?.resources[0].level).toBe(4);

    const resistance = factions.find(f => f.name === "The Resistance");
    expect(resistance).toBeDefined();
    expect(resistance?.isHidden).toBe(true);
  });

  it('should allow reputation updates via FactionManager', () => {
    // Setup manual state
    const worldState = (gm as any).worldManager.state as WorldState;
    const factionManager = new FactionManager(worldState);

    const faction = factionManager.createFaction({
        name: "Test Faction"
    });

    factionManager.updateReputation(faction.id, "player-1", 5);
    expect(factionManager.getReputation(faction.id, "player-1")).toBe(5);
    expect(factionManager.getRank(faction.id, "player-1")).toBe("neutral");

    factionManager.updateReputation(faction.id, "player-1", 55); // +55 -> 60
    expect(factionManager.getReputation(faction.id, "player-1")).toBe(60);
    expect(factionManager.getRank(faction.id, "player-1")).toBe("allied");
  });
});
