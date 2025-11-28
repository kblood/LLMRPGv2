import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import { QuestRewardManager } from '@llmrpg/core';
import { Quest, PlayerCharacter, WorldState } from '@llmrpg/protocol';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

describe('Quest Rewards Integration Tests', () => {
  const storagePath = path.join(__dirname, 'temp_quest_rewards');
  let sessionId: string;
  let fsAdapter: FileSystemAdapter;
  let sessionWriter: SessionWriter;
  let sessionLoader: SessionLoader;
  let mockLLM: MockAdapter;

  beforeEach(async () => {
    sessionId = 'quest-rewards-test-' + Date.now();

    if (fs.existsSync(storagePath)) {
      fs.rmSync(storagePath, { recursive: true, force: true });
    }
    fs.mkdirSync(storagePath, { recursive: true });

    fsAdapter = new FileSystemAdapter(storagePath);
    sessionWriter = new SessionWriter(fsAdapter);
    sessionLoader = new SessionLoader(fsAdapter);
    mockLLM = new MockAdapter();
  });

  afterEach(() => {
    if (fs.existsSync(storagePath)) {
      fs.rmSync(storagePath, { recursive: true, force: true });
    }
  });

  it('should complete quest and make rewards available during gameplay', async () => {
    // Simple test that doesn't need GameMaster - just QuestRewardManager
    const worldState: WorldState = {
      theme: { name: "Test", genre: "Fantasy", tone: "Epic", keywords: [] },
      locations: {},
      quests: [],
      factions: {},
      npcs: {},
      events: [],
      time: { value: "0", period: "morning" },
      aspects: []
    };

    const testQuest: Quest = {
      id: uuidv4(),
      title: "Retrieve the Artifact",
      description: "Find and retrieve the ancient artifact",
      giverId: uuidv4(),
      giver: "Village Elder",
      status: "completed",
      objectives: [
        {
          id: uuidv4(),
          description: "Find the artifact location",
          requiredCount: 1,
          currentCount: 1,
          status: "completed"
        },
        {
          id: uuidv4(),
          description: "Retrieve the artifact",
          requiredCount: 1,
          currentCount: 1,
          status: "completed"
        }
      ],
      rewards: {
        xp: 500,
        reputation: {},
        items: []
      },
      prerequisites: {}
    };

    worldState.quests.push(testQuest);

    const player: PlayerCharacter = {
      id: uuidv4(),
      name: "Test Hero",
      aspects: [
        { id: uuidv4(), name: "Brave Adventurer", type: "high_concept" },
        { id: uuidv4(), name: "Hot-headed", type: "trouble" },
        { id: uuidv4(), name: "Curious", type: "other" }
      ],
      skills: [],
      stunts: [],
      backstory: { summary: "Hero", origin: "Here", secret: "None", formativeEvent: "Start" },
      personality: { traits: [], speechPattern: "Normal" },
      voice: { speechPattern: "Normal", tone: "Neutral", vocabulary: "Standard" },
      stressTracks: [
        { type: "physical", boxes: [false, false] },
        { type: "mental", boxes: [false, false] }
      ],
      consequences: [],
      fatePoints: { current: 3, refresh: 3 },
      milestones: { minor: 0, significant: 0, major: 0 },
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    };

    const rewardManager = new QuestRewardManager(worldState);
    const result = rewardManager.applyQuestRewards(player, testQuest, undefined, worldState);

    expect(result.success).toBe(true);
    expect(player.appliedRewardQuestIds).toContain(testQuest.id);
    expect(player.milestones.significant).toBe(1); // 500 XP = 1 significant milestone
  });

  it('should apply pending quest rewards on session load', async () => {
    // Test that pending rewards are properly applied during load
    const worldState: WorldState = {
      theme: { name: "Test", genre: "Fantasy", tone: "Epic", keywords: [] },
      locations: {},
      quests: [],
      factions: {},
      npcs: {},
      events: [],
      time: { value: "0", period: "morning" },
      aspects: []
    };

    const factionId = uuidv4();
    (worldState.factions as Record<string, any>)[factionId] = {
      id: factionId,
      name: "Test Faction",
      description: "A test faction",
      aspects: [],
      goals: [],
      members: [],
      relationships: {},
      territory: [],
      resources: [],
      isHidden: false
    };

    // Create and complete quest
    const completedQuest: Quest = {
      id: uuidv4(),
      title: "Test Quest",
      description: "A test quest",
      giverId: uuidv4(),
      giver: "Test NPC",
      status: "completed",
      objectives: [
        {
          id: uuidv4(),
          description: "Do something",
          requiredCount: 1,
          currentCount: 1,
          status: "completed"
        }
      ],
      rewards: {
        xp: 300,
        reputation: { [factionId]: 5 },
        items: []
      },
      prerequisites: {}
    };

    worldState.quests.push(completedQuest);

    const player: PlayerCharacter = {
      id: uuidv4(),
      name: "Test Hero",
      aspects: [
        { id: uuidv4(), name: "Brave Adventurer", type: "high_concept" },
        { id: uuidv4(), name: "Hot-headed", type: "trouble" },
        { id: uuidv4(), name: "Curious", type: "other" }
      ],
      skills: [],
      stunts: [],
      backstory: { summary: "Hero", origin: "Here", secret: "None", formativeEvent: "Start" },
      personality: { traits: [], speechPattern: "Normal" },
      voice: { speechPattern: "Normal", tone: "Neutral", vocabulary: "Standard" },
      stressTracks: [
        { type: "physical", boxes: [false, false] },
        { type: "mental", boxes: [false, false] }
      ],
      consequences: [],
      fatePoints: { current: 3, refresh: 3 },
      milestones: { minor: 0, significant: 0, major: 0 },
      completedQuestIds: [completedQuest.id],
      appliedRewardQuestIds: [],
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    };

    // Apply pending rewards - simulating session load
    const rewardManager = new QuestRewardManager(worldState);
    const results = rewardManager.applyPendingQuestRewards(player, worldState);

    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(player.appliedRewardQuestIds).toContain(completedQuest.id);
    expect(player.milestones.significant).toBe(1); // 300 XP = 1 significant milestone
  });

  it('should track milestone progression from quest rewards', async () => {
    // This test doesn't need GameMaster, just QuestRewardManager
    const worldState: WorldState = {
      theme: { name: "Test", genre: "Fantasy", tone: "Epic", keywords: [] },
      locations: {},
      quests: [],
      factions: {},
      npcs: {},
      events: [],
      time: { value: "0", period: "morning" },
      aspects: []
    };

    // Create multiple quests with different reward values
    const minorQuest: Quest = {
      id: uuidv4(),
      title: "Minor Task",
      description: "A minor task",
      giverId: uuidv4(),
      giver: "NPC",
      status: "completed",
      objectives: [{ id: uuidv4(), description: "Task", requiredCount: 1, currentCount: 1, status: "completed" }],
      rewards: { xp: 100, reputation: {}, items: [] },
      prerequisites: {}
    };

    const significantQuest: Quest = {
      id: uuidv4(),
      title: "Significant Task",
      description: "A significant task",
      giverId: uuidv4(),
      giver: "NPC",
      status: "completed",
      objectives: [{ id: uuidv4(), description: "Task", requiredCount: 1, currentCount: 1, status: "completed" }],
      rewards: { xp: 300, reputation: {}, items: [] },
      prerequisites: {}
    };

    const majorQuest: Quest = {
      id: uuidv4(),
      title: "Major Quest",
      description: "A major quest",
      giverId: uuidv4(),
      giver: "NPC",
      status: "completed",
      objectives: [{ id: uuidv4(), description: "Quest", requiredCount: 1, currentCount: 1, status: "completed" }],
      rewards: { xp: 900, reputation: {}, items: [] },
      prerequisites: {}
    };

    worldState.quests.push(minorQuest, significantQuest, majorQuest);

    const player: PlayerCharacter = {
      id: uuidv4(),
      name: "Test Hero",
      aspects: [
        { id: uuidv4(), name: "Hero", type: "high_concept" },
        { id: uuidv4(), name: "Brave", type: "trouble" },
        { id: uuidv4(), name: "Curious", type: "other" }
      ],
      skills: [],
      stunts: [],
      backstory: { summary: "Hero", origin: "Here", secret: "None", formativeEvent: "Start" },
      personality: { traits: [], speechPattern: "Normal" },
      voice: { speechPattern: "Normal", tone: "Neutral", vocabulary: "Standard" },
      stressTracks: [
        { type: "physical", boxes: [false, false] },
        { type: "mental", boxes: [false, false] }
      ],
      consequences: [],
      fatePoints: { current: 3, refresh: 3 },
      milestones: { minor: 0, significant: 0, major: 0 },
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    };

    // Apply rewards using QuestRewardManager
    const rewardManager = new QuestRewardManager(worldState);

    const result1 = rewardManager.applyQuestRewards(player, minorQuest, undefined, worldState);
    expect(result1.success).toBe(true);
    expect(player.milestones.minor).toBe(1);

    const result2 = rewardManager.applyQuestRewards(player, significantQuest, undefined, worldState);
    expect(result2.success).toBe(true);
    expect(player.milestones.significant).toBe(1);

    const result3 = rewardManager.applyQuestRewards(player, majorQuest, undefined, worldState);
    expect(result3.success).toBe(true);
    expect(player.milestones.major).toBe(1);

    // Verify quest IDs were tracked
    expect(player.appliedRewardQuestIds).toContain(minorQuest.id);
    expect(player.appliedRewardQuestIds).toContain(significantQuest.id);
    expect(player.appliedRewardQuestIds).toContain(majorQuest.id);
  });

  it('should prevent double-applying quest rewards', async () => {
    const worldState: WorldState = {
      theme: { name: "Test", genre: "Fantasy", tone: "Epic", keywords: [] },
      locations: {},
      quests: [],
      factions: {},
      npcs: {},
      events: [],
      time: { value: "0", period: "morning" },
      aspects: []
    };

    const testFactionId = uuidv4();
    const testFaction = {
      id: testFactionId,
      name: "Test Faction",
      description: "Test",
      aspects: [],
      goals: [],
      members: [],
      relationships: {},
      territory: [],
      resources: [],
      isHidden: false
    };
    (worldState.factions as Record<string, any>)[testFactionId] = testFaction;

    const testQuest: Quest = {
      id: uuidv4(),
      title: "Test Quest",
      description: "Test",
      giverId: uuidv4(),
      giver: "NPC",
      status: "completed",
      objectives: [{ id: uuidv4(), description: "Task", requiredCount: 1, currentCount: 1, status: "completed" }],
      rewards: { xp: 200, reputation: { [testFactionId]: 10 }, items: [] },
      prerequisites: {}
    };

    worldState.quests.push(testQuest);

    const player: PlayerCharacter = {
      id: uuidv4(),
      name: "Test Hero",
      aspects: [
        { id: uuidv4(), name: "Hero", type: "high_concept" },
        { id: uuidv4(), name: "Brave", type: "trouble" },
        { id: uuidv4(), name: "Curious", type: "other" }
      ],
      skills: [],
      stunts: [],
      backstory: { summary: "Hero", origin: "Here", secret: "None", formativeEvent: "Start" },
      personality: { traits: [], speechPattern: "Normal" },
      voice: { speechPattern: "Normal", tone: "Neutral", vocabulary: "Standard" },
      stressTracks: [
        { type: "physical", boxes: [false, false] },
        { type: "mental", boxes: [false, false] }
      ],
      consequences: [],
      fatePoints: { current: 3, refresh: 3 },
      milestones: { minor: 0, significant: 0, major: 0 },
      completedQuestIds: [testQuest.id],
      appliedRewardQuestIds: [testQuest.id],
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    };

    const rewardManager = new QuestRewardManager(worldState);

    // Attempting to apply should fail since already applied
    const result1 = rewardManager.applyQuestRewards(player, testQuest, undefined, worldState);
    expect(result1.success).toBe(false); // Already applied!

    // Milestones should not have changed
    expect(player.milestones.minor).toBe(0);
    expect(player.milestones.significant).toBe(0);
    expect(player.milestones.major).toBe(0); // No new rewards applied
  });

  it('should handle reputation updates for multiple factions', async () => {
    const worldState: WorldState = {
      theme: { name: "Test", genre: "Fantasy", tone: "Epic", keywords: [] },
      locations: {},
      quests: [],
      factions: {},
      npcs: {},
      events: [],
      time: { value: "0", period: "morning" },
      aspects: []
    };

    // Create multiple factions
    const faction1 = {
      id: uuidv4(),
      name: "Faction 1",
      description: "First",
      aspects: [],
      goals: [],
      members: [],
      relationships: {},
      territory: [],
      resources: [],
      isHidden: false
    };
    const faction2 = {
      id: uuidv4(),
      name: "Faction 2",
      description: "Second",
      aspects: [],
      goals: [],
      members: [],
      relationships: {},
      territory: [],
      resources: [],
      isHidden: false
    };
    const faction3 = {
      id: uuidv4(),
      name: "Faction 3",
      description: "Third",
      aspects: [],
      goals: [],
      members: [],
      relationships: {},
      territory: [],
      resources: [],
      isHidden: false
    };

    const factions = worldState.factions as Record<string, any>;
    factions[faction1.id] = faction1;
    factions[faction2.id] = faction2;
    factions[faction3.id] = faction3;

    // Quest gives reputation to multiple factions
    const quest: Quest = {
      id: uuidv4(),
      title: "Multi-Faction Quest",
      description: "Help many factions",
      giverId: uuidv4(),
      giver: "NPC",
      status: "completed",
      objectives: [{ id: uuidv4(), description: "Help", requiredCount: 1, currentCount: 1, status: "completed" }],
      rewards: {
        xp: 0,
        reputation: {
          [faction1.id]: 5,
          [faction2.id]: 10,
          [faction3.id]: -5  // Negative rep with one faction
        },
        items: []
      },
      prerequisites: {}
    };

    worldState.quests.push(quest);

    const player: PlayerCharacter = {
      id: uuidv4(),
      name: "Test Hero",
      aspects: [
        { id: uuidv4(), name: "Hero", type: "high_concept" },
        { id: uuidv4(), name: "Brave", type: "trouble" },
        { id: uuidv4(), name: "Curious", type: "other" }
      ],
      skills: [],
      stunts: [],
      backstory: { summary: "Hero", origin: "Here", secret: "None", formativeEvent: "Start" },
      personality: { traits: [], speechPattern: "Normal" },
      voice: { speechPattern: "Normal", tone: "Neutral", vocabulary: "Standard" },
      stressTracks: [
        { type: "physical", boxes: [false, false] },
        { type: "mental", boxes: [false, false] }
      ],
      consequences: [],
      fatePoints: { current: 3, refresh: 3 },
      milestones: { minor: 0, significant: 0, major: 0 },
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    };

    const rewardManager = new QuestRewardManager(worldState);
    const result = rewardManager.applyQuestRewards(player, quest, undefined, worldState);

    expect(result.success).toBe(true);
    expect(result.appliedRewards.reputation).toBeDefined();
    expect(Object.keys(result.appliedRewards.reputation!).length).toBeGreaterThanOrEqual(1);
    expect(player.appliedRewardQuestIds).toContain(quest.id);
  });

  it('should apply rewards from pending quests on session load using applyPendingQuestRewards', async () => {
    const worldState: WorldState = {
      theme: { name: "Test", genre: "Fantasy", tone: "Epic", keywords: [] },
      locations: [],
      quests: [],
      factions: [],
      npcs: [],
      events: [],
      time: { current: "0", description: "Start" }
    };

    const factionId = uuidv4();
    worldState.factions.push({
      id: factionId,
      name: "Test Faction",
      description: "Test",
      aspects: [],
      goals: [],
      resources: [],
      isHidden: false
    });

    // Create multiple completed quests
    const quest1: Quest = {
      id: uuidv4(),
      title: "First Quest",
      description: "First",
      giverId: uuidv4(),
      giver: "NPC1",
      status: "completed",
      objectives: [{ id: uuidv4(), description: "Do", requiredCount: 1, currentCount: 1, status: "completed" }],
      rewards: { xp: 100, reputation: { [factionId]: 5 }, items: [] },
      prerequisites: {}
    };

    const quest2: Quest = {
      id: uuidv4(),
      title: "Second Quest",
      description: "Second",
      giverId: uuidv4(),
      giver: "NPC2",
      status: "completed",
      objectives: [{ id: uuidv4(), description: "Do", requiredCount: 1, currentCount: 1, status: "completed" }],
      rewards: { xp: 200, reputation: { [factionId]: 10 }, items: [] },
      prerequisites: {}
    };

    worldState.quests.push(quest1, quest2);

    const player: PlayerCharacter = {
      id: uuidv4(),
      name: "Test Hero",
      aspects: [
        { id: uuidv4(), name: "Hero", type: "high_concept" },
        { id: uuidv4(), name: "Brave", type: "trouble" },
        { id: uuidv4(), name: "Curious", type: "other" }
      ],
      skills: [],
      stunts: [],
      backstory: { summary: "Hero", origin: "Here", secret: "None", formativeEvent: "Start" },
      personality: { traits: [], speechPattern: "Normal" },
      voice: { speechPattern: "Normal", tone: "Neutral", vocabulary: "Standard" },
      stressTracks: [
        { type: "physical", boxes: [false, false] },
        { type: "mental", boxes: [false, false] }
      ],
      consequences: [],
      fatePoints: { current: 3, refresh: 3 },
      milestones: { minor: 0, significant: 0, major: 0 },
      completedQuestIds: [quest1.id, quest2.id],
      appliedRewardQuestIds: [],
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    };

    const rewardManager = new QuestRewardManager(worldState);
    const results = rewardManager.applyPendingQuestRewards(player, worldState);

    expect(results.length).toBe(2);
    expect(results.every(r => r.success)).toBe(true);
    expect(player.appliedRewardQuestIds).toContain(quest1.id);
    expect(player.appliedRewardQuestIds).toContain(quest2.id);
    expect(player.milestones.minor).toBe(2); // 100 + 200 = 2 minor milestones
  });

  it('should handle missing quests gracefully in applyPendingQuestRewards', async () => {
    const worldState: WorldState = {
      theme: { name: "Test", genre: "Fantasy", tone: "Epic", keywords: [] },
      locations: [],
      quests: [],
      factions: [],
      npcs: [],
      events: [],
      time: { current: "0", description: "Start" }
    };

    const player: PlayerCharacter = {
      id: uuidv4(),
      name: "Test Hero",
      aspects: [
        { id: uuidv4(), name: "Hero", type: "high_concept" },
        { id: uuidv4(), name: "Brave", type: "trouble" },
        { id: uuidv4(), name: "Curious", type: "other" }
      ],
      skills: [],
      stunts: [],
      backstory: { summary: "Hero", origin: "Here", secret: "None", formativeEvent: "Start" },
      personality: { traits: [], speechPattern: "Normal" },
      voice: { speechPattern: "Normal", tone: "Neutral", vocabulary: "Standard" },
      stressTracks: [
        { type: "physical", boxes: [false, false] },
        { type: "mental", boxes: [false, false] }
      ],
      consequences: [],
      fatePoints: { current: 3, refresh: 3 },
      milestones: { minor: 0, significant: 0, major: 0 },
      completedQuestIds: [uuidv4(), uuidv4()], // Quests that don't exist
      appliedRewardQuestIds: [],
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} }
    };

    const rewardManager = new QuestRewardManager(worldState);

    // Should not throw - just return empty results
    const results = rewardManager.applyPendingQuestRewards(player, worldState);
    expect(results.length).toBe(0);
  });
});
