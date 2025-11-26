import { describe, it, expect, beforeEach } from 'vitest';
import { ContentGenerator } from '../src/systems/ContentGenerator';
import { MockAdapter } from '@llmrpg/llm';
import { WorldState, Quest } from '@llmrpg/protocol';
import { QuestManager } from '@llmrpg/core';
import { v4 as uuidv4 } from 'uuid';

describe('Complex Quest System', () => {
  let contentGenerator: ContentGenerator;
  let mockAdapter: MockAdapter;
  let worldState: WorldState;

  beforeEach(() => {
    mockAdapter = new MockAdapter();
    contentGenerator = new ContentGenerator(mockAdapter);
    
    worldState = {
      theme: {
        name: "Test World",
        genre: "Fantasy",
        tone: "Epic",
        keywords: ["Magic"]
      },
      locations: {},
      aspects: [],
      time: { value: "0" },
      plotThreads: [],
      quests: [],
      factions: {},
      establishedFacts: {}
    };
  });

  it('should generate and progress through a multi-stage quest', async () => {
    // Mock LLM response for quest generation
    mockAdapter.setNextResponse(JSON.stringify({
      title: "The Ancient Artifact",
      description: "Recover the lost artifact.",
      stages: [
        {
          id: "stage_1",
          description: "Find the map in the library.",
          objectives: [
            { description: "Search the library", type: "interact", requiredCount: 1 }
          ],
          nextStageId: "stage_2"
        },
        {
          id: "stage_2",
          description: "Travel to the ruins.",
          objectives: [
            { description: "Travel to ruins", type: "visit", requiredCount: 1 }
          ],
          nextStageId: "stage_3"
        },
        {
          id: "stage_3",
          description: "Defeat the guardian.",
          objectives: [
            { description: "Defeat Guardian", type: "kill", requiredCount: 1 }
          ]
        }
      ],
      rewards: { xp: 100, items: ["Ancient Artifact"] }
    }));

    // 1. Generate Quest
    const questData = await contentGenerator.generateComplexQuest(worldState.theme, "Find an artifact");
    
    expect(questData).toBeDefined();
    expect(questData.stages).toHaveLength(3);

    // 2. Create Quest Object
    const quest: Quest = {
      id: uuidv4(),
      title: questData.title,
      description: questData.description,
      status: 'active',
      stages: {},
      currentStageId: questData.stages[0].id,
      objectives: [], // Will be populated from first stage
      isHidden: false
    };

    // Populate stages map
    questData.stages.forEach((s: any) => {
      if (!quest.stages) quest.stages = {};
      quest.stages[s.id] = {
        id: s.id,
        description: s.description,
        objectives: s.objectives.map((o: any) => ({
          id: uuidv4(),
          ...o,
          status: 'active',
          currentCount: 0
        })),
        nextStageId: s.nextStageId
      };
    });

    // Initialize first stage objectives
    if (quest.stages && quest.currentStageId) {
      const firstStage = quest.stages[quest.currentStageId];
      quest.objectives = firstStage.objectives.map(o => ({ ...o }));
      quest.description = firstStage.description;
    }

    QuestManager.addQuest(worldState, quest);

    // Verify initial state
    expect(quest.currentStageId).toBe("stage_1");
    expect(quest.objectives[0].description).toBe("Search the library");
    expect(quest.status).toBe("active");

    // 3. Complete Stage 1
    const obj1 = quest.objectives[0];
    QuestManager.updateObjective(worldState, quest.id, obj1.id, 1);

    // Verify transition to Stage 2
    expect(quest.currentStageId).toBe("stage_2");
    expect(quest.description).toBe("Travel to the ruins.");
    expect(quest.objectives[0].description).toBe("Travel to ruins");
    expect(quest.status).toBe("active");

    // 4. Complete Stage 2
    const obj2 = quest.objectives[0];
    QuestManager.updateObjective(worldState, quest.id, obj2.id, 1);

    // Verify transition to Stage 3
    expect(quest.currentStageId).toBe("stage_3");
    expect(quest.description).toBe("Defeat the guardian.");
    expect(quest.objectives[0].description).toBe("Defeat Guardian");

    // 5. Complete Stage 3 (Final)
    const obj3 = quest.objectives[0];
    QuestManager.updateObjective(worldState, quest.id, obj3.id, 1);

    // Verify Quest Completion
    expect(quest.status).toBe("completed");
  });
});
