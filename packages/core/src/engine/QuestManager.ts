import { 
  WorldState, 
  Quest, 
  QuestSchema, 
  Objective, 
  ObjectiveSchema,
  QuestStatus,
  ObjectiveStatus
} from '@llmrpg/protocol';

export class QuestManager {

  /**
   * Add a new quest to the world state
   */
  static addQuest(worldState: WorldState, quest: Quest): void {
    // Check if quest already exists
    const existing = worldState.quests.find(q => q.id === quest.id);
    if (existing) {
      // Update existing? Or throw? For now, ignore if exists to prevent duplicates
      return;
    }
    worldState.quests.push(quest);
  }

  /**
   * Get a quest by ID
   */
  static getQuest(worldState: WorldState, questId: string): Quest | undefined {
    return worldState.quests.find(q => q.id === questId);
  }

  /**
   * Update an objective's progress
   */
  static updateObjective(
    worldState: WorldState, 
    questId: string, 
    objectiveId: string, 
    count: number
  ): void {
    const quest = this.getQuest(worldState, questId);
    if (!quest) return;

    const objective = quest.objectives.find(o => o.id === objectiveId);
    if (!objective) return;

    objective.currentCount = count;
    
    // Auto-complete if count reached
    if (objective.currentCount >= objective.requiredCount && objective.status === 'active') {
      objective.status = 'completed';
      this.checkQuestCompletion(quest);
    }
  }

  /**
   * Manually set objective status
   */
  static setObjectiveStatus(
    worldState: WorldState,
    questId: string,
    objectiveId: string,
    status: ObjectiveStatus
  ): void {
    const quest = this.getQuest(worldState, questId);
    if (!quest) return;

    const objective = quest.objectives.find(o => o.id === objectiveId);
    if (!objective) return;

    objective.status = status;
    
    if (status === 'completed') {
      this.checkQuestCompletion(quest);
    }
  }

  /**
   * Check if all objectives are complete and update quest status
   */
  private static checkQuestCompletion(quest: Quest): void {
    const allComplete = quest.objectives.every(o => o.status === 'completed');
    if (allComplete && quest.status === 'active') {
      // Check for next stage
      if (quest.stages && quest.currentStageId) {
        const currentStage = quest.stages[quest.currentStageId];
        if (currentStage && currentStage.nextStageId) {
          this.advanceStage(quest, currentStage.nextStageId);
          return;
        }
      }
      
      // No next stage, complete the quest
      quest.status = 'completed';
    }
  }

  /**
   * Advance quest to the next stage
   */
  private static advanceStage(quest: Quest, nextStageId: string): void {
    if (!quest.stages || !quest.stages[nextStageId]) {
      console.warn(`Cannot advance quest ${quest.id} to missing stage ${nextStageId}`);
      return;
    }

    const nextStage = quest.stages[nextStageId];
    quest.currentStageId = nextStageId;
    quest.objectives = nextStage.objectives.map(o => ({ ...o, status: 'active', currentCount: 0 }));
    
    // Optionally update quest description to match stage description
    if (nextStage.description) {
      quest.description = nextStage.description;
    }
  }

  /**
   * Set quest status directly
   */
  static setQuestStatus(
    worldState: WorldState,
    questId: string,
    status: QuestStatus
  ): void {
    const quest = this.getQuest(worldState, questId);
    if (!quest) return;

    quest.status = status;
  }
  
  /**
   * Create a new quest object helper
   */
  static createQuest(
    id: string,
    title: string,
    description: string,
    objectives: Objective[] = []
  ): Quest {
    return {
      id,
      title,
      description,
      status: 'active',
      objectives,
      isHidden: false
    };
  }
}
