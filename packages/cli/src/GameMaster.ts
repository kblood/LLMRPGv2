import { v4 as uuidv4 } from 'uuid';
import { TurnManager, DeltaCollector, ActionResolver, FateDice, GameTime, CharacterDefinition, Turn, FateOutcome, KnowledgeManager, QuestManager, FactionManager } from '@llmrpg/core';
import { LLMProvider } from '@llmrpg/llm';
import { SessionWriter, SessionLoader } from '@llmrpg/storage';
import { SceneState, PlayerCharacter, KnowledgeProfile } from '@llmrpg/protocol';
import { NarrativeEngine } from './systems/NarrativeEngine';
import { ContentGenerator } from './systems/ContentGenerator';
import { DecisionEngine } from './systems/DecisionEngine';
import { WorldManager } from './systems/WorldManager';
import { CombatManager } from './systems/CombatManager';
import { DialogueSystem } from './systems/DialogueSystem';

export class GameMaster {
  private turnManager: TurnManager;
  private deltaCollector: DeltaCollector;
  private actionResolver: ActionResolver;
  private narrativeEngine: NarrativeEngine;
  private contentGenerator: ContentGenerator;
  private decisionEngine: DecisionEngine;
  private worldManager: WorldManager;
  private factionManager: FactionManager;
  private combatManager: CombatManager;
  private dialogueSystem: DialogueSystem;
  private sessionWriter: SessionWriter;
  private sessionLoader: SessionLoader | undefined;
  private currentScene: SceneState | undefined;
  private player: PlayerCharacter | undefined;
  private npcs: Record<string, CharacterDefinition> = {};
  private history: Turn[] = [];

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
    this.factionManager = new FactionManager(this.worldManager.state);
    this.narrativeEngine = new NarrativeEngine(llmProvider);
    this.contentGenerator = new ContentGenerator(llmProvider);
    this.decisionEngine = new DecisionEngine(llmProvider);
    this.dialogueSystem = new DialogueSystem(llmProvider);
    this.combatManager = new CombatManager(
      this.turnManager,
      this.decisionEngine,
      this.narrativeEngine,
      this.fateDice
    );
  }

  async start() {
    console.log("Game Master initialized.");
  }

  async saveState() {
    const worldStateToSave = {
        ...this.worldManager.state,
        currentScene: this.currentScene
    };
    await this.sessionWriter.updateCurrentState(this.sessionId, worldStateToSave, this.player || {}, this.npcs);
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
    this.factionManager = new FactionManager(this.worldManager.state);
    
    // Restore Player
    this.player = state.player;

    // Restore NPCs
    this.npcs = state.npcs || {};

    // Restore Current Scene (if saved in world state)
    if ((state.world as any).currentScene) {
        this.currentScene = (state.world as any).currentScene;
    }

    // TODO: Load history from session logs if needed for context
    // For now, history starts empty on load

    console.log("Game state loaded.");
    if (this.player) {
        console.log(`Player: ${this.player.name}`);
    }
    if (this.currentScene) {
        console.log(`Current Scene: ${this.currentScene.name}`);
    }
  }

  private getCharacterDefinition(): CharacterDefinition | undefined {
    if (!this.player) return undefined;

    // Map PlayerCharacter (Protocol) to CharacterDefinition (Core/LLM)
    return {
      id: this.player.id,
      name: this.player.name,
      highConcept: this.player.aspects.find(a => a.type === 'high_concept')?.name || this.player.aspects[0]?.name || "Unknown",
      trouble: this.player.aspects.find(a => a.type === 'trouble')?.name || this.player.aspects[1]?.name || "Unknown",
      aspects: this.player.aspects.map(a => a.name),
      personality: {
        ...this.player.personality,
        speechPattern: this.player.voice.speechPattern
      },
      backstory: {
        summary: this.player.backstory.summary,
        origin: this.player.backstory.origin,
        motivation: "Unknown",
        secrets: [this.player.backstory.secret || ""],
        keyEvents: [this.player.backstory.formativeEvent]
      },
      skills: this.player.skills.reduce((acc, s) => ({ ...acc, [s.name]: s.rank || (s as any).rating || 0 }), {}),
      stunts: this.player.stunts.map(s => ({
        name: s.name,
        description: s.description,
        mechanical: ""
      })),
      stress: {
        physical: this.player.stressTracks.find(t => t.type === 'physical')?.boxes || [],
        mental: this.player.stressTracks.find(t => t.type === 'mental')?.boxes || []
      },
      consequences: {
        mild: this.player.consequences.find(c => c.severity === 'mild')?.name,
        moderate: this.player.consequences.find(c => c.severity === 'moderate')?.name,
        severe: this.player.consequences.find(c => c.severity === 'severe')?.name
      },
      fatePoints: this.player.fatePoints.current,
      relationships: [],
      knowledge: {
        locations: {},
        npcs: {},
        quests: {},
        factions: {},
        secrets: {},
        items: {},
        topics: {}
      }
    } as CharacterDefinition;
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
    
    // Generate Factions
    console.log("Generating factions...");
    const factionsData = await this.contentGenerator.generateFactions(theme);
    
    for (const fData of factionsData) {
        this.factionManager.createFaction({
            name: fData.name,
            description: fData.description,
            aspects: fData.aspects.map((a: string) => ({ 
                id: uuidv4(),
                name: a, 
                type: 'situational', 
                freeInvokes: 0 
            })),
            goals: fData.goals,
            resources: fData.resources,
            isHidden: fData.isHidden
        });
    }
    console.log(`Generated ${factionsData.length} factions.`);
    
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
            rank: s.level || s.rating || 0
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
        voice: charData.voice || {
            tone: "Neutral",
            speechPattern: charData.personality?.speechPattern || "Normal",
            vocabulary: "Average",
            commonPhrases: []
        },
        knowledge: {
            locations: {},
            npcs: {},
            quests: {},
            factions: {},
            secrets: {},
            items: {},
            topics: {}
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

  private findNPCByName(name: string): CharacterDefinition | undefined {
    // First check active NPCs in the current location
    if (this.currentScene) {
        const location = this.worldManager.getLocation(this.currentScene.locationId);
        if (location && location.presentNPCs) {
            for (const npcId of location.presentNPCs) {
                const npc = this.npcs[npcId];
                if (npc && npc.name.toLowerCase().includes(name.toLowerCase())) {
                    return npc;
                }
            }
        }
    }
    // Then check all known NPCs
    return Object.values(this.npcs).find(npc => npc.name.toLowerCase().includes(name.toLowerCase()));
  }

  async processPlayerAction(playerAction: string) {
    // Check for Meta Commands
    if (playerAction.startsWith('/')) {
        return this.handleMetaCommand(playerAction);
    }

    // Check for Combat
    if (this.currentScene?.conflict && !this.currentScene.conflict.isResolved) {
        return this.processCombatTurn(playerAction);
    }

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

    // 2. Determine Fate Action
    const characterDefinition = this.getCharacterDefinition();
    const worldState = this.worldManager.state;

    // Identify Target for potential social interaction
    const targetName = await this.decisionEngine.identifyTarget({
        action: { description: playerAction },
        player: characterDefinition,
        worldState,
        history: this.history
    });
    const targetNPC = targetName ? this.findNPCByName(targetName) : undefined;

    // Get Faction Reputation if target exists
    let factionReputation: { factionName: string; reputation: number; rank: string }[] | undefined = undefined;
    if (targetNPC && targetNPC.affiliations && characterDefinition) {
         factionReputation = targetNPC.affiliations.map(aff => {
             const rep = this.factionManager.getReputation(aff.factionId, characterDefinition.id);
             const rank = this.factionManager.getRank(aff.factionId, characterDefinition.id);
             return {
                 factionName: aff.factionName,
                 reputation: rep,
                 rank
             };
         });
    }

    const fateAction = await this.decisionEngine.classifyAction(playerAction, {
        action: playerAction,
        player: characterDefinition,
        worldState,
        history: this.history
    });

    // 3. Select Skill
    const skillSelection = await this.decisionEngine.selectSkill({
        action: { type: fateAction, description: playerAction },
        player: characterDefinition,
        worldState,
        history: this.history
    });

    // 4. Set Opposition
    const opposition = await this.decisionEngine.setOpposition({
        action: { type: fateAction, description: playerAction, skill: skillSelection.name },
        player: characterDefinition,
        worldState,
        history: this.history,
        targetNPC,
        factionReputation
    });

    // 5. Roll Dice
    const roll = this.fateDice.roll();
    const resolution = ActionResolver.resolve(roll, skillSelection.rating, opposition);

    // 6. Generate Events
    this.turnManager.addEvent('skill_check', fateAction, {
        description: `Player attempted to ${playerAction} using ${skillSelection.name}. Outcome: ${resolution.outcome}`,
        roll,
        difficulty: opposition,
        shifts: resolution.shifts
    });

    // 7. Collect Deltas & Apply Consequences
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

    await this.applyActionConsequences(fateAction, resolution, turn);

    // Check for Knowledge Gain
    if (resolution.outcome === 'success' || resolution.outcome === 'success_with_style') {
        const knowledgeGain = await this.decisionEngine.determineKnowledgeGain({
            action: { type: fateAction, description: playerAction },
            player: characterDefinition,
            worldState,
            history: this.history
        }, resolution.outcome);

        if (knowledgeGain) {
            this.applyKnowledgeUpdate(knowledgeGain, turn);
        }
    }

    // Check for Quest Updates
    const questUpdate = await this.decisionEngine.determineQuestUpdate({
        action: { type: fateAction, description: playerAction },
        player: characterDefinition,
        worldState,
        history: this.history
    }, resolution.outcome);

    if (questUpdate) {
        this.applyQuestUpdate(questUpdate, turn);
    }

    // Check for World Updates
    const worldUpdates = await this.decisionEngine.determineWorldUpdates({
        action: { type: fateAction, description: playerAction },
        player: characterDefinition,
        worldState,
        history: this.history
    }, resolution.outcome);

    if (worldUpdates.length > 0) {
        this.applyWorldUpdates(worldUpdates, turn);
    }

    // Generate NPC Dialogue if applicable
    if (targetNPC) {
        const isSocial = ["Rapport", "Provoke", "Deceive", "Empathy", "Contacts"].includes(skillSelection.name) 
                         || fateAction === "create_advantage" 
                         || fateAction === "overcome";

        if (isSocial && characterDefinition) {
             // Find relationship
             // Note: CharacterDefinition in core might not have relationships array fully typed as in protocol
             // We'll cast or check safely
             const relationships = (characterDefinition as any).relationships || [];
             const relationship = relationships.find((r: any) => r.targetId === targetNPC.id);

             const npcDialogue = await this.dialogueSystem.generateDialogue(playerAction, {
                npc: targetNPC,
                player: characterDefinition,
                history: this.history,
                relationship,
                factionReputation
             });

             if (npcDialogue) {
                this.turnManager.addEvent('dialogue', 'npc_speak', {
                    actor: targetNPC.name,
                    target: characterDefinition.name,
                    description: `${targetNPC.name} says: "${npcDialogue}"`,
                    metadata: {
                        speaker: targetNPC.name,
                        text: npcDialogue
                    }
                });
             }
        }
    }

    // 8. Narrate
    const narration = await this.narrativeEngine.narrate({
        events: turn.events,
        player: characterDefinition,
        worldState,
        history: this.history
    });

    // Update history
    this.history.push(turn);
    if (this.history.length > 10) {
        this.history.shift();
    }

    // 9. Save Turn and Deltas
    await this.sessionWriter.writeTurn(this.sessionId, turn);
    
    const deltas = this.deltaCollector.getDeltas();
    for (const delta of deltas) {
        await this.sessionWriter.writeDelta(this.sessionId, delta);
    }

    await this.saveState();

    return {
        turn,
        narration,
        result: resolution.outcome
    };
  }

  /**
   * Generate and start a new complex quest based on context
   */
  async generateQuest(context: string): Promise<void> {
    console.log(`Generating quest for context: ${context}...`);
    const theme = this.worldManager.state.theme;
    const questData = await this.contentGenerator.generateComplexQuest(theme, context);

    if (!questData) {
        console.log("Failed to generate quest.");
        return;
    }

    const quest: any = {
      id: uuidv4(),
      title: questData.title,
      description: questData.description,
      status: 'active',
      stages: {},
      currentStageId: questData.stages[0].id,
      objectives: [],
      isHidden: false,
      rewards: questData.rewards
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
      quest.objectives = firstStage.objectives.map((o: any) => ({ ...o }));
      quest.description = firstStage.description;
    }

    QuestManager.addQuest(this.worldManager.state, quest);
    console.log(`New Quest Added: ${quest.title}`);
    console.log(`Objective: ${quest.description}`);
    
    // Add event for quest start
    this.turnManager.addEvent('quest_update', 'quest_started', {
        description: `Quest Started: ${quest.title}`,
        metadata: {
            questId: quest.id,
            title: quest.title,
            description: quest.description
        }
    });
  }

  private applyWorldUpdates(updates: any[], turn: Turn) {
    const lastEventId = turn.events[turn.events.length - 1]?.eventId || 'unknown';
    
    for (const update of updates) {
        if (this.currentScene) {
            const location = this.worldManager.getLocation(this.currentScene.locationId);
            if (!location) continue;

            if (update.type === 'add_aspect') {
                const newAspect = {
                    id: `asp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    name: update.data.name,
                    type: update.data.type || 'situational',
                    freeInvokes: 0
                };
                location.aspects.push(newAspect);
                
                this.deltaCollector.collect({
                    target: 'world', // Simplified target
                    operation: 'append',
                    path: ['locations', location.id, 'aspects'],
                    newValue: newAspect,
                    previousValue: null,
                    cause: 'world_update',
                    eventId: lastEventId
                });
                
                this.turnManager.addEvent('state_change', 'add_aspect', {
                    description: `New aspect created: ${newAspect.name}`,
                    metadata: { aspect: newAspect }
                });
            } else if (update.type === 'modify_feature') {
                const feature = location.features.find(f => f.name.toLowerCase() === update.targetId.toLowerCase());
                if (feature) {
                    const oldDesc = feature.description;
                    feature.description = update.data.description;
                    
                    this.deltaCollector.collect({
                        target: 'world',
                        operation: 'set',
                        path: ['locations', location.id, 'features', location.features.indexOf(feature).toString(), 'description'],
                        previousValue: oldDesc,
                        newValue: feature.description,
                        cause: 'world_update',
                        eventId: lastEventId
                    });

                    this.turnManager.addEvent('state_change', 'modify_feature', {
                        description: `Feature updated: ${feature.name}`,
                        metadata: { feature }
                    });
                }
            }
        }
    }
  }

  private async applyActionConsequences(action: string, resolution: any, turn: Turn) {
    if (!this.player) return;

    const lastEventId = turn.events[turn.events.length - 1].eventId;

    // Handle Success with Style (General)
    if (resolution.outcome === 'success_with_style') {
        // Grant a boost (simplified as a Fate Point for now if no boost system)
        // Or just log it.
        // For now, let's stick to the previous logic of granting a FP on style
        /*
        const oldFP = this.player.fatePoints.current;
        this.player.fatePoints.current += 1;
        
        this.deltaCollector.collect({
            target: 'player',
            operation: 'increment',
            path: ['fatePoints', 'current'],
            previousValue: oldFP,
            newValue: this.player.fatePoints.current,
            cause: 'success_with_style',
            eventId: lastEventId
        });
        */
       // Actually, Success with Style usually gives a Boost, not a FP.
       // But let's keep it simple.
    }

    // Handle Create Advantage
    if (action === 'create_advantage') {
        if (resolution.outcome === 'success' || resolution.outcome === 'success_with_style') {
            // Create a temporary aspect
            // We'd need the LLM to name the aspect based on the action
            // For now, we'll just log it
            this.turnManager.addEvent('state_change', 'create_advantage', {
                description: `Advantage created! (Placeholder for Aspect generation)`,
            });
        }
    }

    // Handle Attack
    if (action === 'attack') {
        if (resolution.outcome === 'success' || resolution.outcome === 'success_with_style') {
            // Deal stress
            const damage = resolution.shifts;
            this.turnManager.addEvent('state_change', 'attack', {
                description: `Dealt ${damage} shifts of damage (Placeholder for target application)`,
            });
        }
    }
  }

  async startCombat(opponents: CharacterDefinition[]) {
    if (!this.currentScene || !this.player) return;
    
    // Add opponents to tracked NPCs
    opponents.forEach(npc => {
        this.npcs[npc.id] = npc;
    });

    const conflict = await this.combatManager.startConflict(
      this.currentScene,
      'physical',
      opponents,
      this.player
    );
    
    console.log(`Combat started! ID: ${conflict.id}`);
    return conflict;
  }

  async startSocialConflict(opponents: CharacterDefinition[]) {
    if (!this.currentScene || !this.player) return;
    
    // Add opponents to tracked NPCs
    opponents.forEach(npc => {
        this.npcs[npc.id] = npc;
    });

    const conflict = await this.combatManager.startConflict(
      this.currentScene,
      'social',
      opponents,
      this.player
    );
    
    console.log(`Social Conflict started! ID: ${conflict.id}`);
    return conflict;
  }

  private async processCombatTurn(playerAction: string) {
    if (!this.currentScene?.conflict || !this.player) throw new Error("Invalid combat state");
    const conflict = this.currentScene.conflict;

    // 1. Player Turn
    // Verify it's player's turn
    const currentActorId = conflict.turnOrder[conflict.currentTurnIndex];
    if (currentActorId !== this.player.id) {
        // It's not player's turn. This shouldn't happen if we loop correctly, 
        // but if it does, we should probably just process NPC turns until it IS player's turn.
        // For now, assume we are in sync.
    }

    // Process Player Action (similar to normal turn but with combat context)
    const characterDefinition = this.getCharacterDefinition();
    const worldState = this.worldManager.state;

    // Classify Action
    const fateAction = await this.decisionEngine.classifyAction(playerAction, {
        action: playerAction,
        player: characterDefinition,
        worldState,
        history: this.history
    });

    // Select Skill
    const skillSelection = await this.decisionEngine.selectSkill({
        action: { type: fateAction, description: playerAction },
        player: characterDefinition,
        worldState,
        history: this.history
    });

    // Set Opposition
    const opposition = await this.decisionEngine.setOpposition({
        action: { type: fateAction, description: playerAction, skill: skillSelection.name },
        player: characterDefinition,
        worldState,
        history: this.history
    });

    // Roll Dice
    const roll = this.fateDice.roll();
    console.log(`DEBUG: Roll=${roll.total}, Skill=${skillSelection.name}:${skillSelection.rating}, Opp=${opposition}`);
    const resolution = ActionResolver.resolve(roll, skillSelection.rating, opposition);
    console.log(`DEBUG: Resolution=${JSON.stringify(resolution)}`);

    // Generate Event
    const turn = this.turnManager.startTurn("player", this.currentScene.id, { day: 1, timeOfDay: 'morning', timestamp: Date.now() });
    this.turnManager.addEvent('skill_check', fateAction, {
        description: `Player attempted to ${playerAction} using ${skillSelection.name}. Outcome: ${resolution.outcome}`,
        roll,
        difficulty: opposition,
        shifts: resolution.shifts
    });

    // Apply Consequences
    await this.applyActionConsequences(fateAction, resolution, turn);

    // Narrate Player Action
    let narration = await this.narrativeEngine.narrate({
        events: turn.events,
        player: characterDefinition,
        worldState,
        history: this.history
    });

    // Save Player Turn
    await this.sessionWriter.writeTurn(this.sessionId, turn);
    this.history.push(turn);

    // Advance Turn
    let nextActorId = this.combatManager.nextTurn(conflict);

    // Loop NPC Turns
    while (nextActorId !== this.player.id && !conflict.isResolved) {
        const npc = this.npcs[nextActorId];
        if (npc) {
            const npcTurn = this.turnManager.startTurn(npc.name, this.currentScene.id, { day: 1, timeOfDay: 'morning', timestamp: Date.now() });
            
            // Decide NPC Action
            const decision = await this.decisionEngine.decideNPCAction(npc, {
                action: null,
                player: characterDefinition,
                worldState,
                history: this.history
            });

            // Resolve NPC Action
            // Simplified: Assume NPC uses their best skill for the action or Mediocre
            // We need to map action string to skill.
            // For now, just give them a flat rating or look up a skill if we can guess it.
            const npcSkillRating = 2; // Fair default
            const npcOpposition = 2; // Fair defense by player (simplified)
            
            const npcRoll = this.fateDice.roll();
            const npcResolution = ActionResolver.resolve(npcRoll, npcSkillRating, npcOpposition);

            this.turnManager.addEvent('skill_check', decision.action, {
                description: `${npc.name} ${decision.description}. Outcome: ${npcResolution.outcome}`,
                roll: npcRoll,
                difficulty: npcOpposition,
                shifts: npcResolution.shifts
            });

            // Narrate NPC Action
            const npcNarration = await this.narrativeEngine.narrate({
                events: npcTurn.events,
                player: characterDefinition,
                worldState,
                history: this.history
            });
            
            narration += `\n\n${npcNarration}`;
            
            await this.sessionWriter.writeTurn(this.sessionId, npcTurn);
            this.history.push(npcTurn);
        }

        nextActorId = this.combatManager.nextTurn(conflict);
        
        // Check Resolution (simplified)
        if (this.combatManager.checkResolution(conflict, [], this.player)) {
            narration += `\n\nCombat Ended: ${conflict.resolution}`;
            break;
        }
    }

    await this.saveState();

    return {
        turn,
        narration,
        result: resolution.outcome
    };
  }

  private applyQuestUpdate(update: any, turn: Turn) {
    if (!update) return;

    const worldState = this.worldManager.state;

    if (update.type === 'new' && update.quest) {
      QuestManager.addQuest(worldState, update.quest);
      this.turnManager.addEvent('quest_update', 'new_quest', {
        description: `New Quest: ${update.quest.title}`,
        metadata: update.quest
      });
      
      this.deltaCollector.collect({
        target: 'world',
        operation: 'append',
        path: ['quests'],
        previousValue: null,
        newValue: update.quest,
        cause: 'quest_start',
        eventId: turn.events[turn.events.length - 1]?.eventId || 'unknown'
      });
    } else if (update.type === 'update_objective') {
      const quest = QuestManager.getQuest(worldState, update.questId);
      if (quest) {
        const objective = quest.objectives.find(o => o.id === update.objectiveId);
        if (objective) {
            const newCount = objective.currentCount + (update.count || 0);
            QuestManager.updateObjective(worldState, update.questId, update.objectiveId, newCount);
            
            if (update.status) {
                QuestManager.setObjectiveStatus(worldState, update.questId, update.objectiveId, update.status);
            }

            this.turnManager.addEvent('quest_update', 'objective_update', {
                description: `Quest Update: ${quest.title} - ${objective.description}`,
                metadata: { questId: update.questId, objectiveId: update.objectiveId, status: objective.status }
            });
        }
      }
    } else if (update.type === 'complete_quest') {
        QuestManager.setQuestStatus(worldState, update.questId, 'completed');
        this.turnManager.addEvent('quest_update', 'quest_completed', {
            description: `Quest Completed: ${update.questId}`,
            metadata: { questId: update.questId }
        });
    } else if (update.type === 'fail_quest') {
        QuestManager.setQuestStatus(worldState, update.questId, 'failed');
        this.turnManager.addEvent('quest_update', 'quest_failed', {
            description: `Quest Failed: ${update.questId}`,
            metadata: { questId: update.questId }
        });
    }
  }

  private applyKnowledgeUpdate(update: any, turn: Turn) {
    if (!this.player) return;

    const { category, id, data } = update;
    // Extract numeric turn ID if possible, otherwise use timestamp
    const turnNum = typeof turn.turnId === 'number' ? turn.turnId : Date.now();

    // Update Knowledge using KnowledgeManager
    switch (category) {
        case 'locations':
            KnowledgeManager.updateLocation(this.player.knowledge, id, data, turnNum);
            break;
        case 'npcs':
            KnowledgeManager.updateNPC(this.player.knowledge, id, data, turnNum);
            break;
        case 'quests':
            KnowledgeManager.updateQuest(this.player.knowledge, id, data, turnNum);
            break;
        case 'factions':
            KnowledgeManager.updateFaction(this.player.knowledge, id, data, turnNum);
            break;
        case 'secrets':
            KnowledgeManager.updateSecret(this.player.knowledge, id, data, turnNum);
            break;
        case 'items':
            KnowledgeManager.updateItem(this.player.knowledge, id, data, turnNum);
            break;
        case 'topics':
            KnowledgeManager.updateTopic(this.player.knowledge, id, data, turnNum);
            break;
    }

    // Log Event
    this.turnManager.addEvent('knowledge_gain', category, {
        description: `Learned about ${data.name || id}`,
        metadata: {
            id,
            category,
            details: data
        }
    });

    // Collect Delta
    // We need to cast to any to access the dynamic property safely for the delta path
    const knowledgeCategory = (this.player.knowledge as any)[category];
    
    this.deltaCollector.collect({
        target: 'player',
        operation: 'set',
        path: ['knowledge', category, id],
        previousValue: null, // Ideally we'd capture this before update
        newValue: knowledgeCategory[id],
        cause: 'knowledge_gain',
        eventId: turn.events[turn.events.length - 1].eventId
    });
  }

  private async handleMetaCommand(command: string) {
    const [cmd, ...args] = command.slice(1).split(' ');
    
    switch (cmd.toLowerCase()) {
        case 'save':
            await this.saveState();
            return { 
                turn: null,
                narration: "Game saved successfully.", 
                result: "meta_command_success" 
            };
        
        case 'load':
            await this.loadState();
            return { 
                turn: null,
                narration: "Game loaded from last save.", 
                result: "meta_command_success" 
            };

        case 'inventory':
        case 'inv':
            if (!this.player) return { turn: null, narration: "No character found.", result: "error" };
            const items = this.player.inventory.map(i => `- ${i.name}: ${i.description || ''}`).join('\n');
            return { 
                turn: null,
                narration: items.length > 0 ? `**Inventory:**\n${items}` : "Your inventory is empty.", 
                result: "meta_command_success" 
            };

        case 'status':
        case 'stats':
            if (!this.player) return { turn: null, narration: "No character found.", result: "error" };
            const aspects = this.player.aspects.map(a => `- ${a.name} (${a.type})`).join('\n');
            const skills = this.player.skills.map(s => `- ${s.name}: +${s.rank}`).join('\n');
            const fp = this.player.fatePoints.current;
            return {
                turn: null,
                narration: `**${this.player.name}**\n\n**Fate Points:** ${fp}\n\n**Aspects:**\n${aspects}\n\n**Skills:**\n${skills}`,
                result: "meta_command_success"
            };

        case 'help':
            return {
                turn: null,
                narration: `**Available Commands:**\n- /save: Save the game\n- /load: Load the last save\n- /inventory: Show inventory\n- /status: Show character sheet\n- /help: Show this message\n- exit: Quit the game`,
                result: "meta_command_success"
            };

        default:
            return { turn: null, narration: `Unknown command: ${cmd}`, result: "error" };
    }
  }
}
