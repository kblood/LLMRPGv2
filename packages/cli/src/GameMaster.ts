import { TurnManager, DeltaCollector, ActionResolver, FateDice, GameTime } from '@llmrpg/core';
import { LLMProvider } from '@llmrpg/llm';
import { SessionWriter } from '@llmrpg/storage';
import { NarrativeEngine } from './systems/NarrativeEngine';
import { ContentGenerator } from './systems/ContentGenerator';
import { DecisionEngine } from './systems/DecisionEngine';
import { WorldManager } from './systems/WorldManager';

export class GameMaster {
  private turnManager: TurnManager;
  private deltaCollector: DeltaCollector;
  private actionResolver: ActionResolver;
  private narrativeEngine: NarrativeEngine;
  private contentGenerator: ContentGenerator;
  private decisionEngine: DecisionEngine;
  private worldManager: WorldManager;
  private sessionWriter: SessionWriter;

  private fateDice: FateDice;

  constructor(
    private sessionId: string,
    llmProvider: LLMProvider,
    sessionWriter: SessionWriter
  ) {
    this.turnManager = new TurnManager(sessionId);
    this.deltaCollector = new DeltaCollector(sessionId, 0);
    this.actionResolver = new ActionResolver();
    this.fateDice = new FateDice(Date.now());
    this.sessionWriter = sessionWriter;

    this.worldManager = new WorldManager();
    this.narrativeEngine = new NarrativeEngine(llmProvider);
    this.contentGenerator = new ContentGenerator(llmProvider);
    this.decisionEngine = new DecisionEngine(llmProvider);
  }

  async start() {
    console.log("Game Master initialized.");
  }

  async processPlayerAction(playerAction: string) {
    // 1. Start Turn
    const gameTime: GameTime = {
        day: 1,
        timeOfDay: 'morning',
        timestamp: Date.now()
    };
    // TODO: Get current scene ID from WorldManager
    const turn = this.turnManager.startTurn("player", "scene-1", gameTime);

    // 2. Determine Fate Action (Simplified)
    // In a real implementation, we'd use the LLM to classify the action
    const fateAction = "overcome"; 

    // 3. Set Opposition
    const opposition = await this.decisionEngine.setOpposition({ action: fateAction });

    // 4. Roll Dice
    // Assuming player has +1 skill for now
    const playerSkill = 1;
    const roll = this.fateDice.roll();
    const total = roll.total + playerSkill;
    const shifts = total - opposition;

    // 5. Generate Events
    this.turnManager.addEvent('skill_check', fateAction, {
        description: `Player attempted to ${playerAction}`,
        roll,
        difficulty: opposition,
        shifts
    });

    // 6. Collect Deltas
    // this.deltaCollector.collectFromEvents(turn.events);

    // 7. Narrate
    const narration = await this.narrativeEngine.narrate(turn.events);

    // 8. Save Turn
    await this.sessionWriter.writeTurn(this.sessionId, turn);

    return {
        turn,
        narration,
        result: shifts >= 0 ? "Success" : "Failure"
    };
  }
}
