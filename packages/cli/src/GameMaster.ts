import { TurnManager, DeltaCollector, ActionResolver, FateDice, GameTime } from '@llmrpg/core';
import { LLMProvider } from '@llmrpg/llm';
import { SessionWriter, SessionLoader } from '@llmrpg/storage';
import { SceneState, PlayerCharacter } from '@llmrpg/protocol';
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
  private sessionLoader: SessionLoader | undefined;
  private currentScene: SceneState | undefined;
  private player: PlayerCharacter | undefined;

  private fateDice: FateDice;

  constructor(
    private sessionId: string,
    llmProvider: LLMProvider,
    sessionWriter: SessionWriter,
    sessionLoader?: SessionLoader
  ) {
    this.turnManager = new TurnManager(sessionId);
    this.deltaCollector = new DeltaCollector(sessionId, 0);
    this.actionResolver = new ActionResolver();
    this.fateDice = new FateDice(Date.now());
    this.sessionWriter = sessionWriter;
    this.sessionLoader = sessionLoader;

    this.worldManager = new WorldManager();
    this.narrativeEngine = new NarrativeEngine(llmProvider);
    this.contentGenerator = new ContentGenerator(llmProvider);
    this.decisionEngine = new DecisionEngine(llmProvider);
  }

  async start() {
    console.log("Game Master initialized.");
  }

  async saveState() {
    const worldStateToSave = {
        ...this.worldManager.state,
        currentScene: this.currentScene
    };
    await this.sessionWriter.updateCurrentState(this.sessionId, worldStateToSave, this.player || {});
    console.log("Game state saved.");
  }

  async loadState() {
    if (!this.sessionLoader) {
        throw new Error("SessionLoader not initialized");
    }
    console.log(`Loading session ${this.sessionId}...`);
    const state = await this.sessionLoader.loadCurrentState(this.sessionId);
    
    // Restore World State
    this.worldManager.state = state.world;
    
    // Restore Player
    this.player = state.player;

    // Restore Current Scene (if saved in world state)
    if ((state.world as any).currentScene) {
        this.currentScene = (state.world as any).currentScene;
    }

    console.log("Game state loaded.");
    if (this.player) {
        console.log(`Player: ${this.player.name}`);
    }
    if (this.currentScene) {
        console.log(`Current Scene: ${this.currentScene.name}`);
    }
  }

  async initializeWorld(themeInput: string) {
    console.log("Generating world theme...");
    const theme = await this.contentGenerator.generateWorldTheme(themeInput);
    
    console.log(`Theme generated: ${theme.name} (${theme.genre})`);
    console.log("Generating starting location...");
    const startingLocation = await this.contentGenerator.generateStartingLocation(theme);

    // Update World State
    this.worldManager.state.theme = theme;
    this.worldManager.setLocation(startingLocation);
    
    // Set initial time
    this.worldManager.setTime("Start", "Day 1");

    // Generate Scenario
    console.log("Generating starting scenario...");
    const scenario = await this.contentGenerator.generateStartingScenario(theme, startingLocation);

    // Create Initial Scene
    this.currentScene = {
        id: `scene-${Date.now()}`,
        name: scenario.title,
        description: scenario.description,
        locationId: startingLocation.id,
        aspects: [],
        startTurn: 1,
        type: 'exploration'
    };

    // Log initialization
    console.log(`World initialized at ${startingLocation.name}`);
    console.log(`Scenario: ${scenario.title}`);
    console.log(`Hook: ${scenario.hook}`);
    
    await this.saveState();

    return {
        theme,
        startingLocation,
        scenario
    };
  }

  async createCharacter(concept: string) {
    console.log(`Generating character for concept: ${concept}...`);
    const theme = this.worldManager.state.theme;
    const charData = await this.contentGenerator.generateCharacter(concept, theme);

    // Construct PlayerCharacter object
    this.player = {
        id: `player-${Date.now()}`,
        type: 'player',
        name: charData.name,
        appearance: charData.appearance,
        aspects: charData.aspects.map((a: any) => ({
            id: `asp-${Math.random().toString(36).substr(2, 9)}`,
            name: a.name,
            kind: a.type === 'highConcept' || a.type === 'trouble' ? 'character' : 'character',
            isTemporary: false
        })),
        skills: charData.skills.map((s: any) => ({
            name: s.name,
            rating: s.level
        })),
        stunts: charData.stunts.map((s: any) => ({
            name: s.name,
            description: s.description,
            cost: 0,
            refresh: 0
        })),
        stressTracks: [
            { type: "physical", capacity: 2, boxes: [false, false] },
            { type: "mental", capacity: 2, boxes: [false, false] }
        ],
        consequences: [],
        fatePoints: { current: 3, refresh: 3 },
        personality: charData.personality,
        backstory: charData.backstory,
        voice: charData.voice,
        knowledge: {
            facts: {},
            beliefs: {},
            secrets: [],
            expertise: []
        },
        relationships: [],
        currentLocation: this.worldManager.state.locations[Object.keys(this.worldManager.state.locations)[0]]?.id || "unknown",
        isAlive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        goals: [],
        inventory: [],
        milestones: { minor: 0, significant: 0, major: 0 }
    };

    console.log(`Character created: ${this.player.name}`);
    console.log(`High Concept: ${this.player.aspects.find(a => a.name === charData.aspects.find((ca: any) => ca.type === 'highConcept')?.name)?.name}`);
    
    await this.saveState();

    return this.player;
  }

  getWorldState() {
    return this.worldManager.state;
  }

  async processPlayerAction(playerAction: string) {
    // 1. Start Turn
    const gameTime: GameTime = {
        day: 1,
        timeOfDay: 'morning',
        timestamp: Date.now()
    };
    
    const sceneId = this.currentScene?.id || "scene-unknown";
    const turn = this.turnManager.startTurn("player", sceneId, gameTime);
    
    // Update DeltaCollector with new turn ID
    this.deltaCollector = new DeltaCollector(this.sessionId, turn.turnId);

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
    // Always record time passing
    const oldTime = this.worldManager.state.time.value;
    // Simplified time increment
    this.worldManager.state.time.value = (parseInt(oldTime) + 1).toString();
    
    this.deltaCollector.collect({
        target: 'world',
        operation: 'set',
        path: ['time', 'value'],
        previousValue: oldTime,
        newValue: this.worldManager.state.time.value,
        cause: 'time_pass',
        eventId: turn.events[0]?.eventId || 'unknown'
    });

    if (this.player) {
        // Example: Player gains a Fate Point on success with style (shifts >= 3)
        if (shifts >= 3) {
            const oldFP = this.player.fatePoints.current;
            this.player.fatePoints.current += 1;
            
            this.deltaCollector.collect({
                target: 'player',
                operation: 'increment',
                path: ['fatePoints', 'current'],
                previousValue: oldFP,
                newValue: this.player.fatePoints.current,
                cause: 'success_with_style',
                eventId: turn.events[turn.events.length - 1].eventId
            });
        }
    }

    // 7. Narrate
    const narration = await this.narrativeEngine.narrate(turn.events);

    // 8. Save Turn and Deltas
    await this.sessionWriter.writeTurn(this.sessionId, turn);
    
    const deltas = this.deltaCollector.getDeltas();
    for (const delta of deltas) {
        await this.sessionWriter.writeDelta(this.sessionId, delta);
    }

    await this.saveState();

    return {
        turn,
        narration,
        result: shifts >= 0 ? "Success" : "Failure"
    };
  }
}
