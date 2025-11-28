import { v4 as uuidv4 } from 'uuid';
import { TurnManager, DeltaCollector, ActionResolver, FateDice, GameTime, CharacterDefinition, Turn, FateOutcome, KnowledgeManager, QuestManager, FactionManager, EconomyManager, CraftingManager, AdvancementManager } from '@llmrpg/core';
import { LLMProvider } from '@llmrpg/llm';
import { SessionWriter, SessionLoader } from '@llmrpg/storage';
import { SceneState, PlayerCharacter, KnowledgeProfile, Compel } from '@llmrpg/protocol';
import { NarrativeEngine } from './systems/NarrativeEngine';
import { ContentGenerator } from './systems/ContentGenerator';
import { DecisionEngine } from './systems/DecisionEngine';
import { WorldManager } from './systems/WorldManager';
import { CombatManager } from './systems/CombatManager';
import { DialogueSystem } from './systems/DialogueSystem';
import { WorldEventsManager } from './systems/WorldEventsManager';

export interface GameMasterConfig {
  /** Maximum number of turns to keep in context history (default: 10) */
  maxHistoryTurns?: number;
  /** Enable automatic context pruning based on estimated token count (default: false) */
  enableSmartPruning?: boolean;
  /** Maximum estimated tokens for context (default: 4000) */
  maxContextTokens?: number;
}

export class GameMaster {
  private turnManager: TurnManager;
  private deltaCollector: DeltaCollector;
  private actionResolver: ActionResolver;
  private narrativeEngine: NarrativeEngine;
  private contentGenerator: ContentGenerator;
  private decisionEngine: DecisionEngine;
  private worldManager: WorldManager;
  private factionManager: FactionManager;
  private economyManager: EconomyManager;
  private craftingManager: CraftingManager;
  private combatManager: CombatManager;
  private dialogueSystem: DialogueSystem;
  private worldEventsManager: WorldEventsManager;
  private sessionWriter: SessionWriter;
  private sessionLoader: SessionLoader | undefined;
  private currentScene: SceneState | undefined;
  private player: PlayerCharacter | undefined;
  private npcs: Record<string, CharacterDefinition> = {};
  private history: Turn[] = [];
  private config: GameMasterConfig;
  private consecutiveFailures: number = 0;

  private fateDice: FateDice;

  constructor(
    private sessionId: string,
    llmProvider: LLMProvider,
    sessionWriter: SessionWriter,
    sessionLoader?: SessionLoader,
    config?: GameMasterConfig
  ) {
    this.config = {
      maxHistoryTurns: config?.maxHistoryTurns ?? 10,
      enableSmartPruning: config?.enableSmartPruning ?? false,
      maxContextTokens: config?.maxContextTokens ?? 4000
    };
    this.turnManager = new TurnManager(sessionId);
    this.deltaCollector = new DeltaCollector(sessionId, 0);
    this.actionResolver = new ActionResolver();
    this.fateDice = new FateDice(Date.now());
    this.sessionWriter = sessionWriter;
    this.sessionLoader = sessionLoader;

    this.worldManager = new WorldManager();
    this.factionManager = new FactionManager(this.worldManager.state);
    this.economyManager = new EconomyManager();
    this.craftingManager = new CraftingManager(this.actionResolver, this.fateDice);
    this.narrativeEngine = new NarrativeEngine(llmProvider);
    this.contentGenerator = new ContentGenerator(llmProvider);
    this.decisionEngine = new DecisionEngine(llmProvider);
    this.dialogueSystem = new DialogueSystem(llmProvider);
    this.worldEventsManager = new WorldEventsManager(this.deltaCollector);
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
    
    // Set initial time (numeric string for proper increment)
    this.worldManager.setTime("0", "Day 1, morning");

    // Generate Scenario
    console.log("Generating starting scenario...");
    const scenario = await this.contentGenerator.generateStartingScenario(theme, startingLocation);

    // Generate World Events
    console.log("Generating world events...");
    const worldEvents = await this.contentGenerator.generateWorldEvents(theme, startingLocation);
    this.worldManager.state.events = worldEvents.map((event: any) => ({
      id: uuidv4(),
      name: event.name,
      description: event.description,
      trigger: event.trigger,
      effects: event.effects,
      active: true,
      triggered: false
    }));

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
        aspects: charData.aspects.map((a: any) => {
            // Map the aspect type from LLM format to Fate Core format
            let aspectType = 'background';
            if (a.type === 'highConcept' || a.type === 'high_concept') {
                aspectType = 'high_concept';
            } else if (a.type === 'trouble') {
                aspectType = 'trouble';
            } else if (a.type === 'relationship') {
                aspectType = 'relationship';
            }
            return {
                id: `asp-${Math.random().toString(36).substr(2, 9)}`,
                name: a.name,
                type: aspectType,
                freeInvokes: 0,
                description: a.description || undefined
            };
        }),
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
        fatePoints: { 
            current: Math.max(1, 3 - Math.max(0, charData.stunts.length - 3)), 
            refresh: Math.max(1, 3 - Math.max(0, charData.stunts.length - 3)) 
        }, 
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
        wealth: 100,
        inventory: [],
        milestones: { minor: 0, significant: 0, major: 0 },
        completedQuestIds: [],
        appliedRewardQuestIds: []
    };

    console.log(`Character created: ${this.player?.name || 'Unknown'}`);
    const highConcept = this.player?.aspects.find(a => a.name === charData.aspects.find((ca: any) => ca.type === 'highConcept')?.name)?.name;
    console.log(`High Concept: ${highConcept || 'Unknown'}`);
    
    await this.saveState();
    
    return this.player;
  }

  // Economy Methods
  
  getPlayerWealth(): number {
    return this.player?.wealth || 0;
  }

  addPlayerWealth(amount: number) {
    if (this.player) {
      this.economyManager.addWealth(this.player, amount);
      console.log(`Added ${amount} wealth. Total: ${this.player.wealth}`);
    }
  }

  removePlayerWealth(amount: number): boolean {
    if (this.player) {
      const success = this.economyManager.removeWealth(this.player, amount);
      if (success) {
        console.log(`Removed ${amount} wealth. Total: ${this.player.wealth}`);
      } else {
        console.log(`Not enough wealth. Current: ${this.player.wealth}`);
      }
      return success;
    }
    return false;
  }

  /**
   * Refresh Fate Points at the start of a new session (Fate Core rule)
   */
  refreshFatePoints(): void {
    if (this.player) {
      const oldFP = this.player.fatePoints.current;
      const refresh = this.player.fatePoints.refresh;
      
      // Fate Core: Reset to Refresh level. If current > refresh, keep current.
      if (oldFP < refresh) {
          this.player.fatePoints.current = refresh;
          
          console.log(`Fate Points refreshed from ${oldFP} to ${this.player.fatePoints.current}`);
          
          // Log event
          this.turnManager.addEvent('fate_point_refresh', 'session_start', {
            description: `Fate Points refreshed to ${this.player.fatePoints.current}`,
            metadata: { oldAmount: oldFP, newAmount: this.player.fatePoints.current }
          });
          
          // Record delta
          this.deltaCollector.collect({
            target: 'player',
            operation: 'set',
            path: ['fatePoints', 'current'],
            previousValue: oldFP,
            newValue: this.player.fatePoints.current,
            cause: 'session_refresh',
            eventId: 'session-start'
          });
      } else {
          console.log(`Current FP (${oldFP}) >= Refresh (${refresh}). No change.`);
      }
    }
  }

  /**
   * Award Fate Points to player (for compels, concessions, GM awards)
   */
  awardFatePoints(amount: number, reason: string): void {
    if (this.player && amount > 0) {
      const oldFP = this.player.fatePoints.current;
      this.player.fatePoints.current += amount;
      
      console.log(`Awarded ${amount} Fate Points for: ${reason}. Total: ${this.player.fatePoints.current}`);
      
      // Log event
      this.turnManager.addEvent('fate_point_award', 'gm_award', {
        description: `Awarded ${amount} Fate Points: ${reason}`,
        metadata: { amount, reason, newTotal: this.player.fatePoints.current }
      });
      
      // Record delta
      this.deltaCollector.collect({
        target: 'player',
        operation: 'increment',
        path: ['fatePoints', 'current'],
        previousValue: oldFP,
        newValue: this.player.fatePoints.current,
        cause: 'fate_point_award',
        eventId: 'gm-award'
      });
    }
  }

  /**
   * Spend Fate Points (for invocations, declarations)
   */
  spendFatePoints(amount: number, reason: string): boolean {
    if (this.player && this.player.fatePoints.current >= amount) {
      const oldFP = this.player.fatePoints.current;
      this.player.fatePoints.current -= amount;
      
      console.log(`Spent ${amount} Fate Points for: ${reason}. Remaining: ${this.player.fatePoints.current}`);
      
      // Log event
      this.turnManager.addEvent('fate_point_spend', 'player_action', {
        description: `Spent ${amount} Fate Points: ${reason}`,
        metadata: { amount, reason, remaining: this.player.fatePoints.current }
      });
      
      // Record delta
      this.deltaCollector.collect({
        target: 'player',
        operation: 'decrement',
        path: ['fatePoints', 'current'],
        previousValue: oldFP,
        newValue: this.player.fatePoints.current,
        cause: 'fate_point_spend',
        eventId: 'player-spend'
      });
      
      return true;
    }
    return false;
  }

  /**
   * Check if a compel should be triggered based on the player's action and context
   */
  async checkCompels(playerAction: string): Promise<Compel | null> {
    if (!this.player) return null;

    // We don't want to spam compels, so we could add a random check or cooldown here.
    // For now, we'll rely on the DecisionEngine to be judicious (or just check every time for testing).
    
    const context = {
        action: { description: playerAction },
        player: this.getCharacterDefinition(),
        worldState: this.worldManager.state,
        history: this.history
    };

    const compelData = await this.decisionEngine.generateCompel(context);
    
    if (compelData) {
        return {
            id: uuidv4(),
            aspectId: this.player.aspects.find(a => a.name === compelData.aspectName)?.id || 'unknown',
            aspectName: compelData.aspectName,
            type: compelData.type,
            description: compelData.description,
            status: 'offered',
            turnId: 'pending',
            source: 'gm'
        };
    }
    
    return null;
  }

  /**
   * Resolve a player's decision to accept or refuse a compel
   */
  async resolveCompel(compel: Compel, accepted: boolean): Promise<{ narration: string; result: string }> {
    if (!this.player) return { narration: "Error: No player found.", result: "error" };

    if (accepted) {
        this.awardFatePoints(1, `Accepted compel on ${compel.aspectName}`);
        compel.status = 'accepted';
        
        // Log the compel event
        this.turnManager.addEvent('fate_compel', 'accept', {
            description: `Compel Accepted: ${compel.description}`,
            metadata: compel
        });
        
        return {
            narration: `You accept the complication. ${compel.description}`,
            result: 'compel_accepted'
        };
    } else {
        if (this.player.fatePoints.current > 0) {
            this.spendFatePoints(1, `Refused compel on ${compel.aspectName}`);
            compel.status = 'refused';
            
            this.turnManager.addEvent('fate_compel', 'refuse', {
                description: `Compel Refused: ${compel.description}`,
                metadata: compel
            });
            
            return {
                narration: `You grit your teeth and push through, refusing to let your nature get the better of you.`,
                result: 'compel_refused'
            };
        } else {
            // Cannot refuse if no FP
            return {
                narration: `You don't have enough Fate Points to refuse this compel! You must accept it. ${compel.description}`,
                result: 'compel_forced'
            };
        }
    }
  }

  /**
   * Generate a proactive compel offer when the player has failed multiple times.
   * This gives them an opportunity to gain a Fate Point and break out of a failure spiral.
   */
  async generateProactiveCompel(): Promise<Compel | null> {
    if (!this.player || this.consecutiveFailures < 2) {
      return null;
    }

    // Find the player's trouble aspect
    const troubleAspect = this.player.aspects.find(a => a.type === 'trouble');
    if (!troubleAspect) {
      return null;
    }

    // Generate a compelling scenario based on recent failures and the trouble aspect
    const recentFailures = this.history.slice(-3).map(t => t.narration || 'Unknown action').join('\n');
    
    try {
      const compelDescription = await this.decisionEngine.generateProactiveCompelDescription(
        troubleAspect.name,
        recentFailures,
        this.currentScene?.description || ''
      );

      if (!compelDescription) {
        return null;
      }

      return {
        id: uuidv4(),
        aspectId: troubleAspect.id,
        aspectName: troubleAspect.name,
        type: 'decision', // Trouble aspects typically force decisions
        description: compelDescription,
        status: 'offered',
        turnId: 'pending',
        source: 'gm'
      };
    } catch (error) {
      console.error("Failed to generate proactive compel:", error);
      return null;
    }
  }

  /**
   * Get the current consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  async movePlayer(targetZoneName: string) {
    if (!this.currentScene || !this.player) {
      console.log("No active scene or player.");
      return;
    }

    if (!this.currentScene.zones) {
      console.log("This scene has no zones.");
      return;
    }

    const targetZone = this.currentScene.zones.zones.find(z => z.name.toLowerCase() === targetZoneName.toLowerCase());
    if (!targetZone) {
      console.log(`Zone '${targetZoneName}' not found.`);
      return;
    }

    const result = this.combatManager.moveCharacter(this.currentScene, this.player.id, targetZone.id);
    console.log(result.message);
    
    if (result.success) {
        // Log event
        this.turnManager.addEvent(
            'move',
            'move_zone',
            {
                description: `Player moved to ${targetZone.name}`,
                metadata: { to: targetZone.name }
            }
        );
    }
  }

  getWorldState() {
    return this.worldManager.state;
  }

  private findNPCByName(name: string): CharacterDefinition | undefined {
    // BUG-004/005 Fix: Only return NPCs that are present at the current location
    // This prevents "ghost NPC" interactions with non-existent characters
    if (this.currentScene) {
        const location = this.worldManager.getLocation(this.currentScene.locationId);
        if (location && location.presentNPCs && location.presentNPCs.length > 0) {
            for (const npcId of location.presentNPCs) {
                const npc = this.npcs[npcId];
                if (npc && npc.name.toLowerCase().includes(name.toLowerCase())) {
                    return npc;
                }
            }
        }
    }
    // Do NOT fall back to all known NPCs - if no one is present, return undefined
    // This forces the narrative to acknowledge the absence of NPCs
    return undefined;
  }

  async processPlayerAction(playerAction: string, playerReasoning?: string, skipCompelCheck: boolean = false) {
    // Check for Meta Commands
    if (playerAction.startsWith('/')) {
        return this.handleMetaCommand(playerAction);
    }

    // Classify Intent EARLY to catch Concede and other meta-actions
    const intent = await this.decisionEngine.classifyIntent(playerAction);

    // Handle Concession immediately (bypassing combat loop)
    if (intent === 'concede' && this.player) {
        const gameTime: GameTime = { day: 1, timeOfDay: 'morning', timestamp: Date.now() };
        const sceneId = this.currentScene?.id || "scene-unknown";
        const turn = this.turnManager.startTurn("player", sceneId, gameTime);
        this.deltaCollector = new DeltaCollector(this.sessionId, turn.turnId);
        return this.processConcession(turn);
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

    if (intent === 'trade' && this.player) {
        return this.processTradeTurn(playerAction, turn);
    } else if (intent === 'craft' && this.player) {
        return this.processCraftTurn(playerAction, turn);
    } else if (intent === 'advance' && this.player) {
        return this.processAdvancement(playerAction, turn);
    } else if (intent === 'inventory' && this.player) {
        return this.processInventoryTurn(turn);
    } else if (intent === 'status' && this.player) {
        return this.processStatusTurn(turn);
    } else if (intent === 'self_compel' && this.player) {
        return this.processSelfCompel(playerAction, turn);
    } else if (intent === 'declaration' && this.player) {
        return this.processDeclaration(playerAction, turn);
    } else if ((intent as string) === 'teamwork' && this.player) {
        return this.processTeamwork(playerAction, turn);
    } else if (intent === 'travel' && this.player) {
        return this.processTravelTurn(playerAction, turn);
    } else if (intent === 'dialogue' && this.player) {
        return this.processDialogueTurn(playerAction, turn);
    }

    return this.processFateAction(playerAction, turn, playerReasoning, skipCompelCheck);
  }

  private async processTeamwork(playerAction: string, turn: Turn) {
    if (!this.player) throw new Error("No player");

    // 1. Parse Teamwork Details
    const presentNPCs = this.currentScene ? 
        (this.worldManager.getLocation(this.currentScene.locationId)?.presentNPCs || [])
        .map(id => this.npcs[id])
        .filter(n => n !== undefined) as CharacterDefinition[] 
        : [];

    const teamworkData = await this.decisionEngine.parseTeamwork(playerAction, presentNPCs);
    
    if (!teamworkData) {
        const narration = "The GM is unsure who you are trying to help. Please be more specific.";
        this.turnManager.addEvent('system', 'teamwork_failed', { description: narration });
        return this.finalizeTurn(turn, narration, "failure");
    }

    const targetNPC = presentNPCs.find(n => n.name.toLowerCase().includes(teamworkData.targetName.toLowerCase()));
    if (!targetNPC) {
        const narration = `You try to help ${teamworkData.targetName}, but they are not here.`;
        this.turnManager.addEvent('system', 'teamwork_failed', { description: narration });
        return this.finalizeTurn(turn, narration, "failure");
    }

    // 2. Select Skill for Player (How are they helping?)
    const skillSelection = await this.decisionEngine.selectSkill({
        action: { type: 'teamwork', description: teamworkData.description },
        player: this.getCharacterDefinition(),
        worldState: this.worldManager.state,
        history: this.history
    });

    // 3. Roll vs Difficulty 2 (Standard Help)
    const difficulty = 2;
    const roll = this.fateDice.roll();
    const resolution = ActionResolver.resolve(roll, skillSelection.rating, difficulty);

    this.turnManager.addEvent('skill_check', 'teamwork', {
        description: `Player helped ${targetNPC.name} using ${skillSelection.name}. Outcome: ${resolution.outcome}`,
        roll,
        difficulty,
        shifts: resolution.shifts
    });

    let narration = "";
    let result = resolution.outcome;

    if (resolution.outcome === 'success' || resolution.outcome === 'success_with_style') {
        // Success: Create a situational aspect on the NPC with free invokes
        const bonus = resolution.outcome === 'success_with_style' ? 2 : 1; // Free invokes
        
        const aspectName = `Assisted by ${this.player.name}`;
        const newAspect: any = {
            id: uuidv4(),
            name: aspectName,
            type: 'situational',
            freeInvokes: bonus,
            description: `The player is helping ${targetNPC.name}: ${teamworkData.description}`
        };

        if (this.currentScene) {
            const location = this.worldManager.getLocation(this.currentScene.locationId);
            if (location) {
                location.aspects.push(newAspect);
                
                this.turnManager.addEvent('state_change', 'teamwork_bonus', {
                    description: `Created advantage for ${targetNPC.name}: ${aspectName} (${bonus} free invokes)`,
                    metadata: { aspect: newAspect, target: targetNPC.name }
                });
                
                this.deltaCollector.collect({
                    target: 'world',
                    operation: 'append',
                    path: ['locations', location.id, 'aspects'],
                    newValue: newAspect,
                    previousValue: null,
                    cause: 'teamwork',
                    eventId: turn.events[turn.events.length - 1].eventId
                });
                
                narration = `You successfully help ${targetNPC.name}! You create the advantage '${aspectName}' with ${bonus} free invokes.`;
            }
        }
    } else {
        narration = `You try to help ${targetNPC.name}, but you get in the way or fail to make a difference.`;
    }

    return this.finalizeTurn(turn, narration, result);
  }

  private async processConcession(turn: Turn) {
      if (!this.currentScene?.conflict || this.currentScene.conflict.isResolved) {
          const narration = "You can only concede during an active conflict.";
          this.turnManager.addEvent('system', 'concession_failed', { description: narration });
          return this.finalizeTurn(turn, narration, "failure");
      }
      
      // Calculate FP
      // 1 FP base + 1 per consequence taken (simplified: all current consequences)
      const consequences = this.player?.consequences.length || 0;
      const award = 1 + consequences;
      
      this.awardFatePoints(award, "Concession");
      
      // End Conflict
      this.combatManager.endConflict(this.currentScene.conflict, 'opposition', 'Player conceded');
      
      const narration = "You concede the conflict, escaping with your life but leaving the victory to your enemies.";
      
      this.turnManager.addEvent('state_change', 'concession', {
          description: narration,
          metadata: { fpAwarded: award }
      });
      
      return this.finalizeTurn(turn, narration, "conceded");
  }

  /**
   * Process a player's travel intent - moving to a new location via an exit
   */
  private async processTravelTurn(playerAction: string, turn: Turn) {
    if (!this.player) throw new Error("No player");
    
    const currentLocation = this.currentScene 
      ? this.worldManager.getLocation(this.currentScene.locationId) 
      : undefined;

    if (!currentLocation) {
      const narration = "You look around but can't determine where you are.";
      this.turnManager.addEvent('system', 'travel_failed', { description: narration });
      return this.finalizeTurn(turn, narration, "failure");
    }

    // Get available exits from current location
    const availableExits = (currentLocation.connections || [])
      .filter(c => !c.isBlocked)
      .map(c => ({
        direction: c.direction || 'passage',
        description: c.description || 'an exit',
        targetId: c.targetId
      }));

    if (availableExits.length === 0) {
      const narration = "There are no obvious exits from this location. Perhaps you could search for hidden passages.";
      this.turnManager.addEvent('system', 'travel_failed', { description: narration });
      return this.finalizeTurn(turn, narration, "failure");
    }

    // Parse the travel intent to determine direction
    const travelData = await this.decisionEngine.parseTravel(playerAction, availableExits);

    if (!travelData) {
      const exitsDesc = availableExits.map(e => `${e.direction} (${e.description})`).join(', ');
      const narration = `You're not sure where to go. Available exits: ${exitsDesc}`;
      this.turnManager.addEvent('system', 'travel_clarification', { 
        description: narration,
        metadata: { availableExits }
      });
      return this.finalizeTurn(turn, narration, "tie");
    }

    // Execute the travel
    const result = await this.travelToLocation(travelData.targetId);

    if (result.success && result.newLocation) {
      this.turnManager.addEvent('move', 'location_change', {
        description: `Traveled ${travelData.direction} to ${result.newLocation.name}`,
        metadata: {
          fromLocation: currentLocation.id,
          toLocation: result.newLocation.id,
          direction: travelData.direction
        }
      });
      return this.finalizeTurn(turn, result.narration || "You travel to a new location.", "success");
    } else {
      this.turnManager.addEvent('system', 'travel_failed', { 
        description: result.narration || "You couldn't travel that way."
      });
      return this.finalizeTurn(turn, result.narration || "You couldn't travel that way.", "failure");
    }
  }

  /**
   * Process a player's dialogue intent - talking to NPCs
   */
  private async processDialogueTurn(playerAction: string, turn: Turn) {
    if (!this.player) throw new Error("No player");

    // Get NPCs present at current location
    const presentNPCs = this.currentScene ? 
      (this.worldManager.getLocation(this.currentScene.locationId)?.presentNPCs || [])
        .map(id => this.npcs[id])
        .filter(n => n !== undefined) as CharacterDefinition[]
      : [];

    // Parse the dialogue intent
    const dialogueData = await this.decisionEngine.parseDialogue(playerAction, presentNPCs);

    if (!dialogueData) {
      const narration = presentNPCs.length === 0
        ? "There's no one here to talk to."
        : `You look around, but aren't sure who to address. Present: ${presentNPCs.map(n => n.name).join(', ')}`;
      this.turnManager.addEvent('system', 'dialogue_failed', { description: narration });
      return this.finalizeTurn(turn, narration, "failure");
    }

    // Find the target NPC
    const targetNPC = presentNPCs.find(n => 
      n.name.toLowerCase().includes(dialogueData.targetName.toLowerCase()) ||
      dialogueData.targetName.toLowerCase().includes(n.name.toLowerCase())
    );

    if (!targetNPC) {
      // NPC mentioned but not present - give narrative response
      const narration = `You try to address ${dialogueData.targetName}, but they're not here right now.`;
      this.turnManager.addEvent('system', 'dialogue_failed', { 
        description: narration,
        metadata: { targetName: dialogueData.targetName }
      });
      return this.finalizeTurn(turn, narration, "failure");
    }

    // Get player's relationship with this NPC (if any)
    const relationship = this.player.relationships?.find(
      r => r.targetId === targetNPC.id
    );

    // Get faction reputation if applicable
    const playerWithFaction = this.player as any;
    const factionReputation = playerWithFaction.factionStanding ? 
      Object.values(playerWithFaction.factionStanding as Record<string, { factionId: string; reputation: number }>).map(fs => ({
        factionName: fs.factionId, // Would need faction lookup for proper name
        reputation: fs.reputation,
        rank: this.getFactionRank(fs.reputation)
      })) : undefined;

    // Generate NPC dialogue through DialogueSystem
    try {
      const npcResponse = await this.dialogueSystem.generateDialogue(
        playerAction,
        {
          npc: targetNPC,
          player: this.getCharacterDefinition()!,
          history: this.history.slice(-5), // Recent history for context
          relationship: relationship,
          topic: dialogueData.topic,
          factionReputation
        }
      );

      // Log the dialogue event
      this.turnManager.addEvent('dialogue', dialogueData.dialogueType, {
        description: `${this.player.name} speaks with ${targetNPC.name} about ${dialogueData.topic}`,
        metadata: {
          targetNPC: targetNPC.name,
          topic: dialogueData.topic,
          dialogueType: dialogueData.dialogueType,
          npcResponse: npcResponse
        }
      });

      // Build the narration including the NPC response
      const narration = `${targetNPC.name} responds: "${npcResponse}"`;

      return this.finalizeTurn(turn, narration, "success");
    } catch (error) {
      console.error("Dialogue failed:", error);
      const narration = `${targetNPC.name} seems distracted and doesn't respond meaningfully.`;
      return this.finalizeTurn(turn, narration, "failure");
    }
  }

  /**
   * Convert reputation number to rank string
   */
  private getFactionRank(reputation: number): string {
    if (reputation >= 50) return 'Exalted';
    if (reputation >= 30) return 'Honored';
    if (reputation >= 10) return 'Friendly';
    if (reputation >= -10) return 'Neutral';
    if (reputation >= -30) return 'Unfriendly';
    if (reputation >= -50) return 'Hostile';
    return 'Hated';
  }

  private async processSelfCompel(playerAction: string, turn: Turn) {
    if (!this.player) throw new Error("No player");

    const compelData = await this.decisionEngine.parseSelfCompel(playerAction, this.getCharacterDefinition()!);
    
    if (!compelData) {
        const narration = "The GM is confused by your request. Please be more specific about which aspect you are compelling and why.";
        this.turnManager.addEvent('system', 'compel_failed', { description: narration });
        return this.finalizeTurn(turn, narration, "failure");
    }

    // Validate aspect exists
    // Try exact match first, then partial match
    let aspect = this.player.aspects.find(a => a.name.toLowerCase() === compelData.aspectName.toLowerCase());
    if (!aspect) {
        aspect = this.player.aspects.find(a => a.name.toLowerCase().includes(compelData.aspectName.toLowerCase()));
    }

    if (!aspect) {
         const narration = `You try to compel '${compelData.aspectName}', but that is not one of your aspects.`;
         this.turnManager.addEvent('system', 'compel_failed', { description: narration });
         return this.finalizeTurn(turn, narration, "failure");
    }

    // Accept the self-compel
    this.awardFatePoints(1, `Self-compel on ${aspect.name}`);
    
    const compel: Compel = {
        id: uuidv4(),
        aspectId: aspect.id,
        aspectName: aspect.name,
        type: 'decision', 
        description: compelData.description,
        status: 'accepted',
        turnId: turn.turnId,
        source: 'player'
    };

    this.turnManager.addEvent('fate_compel', 'self_compel', {
        description: `Self-Compel Accepted: ${compel.description}`,
        metadata: compel
    });

    const narration = `You give in to your nature. ${compel.description} (Gain 1 Fate Point)`;
    
    return this.finalizeTurn(turn, narration, "success");
  }

  private async processDeclaration(playerAction: string, turn: Turn) {
    if (!this.player) throw new Error("No player");

    // 1. Check Fate Points
    if (this.player.fatePoints.current < 1) {
        const narration = "You don't have enough Fate Points to make a declaration.";
        this.turnManager.addEvent('system', 'declaration_failed', { description: narration });
        return this.finalizeTurn(turn, narration, "failure");
    }

    // 2. Parse Declaration
    const declarationData = await this.decisionEngine.parseDeclaration(playerAction);
    
    if (!declarationData) {
        const narration = "The GM is unsure what fact you are trying to declare. Please be more specific.";
        this.turnManager.addEvent('system', 'declaration_failed', { description: narration });
        return this.finalizeTurn(turn, narration, "failure");
    }

    // 3. Spend Fate Point
    this.spendFatePoints(1, `Story Declaration: ${declarationData}`);

    // 4. Apply Declaration (Add Aspect or Modify World)
    // For simplicity, we'll add a situational aspect to the scene or location
    if (this.currentScene) {
        const location = this.worldManager.getLocation(this.currentScene.locationId);
        if (location) {
            const newAspect: any = {
                id: uuidv4(),
                name: declarationData, // Use provided name or the fact itself
                type: 'situational',
                freeInvokes: 0, // Declarations don't give free invokes usually, just establish truth
                description: `Declared by player: ${declarationData}`
            };
            
            location.aspects.push(newAspect);
            
            this.turnManager.addEvent('state_change', 'declaration', {
                description: `Player declared: ${declarationData}`,
                metadata: { aspect: newAspect }
            });
            
            this.deltaCollector.collect({
                target: 'world',
                operation: 'append',
                path: ['locations', location.id, 'aspects'],
                newValue: newAspect,
                previousValue: null,
                cause: 'declaration',
                eventId: turn.events[turn.events.length - 1].eventId
            });
        }
    }

    const narration = `You spend a Fate Point to declare a detail about the world. ${declarationData}`;
    return this.finalizeTurn(turn, narration, "success");
  }

  private async processFateAction(playerAction: string, turn: Turn, playerReasoning?: string, skipCompelCheck: boolean = false) {
    // Process world events
    const triggeredEvents = this.worldEventsManager.processEvents(this.worldManager.state, turn.turnId as number);
    if (triggeredEvents.length > 0) {
      for (const event of triggeredEvents) {
        this.turnManager.addEvent('world_event', 'triggered', {
          description: `World Event: ${event.name} - ${event.description}`,
          metadata: { eventId: event.id, effects: event.effects }
        });
      }
    }
    // Check for Compels
    if (!skipCompelCheck) {
        const compel = await this.checkCompels(playerAction);
        if (compel) {
            return {
                turn,
                narration: `The GM offers you a compel on your aspect '${compel.aspectName}': ${compel.description}`,
                result: 'compel_offered',
                compel
            };
        }
    }

    // Handle pending Fate Point spending from AI player
    const pendingFatePointsSpent = (this as any)._pendingFatePointsSpent || 0;
    const pendingAspectInvokes = (this as any)._pendingAspectInvokes || [];
    
    if (pendingFatePointsSpent > 0 && this.player) {
      if (this.player.fatePoints.current >= pendingFatePointsSpent) {
        const oldFP = this.player.fatePoints.current;
        this.player.fatePoints.current -= pendingFatePointsSpent;
        
        // Log the spending
        this.turnManager.addEvent('fate_point_spend', 'declaration', {
          description: `Spent ${pendingFatePointsSpent} Fate Points on story declaration`,
          metadata: { amount: pendingFatePointsSpent, reason: 'story_declaration' }
        });
        
        // Record delta
        this.deltaCollector.collect({
          target: 'player',
          operation: 'decrement',
          path: ['fatePoints', 'current'],
          previousValue: oldFP,
          newValue: this.player.fatePoints.current,
          cause: 'fate_point_spend',
          eventId: turn.events[0]?.eventId || 'unknown'
        });
      } else {
        console.warn(`AI Player tried to spend ${pendingFatePointsSpent} FP but only has ${this.player.fatePoints.current}`);
      }
    }

    // Handle pending aspect invokes
    let invokeObjects: any[] = [];
    if (pendingAspectInvokes.length > 0 && this.player) {
      for (const invoke of pendingAspectInvokes) {
        // Find the aspect by name
        const aspect = this.player.aspects.find(a => a.name.toLowerCase() === invoke.aspectName.toLowerCase());
        if (!aspect) {
          console.warn(`AI Player tried to invoke unknown aspect: ${invoke.aspectName}`);
          continue;
        }

        // Check if we need to spend FP for this invoke
        const needsFP = invoke.bonus === 'reroll' || (invoke.bonus === '+2' && aspect.freeInvokes <= 0);
        if (needsFP && (!this.player || this.player.fatePoints.current <= 0)) {
          console.warn(`AI Player tried to invoke ${invoke.aspectName} but has no FP`);
          continue;
        }

        if (needsFP) {
          this.player.fatePoints.current -= 1;
          this.turnManager.addEvent('fate_point_spend', 'aspect_invoke', {
            description: `Spent 1 Fate Point to invoke ${aspect.name}`,
            metadata: { aspectName: aspect.name, bonus: invoke.bonus }
          });
          
          // Record delta for FP spend
          this.deltaCollector.collect({
            target: 'player',
            operation: 'decrement',
            path: ['fatePoints', 'current'],
            previousValue: this.player.fatePoints.current + 1,
            newValue: this.player.fatePoints.current,
            cause: 'fate_point_spend',
            eventId: turn.events[0]?.eventId || 'unknown'
          });
        } else if (invoke.bonus === '+2' && aspect.freeInvokes > 0) {
          // Use free invoke
          aspect.freeInvokes -= 1;

          // If it's a boost and used up, remove it
          if (aspect.type === 'boost' && aspect.freeInvokes === 0) {
              this.player.aspects = this.player.aspects.filter(a => a.id !== aspect.id);
              
              this.turnManager.addEvent('state_change', 'boost_removed', {
                  description: `Boost used and removed: ${aspect.name}`,
                  metadata: { aspectId: aspect.id }
              });
              
              this.deltaCollector.collect({
                  target: 'player',
                  operation: 'set',
                  path: ['aspects'],
                  newValue: this.player.aspects,
                  previousValue: null,
                  cause: 'boost_removed',
                  eventId: turn.events[0]?.eventId || 'unknown'
              });
          }
        }

        invokeObjects.push({
          aspectId: aspect.id,
          bonus: invoke.bonus === 'reroll' ? 'reroll' : 2,
          fatePointSpent: needsFP
        });
      }
    }

    // Clear pending data
    (this as any)._pendingFatePointsSpent = 0;
    (this as any)._pendingAspectInvokes = [];

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

    // 5. Roll Dice (invokes will be handled by AI player separately)
    const roll = this.fateDice.roll();
    const resolution = ActionResolver.resolve(roll, skillSelection.rating, opposition, invokeObjects);

    // 6. Generate Events
    let invokeDescription = '';
    if (invokeObjects.length > 0) {
      const invokeNames = invokeObjects.map(inv => {
        const aspect = this.player?.aspects.find(a => a.id === inv.aspectId);
        return aspect?.name || 'Unknown Aspect';
      });
      invokeDescription = ` (invoking: ${invokeNames.join(', ')})`;
    }

    this.turnManager.addEvent('skill_check', fateAction, {
        description: `Player attempted to ${playerAction} using ${skillSelection.name}${invokeDescription}. Outcome: ${resolution.outcome}`,
        roll,
        difficulty: opposition,
        shifts: resolution.shifts,
        metadata: { invokes: invokeObjects }
    });

    // 9. Collect Deltas & Apply Consequences
    // Always record time passing
    const oldTime = this.worldManager.state.time.value;
    // Safely parse time value, defaulting to 0 if not a number
    const timeValue = parseInt(oldTime);
    this.worldManager.state.time.value = (isNaN(timeValue) ? 1 : timeValue + 1).toString();
    
    this.deltaCollector.collect({
        target: 'world',
        operation: 'set',
        path: ['time', 'value'],
        previousValue: oldTime,
        newValue: this.worldManager.state.time.value,
        cause: 'time_pass',
        eventId: turn.events[0]?.eventId || 'unknown'
    });

    await this.applyActionConsequences(fateAction, resolution, turn, undefined);

    // Check for Knowledge Gain
    if (resolution.outcome === 'success' || resolution.outcome === 'success_with_style') {
        const knowledgeGain = await this.decisionEngine.determineKnowledgeGain({
            action: { type: fateAction, description: playerAction },
            player: characterDefinition,
            worldState,
            history: this.history
        }, resolution.outcome);

        if (knowledgeGain && knowledgeGain.data) {
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
        // BUG-002 Fix: Only allow new quests on success; failures can still update/fail existing quests
        const isSuccess = resolution.outcome === 'success' || resolution.outcome === 'success_with_style';
        const isNewQuest = questUpdate.type === 'new';
        
        if (!isNewQuest || isSuccess) {
            this.applyQuestUpdate(questUpdate, turn);
        }
    }

    // Check for World Updates
    const worldUpdates = await this.decisionEngine.determineWorldUpdates({
        action: { type: fateAction, description: playerAction },
        player: characterDefinition,
        worldState,
        history: this.history
    }, resolution.outcome);

    if (worldUpdates && worldUpdates.length > 0) {
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

    // 10. Narrate - Use enhanced action resolution narration
    const narration = await this.narrativeEngine.narrateActionResolution({
        events: turn.events,
        player: characterDefinition,
        worldState,
        history: this.history,
        actionResolution: {
            playerAction,
            playerReasoning: playerReasoning, // Use the passed reasoning
            fateAction,
            skill: skillSelection.name,
            skillRating: skillSelection.rating,
            difficulty: opposition,
            roll: roll.total,
            shifts: resolution.shifts,
            outcome: resolution.outcome,
            targetName: targetNPC?.name,
            // invokes: invokeObjects // Removed as it's not in the interface yet
        }
    });

    return this.finalizeTurn(turn, narration, resolution.outcome, playerReasoning);
  }

  async processAIPlayerAction(action: string, reasoning?: string, fatePointsSpent?: number, aspectInvokes?: Array<{aspectName: string, bonus: '+2' | 'reroll'}>): Promise<any> {
    // Store the invoke decisions for later processing
    (this as any)._pendingAspectInvokes = aspectInvokes || [];
    (this as any)._pendingFatePointsSpent = fatePointsSpent || 0;
    
    // Pass reasoning directly to processPlayerAction
    const result = await this.processPlayerAction(action, reasoning);
    
    return result;
  }

  /**
   * Get context for AI player decision making
   */
  getAIPlayerContext() {
    // Get current location from the current scene
    const currentLocation = this.currentScene 
      ? this.worldManager.getLocation(this.currentScene.locationId)
      : undefined;
    
    return {
        player: this.getCharacterDefinition(),
        worldState: {
          ...this.worldManager.state,
          currentLocation // Add current location for easy access
        },
        history: this.history,
        currentScene: this.currentScene,
        objectives: this.getActiveQuestObjectives()
    };
  }

  /**
   * Get active quest objectives for AI player context
   */
  private getActiveQuestObjectives(): string[] {
    const objectives: string[] = [];
    const quests = this.worldManager.state.quests || [];
    
    for (const quest of quests) {
        if (quest.status === 'active') {
            objectives.push(`${quest.title}: ${quest.description}`);
            if (quest.objectives) {
                for (const obj of quest.objectives) {
                    if (obj.status !== 'completed') {
                        objectives.push(`  - ${obj.description}`);
                    }
                }
            }
        }
    }
    
    return objectives;
  }

  private async finalizeTurn(turn: Turn, narration: string, result: string, playerReasoning?: string) {
    // Store narration in the turn
    turn.narration = narration;
    
    // Store player reasoning if provided
    if (playerReasoning) {
      (turn as any).playerReasoning = playerReasoning;
    }
    
    // Track consecutive failures for proactive compel offers
    if (result === 'failure') {
      this.consecutiveFailures++;
    } else if (result === 'success' || result === 'success_with_style') {
      this.consecutiveFailures = 0; // Reset on any success
    }
    
    // Update history with configurable windowing
    this.history.push(turn);
    this.pruneHistory();

    // Save Turn and Deltas
    await this.sessionWriter.writeTurn(this.sessionId, turn);
    
    const deltas = this.deltaCollector.getDeltas();
    for (const delta of deltas) {
        await this.sessionWriter.writeDelta(this.sessionId, delta);
    }

    await this.saveState();

    return {
        turn,
        narration,
        result
    };
  }

  private async processAdvancement(playerAction: string, turn: Turn) {
    if (!this.player) throw new Error("No player");

    const advancementData = await this.decisionEngine.parseAdvancement(playerAction);
    
    if (!advancementData) {
        const narration = "The GM is unsure how you want to advance. Please be more specific.";
        this.turnManager.addEvent('system', 'advancement_failed', { description: narration });
        return this.finalizeTurn(turn, narration, "failure");
    }

    const validation = AdvancementManager.validateAdvancement(this.player, advancementData);
    if (!validation.valid) {
        const narration = `You cannot perform this advancement: ${validation.reason}`;
        this.turnManager.addEvent('system', 'advancement_failed', { description: narration, metadata: { reason: validation.reason } });
        return this.finalizeTurn(turn, narration, "failure");
    }

    // Apply Advancement
    this.applyAdvancement(advancementData, turn);

    const narration = `You spend a ${advancementData.milestoneRequired} milestone to improve yourself.`;
    return this.finalizeTurn(turn, narration, "success");
  }

  private applyAdvancement(action: any, turn: Turn) {
      if (!this.player) return;
      
      // Deduct Milestone
      const milestoneType = action.milestoneRequired as keyof typeof this.player.milestones;
      this.player.milestones[milestoneType]--;
      
      this.deltaCollector.collect({
          target: 'player',
          operation: 'decrement',
          path: ['milestones', milestoneType],
          previousValue: this.player.milestones[milestoneType] + 1,
          newValue: this.player.milestones[milestoneType],
          cause: 'advancement_cost',
          eventId: turn.events[turn.events.length - 1]?.eventId || 'unknown'
      });

      // Apply specific changes
      switch (action.type) {
          case 'increase_skill':
              const skill = this.player.skills.find(s => s.name.toLowerCase() === action.details.skillName.toLowerCase());
              if (skill) {
                  const oldRank = skill.rank;
                  skill.rank++;
                  
                  this.deltaCollector.collect({
                      target: 'player',
                      operation: 'increment',
                      path: ['skills', this.player.skills.indexOf(skill).toString(), 'rank'],
                      previousValue: oldRank,
                      newValue: skill.rank,
                      cause: 'advancement_skill_increase',
                      eventId: turn.events[turn.events.length - 1]?.eventId || 'unknown'
                  });
                  
                  this.turnManager.addEvent('state_change', 'skill_increase', {
                      description: `Increased ${skill.name} to +${skill.rank}`,
                      metadata: { skill: skill.name, newRank: skill.rank }
                  });
              }
              break;
          case 'buy_skill':
              // Assuming buying a skill starts it at Average (+1)
              const newSkill = { name: action.details.skillName, rank: 1 };
              this.player.skills.push(newSkill);
              
              this.deltaCollector.collect({
                  target: 'player',
                  operation: 'append',
                  path: ['skills'],
                  newValue: newSkill,
                  previousValue: null,
                  cause: 'advancement_buy_skill',
                  eventId: turn.events[turn.events.length - 1]?.eventId || 'unknown'
              });

              this.turnManager.addEvent('state_change', 'skill_acquired', {
                  description: `Acquired new skill: ${newSkill.name} at +1`,
                  metadata: { skill: newSkill }
              });
              break;
          case 'rename_aspect':
              const aspect = this.player.aspects.find(a => a.name.toLowerCase() === action.details.aspectName.toLowerCase());
              if (aspect) {
                  const oldName = aspect.name;
                  aspect.name = action.details.newAspectName;
                  
                  this.deltaCollector.collect({
                      target: 'player',
                      operation: 'set',
                      path: ['aspects', this.player.aspects.indexOf(aspect).toString(), 'name'],
                      previousValue: oldName,
                      newValue: aspect.name,
                      cause: 'advancement_rename_aspect',
                      eventId: turn.events[turn.events.length - 1]?.eventId || 'unknown'
                  });

                  this.turnManager.addEvent('state_change', 'aspect_renamed', {
                      description: `Renamed aspect '${oldName}' to '${aspect.name}'`,
                      metadata: { oldName, newName: aspect.name }
                  });
              }
              break;
          case 'buy_stunt':
              const newStunt = {
                  id: uuidv4(),
                  name: action.details.newStuntName,
                  description: action.details.newStuntDescription || "No description",
                  cost: 1,
                  refresh: 0
              };
              this.player.stunts.push(newStunt);
              this.player.fatePoints.refresh--;
              
              this.deltaCollector.collect({
                  target: 'player',
                  operation: 'append',
                  path: ['stunts'],
                  newValue: newStunt,
                  previousValue: null,
                  cause: 'advancement_buy_stunt',
                  eventId: turn.events[turn.events.length - 1]?.eventId || 'unknown'
              });
              
              this.deltaCollector.collect({
                  target: 'player',
                  operation: 'decrement',
                  path: ['fatePoints', 'refresh'],
                  previousValue: this.player.fatePoints.refresh + 1,
                  newValue: this.player.fatePoints.refresh,
                  cause: 'advancement_buy_stunt_cost',
                  eventId: turn.events[turn.events.length - 1]?.eventId || 'unknown'
              });

              this.turnManager.addEvent('state_change', 'stunt_acquired', {
                  description: `Acquired new stunt: ${newStunt.name}`,
                  metadata: { stunt: newStunt }
              });
              break;
          case 'increase_refresh':
              this.player.fatePoints.refresh++;
              
              this.deltaCollector.collect({
                  target: 'player',
                  operation: 'increment',
                  path: ['fatePoints', 'refresh'],
                  previousValue: this.player.fatePoints.refresh - 1,
                  newValue: this.player.fatePoints.refresh,
                  cause: 'advancement_increase_refresh',
                  eventId: turn.events[turn.events.length - 1]?.eventId || 'unknown'
              });

              this.turnManager.addEvent('state_change', 'refresh_increased', {
                  description: `Refresh increased to ${this.player.fatePoints.refresh}`,
                  metadata: { newRefresh: this.player.fatePoints.refresh }
              });
              break;
      }
  }

  private async processInventoryTurn(turn: Turn) {
    if (!this.player) throw new Error("No player");
    
    const inventoryList = this.player.inventory.map(i => `${i.name} (x${i.quantity})`).join(", ") || "Nothing";
    const wealth = this.player.wealth;
    
    const description = `Inventory: ${inventoryList}. Wealth: ${wealth} coins.`;
    
    this.turnManager.addEvent('system', 'inventory_check', {
        description,
        metadata: { inventory: this.player.inventory, wealth }
    });
    
    const narration = `You check your belongings. You have ${wealth} coins. In your pack, you find: ${inventoryList}.`;
    
    return this.finalizeTurn(turn, narration, "success");
  }

  private async processStatusTurn(turn: Turn) {
    if (!this.player) throw new Error("No player");
    
    const physical = this.player.stressTracks.find(t => t.type === 'physical');
    const mental = this.player.stressTracks.find(t => t.type === 'mental');
    
    const consequences = this.player.consequences.map(c => `${c.severity}: ${c.name}`).join(", ") || "None";
    
    const description = `Status Check. Physical Stress: ${physical?.boxes.filter(b=>b).length}/${physical?.capacity}. Mental Stress: ${mental?.boxes.filter(b=>b).length}/${mental?.capacity}. Consequences: ${consequences}.`;
    
    this.turnManager.addEvent('system', 'status_check', {
        description,
        metadata: { physical, mental, consequences }
    });
    
    const narration = `You take a moment to assess your condition. ${description}`;
    
    return this.finalizeTurn(turn, narration, "success");
  }

  private async processTradeTurn(playerAction: string, turn: Turn) {
    if (!this.player) throw new Error("No player");
    
    // 1. Check for Shop
    // For now, assume shops are features in the location or scene
    // We need to check if there is a shop available.
    // Let's assume the current location has a 'shops' property or we check features.
    // Since Location schema might not have explicit shops, we check features with type 'shop'.
    
    const location = this.worldManager.getLocation(this.currentScene?.locationId || "");
    const shopFeature = location?.features.find(f => f.type === 'shop');
    
    if (!shopFeature) {
        const narration = "There are no shops here.";
        this.turnManager.addEvent('system', 'trade_failed', { description: narration });
        return this.finalizeTurn(turn, narration, "failure");
    }

    // 2. Parse Intent
    const intent = await this.decisionEngine.parseTradeIntent(playerAction);
    
    let narration = "";
    let result = "success";

    if (intent.type === 'list') {
        // List items in shop
        // We need to get the shop inventory. 
        // Since we don't have a persistent Shop object in memory linked to the feature yet,
        // we might need to generate one or retrieve it.
        // For this implementation, let's assume the EconomyManager can generate a shop if needed or we use a mock one.
        // TODO: Implement persistent shops. For now, generate a random stock based on location.
        
        const shopItems = ["Health Potion (50g)", "Iron Sword (100g)", "Leather Armor (80g)"]; // Placeholder
        narration = `The shopkeeper shows you their wares: ${shopItems.join(", ")}.`;
        
        this.turnManager.addEvent('system', 'trade_list', { description: narration });
    } else if (intent.type === 'buy') {
        // Handle Buy
        // Placeholder logic
        narration = `You try to buy ${intent.quantity} ${intent.itemName}, but the shop system is still under construction.`;
        this.turnManager.addEvent('system', 'trade_buy', { description: narration });
    } else if (intent.type === 'sell') {
        // Handle Sell
        narration = `You try to sell ${intent.quantity} ${intent.itemName}, but the shop system is still under construction.`;
        this.turnManager.addEvent('system', 'trade_sell', { description: narration });
    }

    return this.finalizeTurn(turn, narration, result);
  }

  private async processCraftTurn(playerAction: string, turn: Turn) {
    if (!this.player) throw new Error("No player");

    // 1. Parse Intent
    const intent = await this.decisionEngine.parseCraftIntent(playerAction);
    
    let narration = "";
    let result = "success";

    if (intent.type === 'list') {
        narration = "You consider what you can craft. (Recipe system under construction)";
        this.turnManager.addEvent('system', 'craft_list', { description: narration });
    } else {
        narration = `You attempt to craft ${intent.recipeName}, but the crafting system is still under construction.`;
        this.turnManager.addEvent('system', 'craft_attempt', { description: narration });
    }

    return this.finalizeTurn(turn, narration, result);
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

  async craftItem(recipeId: string) {
    if (!this.player) {
        console.log("No active player.");
        return;
    }

    // In a real implementation, we'd look up the recipe from a database or the world state
    // For now, we'll mock a recipe lookup or assume it's passed in fully, but the method signature takes an ID.
    // Let's assume we have a way to get recipes. For this demo, I'll just log that we can't find it unless we implement a RecipeManager.
    // Or, we can check if the player "knows" the recipe (which could be in their knowledge).
    
    console.log(`Attempting to craft recipe: ${recipeId}`);
    // TODO: Implement recipe lookup
    console.log("Recipe lookup not implemented yet.");
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

  /**
   * Extracts and validates attack target from player input
   */
  private extractAttackTarget(playerInput: string, conflict: any): string | undefined {
    if (!conflict || !conflict.participants) return undefined;

    const inputLower = playerInput.toLowerCase();

    // Get list of valid targets (opposition side)
    const validTargets = conflict.participants
        .filter((p: any) => p.side === 'opposition')
        .map((p: any) => this.npcs[p.characterId])
        .filter((npc: any) => npc !== undefined) as CharacterDefinition[];

    if (validTargets.length === 0) return undefined;

    // Try to match target name in player input
    for (const target of validTargets) {
        const targetNameLower = target.name.toLowerCase();
        if (inputLower.includes(targetNameLower)) {
            return target.id;
        }
    }

    // If only one target exists, use it
    if (validTargets.length === 1) {
        return validTargets[0].id;
    }

    // Multiple targets but none explicitly named - fail
    return undefined;
  }

  private async applyActionConsequences(action: string, resolution: any, turn: Turn, attackTarget?: string) {
    if (!this.player) return;

    const lastEventId = turn.events[turn.events.length - 1].eventId;

    // Handle Success with Style (General)
    if (resolution.outcome === 'success_with_style') {
        // Generate Boost Name
        const boostName = await this.decisionEngine.generateBoostName({
            action: { description: `Player action: ${action}` },
            player: this.getCharacterDefinition(),
            worldState: this.worldManager.state,
            history: this.history
        });

        // Create Boost Aspect
        // Cast to any to avoid strict type issues if AspectTypeSchema isn't perfectly aligned in local types
        const boostAspect: any = {
            id: uuidv4(),
            name: boostName,
            type: 'boost',
            freeInvokes: 1,
            description: 'Temporary boost from Success with Style'
        };

        // Add to player
        this.player.aspects.push(boostAspect);

        // Log event
        this.turnManager.addEvent('state_change', 'boost_created', {
            description: `Gained a Boost: ${boostName}`,
            metadata: { aspect: boostAspect }
        });

        // Delta
        this.deltaCollector.collect({
            target: 'player',
            operation: 'append',
            path: ['aspects'],
            newValue: boostAspect,
            previousValue: null,
            cause: 'success_with_style',
            eventId: lastEventId
        });
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

    // Handle Attack (only if valid target exists)
    if (action === 'attack' && attackTarget) {
        if (resolution.outcome === 'success' || resolution.outcome === 'success_with_style') {
            // Deal stress
            const damage = resolution.shifts;
            const target = this.npcs[attackTarget];
            const targetName = target?.name || 'unknown target';
            this.turnManager.addEvent('state_change', 'attack', {
                description: `Dealt ${damage} shifts of damage to ${targetName}`,
            });
        }
    }
  }

  async startCombat(opponents: CharacterDefinition[], allies: CharacterDefinition[] = []) {
    if (!this.currentScene || !this.player) return;
    
    // Add opponents and allies to tracked NPCs
    opponents.forEach(npc => {
        this.npcs[npc.id] = npc;
    });
    allies.forEach(npc => {
        this.npcs[npc.id] = npc;
    });

    const conflict = await this.combatManager.startConflict(
      this.currentScene,
      'physical',
      opponents,
      this.player,
      allies,
      Object.values(this.worldManager.state.factions)
    );
    
    console.log(`Combat started! ID: ${conflict.id}`);
    return conflict;
  }

  async startSocialConflict(opponents: CharacterDefinition[], allies: CharacterDefinition[] = []) {
    if (!this.currentScene || !this.player) return;
    
    // Add opponents and allies to tracked NPCs
    opponents.forEach(npc => {
        this.npcs[npc.id] = npc;
    });
    allies.forEach(npc => {
        this.npcs[npc.id] = npc;
    });

    const conflict = await this.combatManager.startConflict(
      this.currentScene,
      'social',
      opponents,
      this.player,
      allies,
      Object.values(this.worldManager.state.factions)
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

    // For attacks, extract and validate the target
    let attackTarget: string | undefined;
    if (fateAction === 'attack') {
        attackTarget = this.extractAttackTarget(playerAction, conflict);
        if (!attackTarget) {
            // Invalid attack - no target found
            const turn = this.turnManager.startTurn("player", this.currentScene.id, { day: 1, timeOfDay: 'morning', timestamp: Date.now() });
            this.turnManager.addEvent('skill_check', 'attack', {
                description: `Player attempted to ${playerAction} but no valid target was found.`,
                roll: { dice: [0, 0, 0, 0], total: 0 },
                difficulty: 0,
                shifts: 0
            });
            turn.narration = "You tried to attack, but there's no valid target to attack here.";
            await this.sessionWriter.writeTurn(this.sessionId, turn);
            this.history.push(turn);
            return { turn, narration: turn.narration, result: 'failure' };
        }
    }

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
    await this.applyActionConsequences(fateAction, resolution, turn, attackTarget);

    // Narrate Player Action
    let narration = await this.narrativeEngine.narrate({
        events: turn.events,
        player: characterDefinition,
        worldState,
        history: this.history
    });

    // Assign narration to turn
    turn.narration = narration;

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
            
            // Determine Side
            const participant = conflict.participants.find(p => p.characterId === nextActorId);
            const side = participant?.side === 'player' ? 'player' : 'opposition';

            // Decide NPC Action
            const decision = await this.decisionEngine.decideNPCAction(npc, {
                action: null,
                player: characterDefinition,
                worldState,
                history: this.history
            }, side);

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
            
            // Assign narration to NPC turn
            npcTurn.narration = npcNarration;
            
            narration += `\n\n${npcNarration}`;
            
            await this.sessionWriter.writeTurn(this.sessionId, npcTurn);
            this.history.push(npcTurn);
            this.pruneHistory();
        }

        nextActorId = this.combatManager.nextTurn(conflict);
        
        // Check Resolution (simplified)
        const opponents = conflict.participants
            .filter(p => p.side === 'opposition')
            .map(p => this.npcs[p.characterId])
            .filter(n => n !== undefined) as CharacterDefinition[];

        if (this.combatManager.checkResolution(conflict, opponents, this.player)) {
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
      // BUG-003 Fix: Check if quest with same ID already exists to prevent duplicates
      const existingQuest = worldState.quests?.find((q: any) => q.id === update.quest.id);
      if (existingQuest) {
        // Quest already exists, skip adding duplicate
        return;
      }
      
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
            const relationships = this.player.relationships.map(r => `- ${r.targetName}: ${r.type} (Trust:${r.trust})`).join('\n');
            const fp = this.player.fatePoints.current;
            return {
                turn: null,
                narration: `**${this.player.name}**\n\n**Fate Points:** ${fp}\n\n**Aspects:**\n${aspects}\n\n**Skills:**\n${skills}\n\n**Relationships:**\n${relationships}`,
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

  /**
   * Updates a relationship between characters and collects delta.
   */
  private updateRelationship(targetId: string, changes: Partial<{ trust: number; affection: number; respect: number; influence: number; type: string }>, event: string, turn: Turn) {
    if (!this.player) return;

    const relationship = this.player.relationships.find(r => r.targetId === targetId);
    if (!relationship) return;

    const previousValue = { ...relationship };

    // Apply changes
    if (changes.trust !== undefined) relationship.trust = Math.max(-3, Math.min(3, relationship.trust + changes.trust));
    if (changes.affection !== undefined) relationship.affection = Math.max(-3, Math.min(3, relationship.affection + changes.affection));
    if (changes.respect !== undefined) relationship.respect = Math.max(-3, Math.min(3, relationship.respect + changes.respect));
    if (changes.influence !== undefined) relationship.influence = Math.max(0, Math.min(5, relationship.influence + changes.influence));
    if (changes.type) relationship.type = changes.type as any;

    // Add to history
    relationship.history.push({
      turn: turn.turnId as number,
      event,
      impact: (changes.trust || 0) + (changes.affection || 0) + (changes.respect || 0)
    });

    relationship.lastInteractionTurn = turn.turnId as number;

    // Collect delta
    this.deltaCollector.collect({
      target: 'player',
      operation: 'set',
      path: ['relationships', String(this.player.relationships.indexOf(relationship))],
      previousValue,
      newValue: relationship,
      cause: 'relationship_update',
      eventId: turn.events[turn.events.length - 1]?.eventId || 'unknown'
    });
  }

  /**
   * Prune history based on configuration settings
   * - Uses maxHistoryTurns for simple count-based pruning
   * - Optionally uses smart pruning based on estimated token count
   */
  private pruneHistory(): void {
    if (this.config.enableSmartPruning) {
      // Smart pruning: estimate tokens and remove oldest turns until under limit
      while (this.history.length > 1) {
        const estimatedTokens = this.estimateHistoryTokens();
        if (estimatedTokens <= this.config.maxContextTokens!) {
          break;
        }
        this.history.shift();
      }
    } else {
      // Simple pruning: keep only the last N turns
      while (this.history.length > this.config.maxHistoryTurns!) {
        this.history.shift();
      }
    }
  }

  /**
   * Estimate the number of tokens in the history
   * Uses a rough approximation: ~1 token per 4 characters
   */
  private estimateHistoryTokens(): number {
    const historyJson = JSON.stringify(this.history);
    return Math.ceil(historyJson.length / 4);
  }

  /**
   * Handle player travel to a new location via a connection
   */
  async travelToLocation(connectionId: string): Promise<{ success: boolean; newLocation?: any; narration?: string }> {
    if (!this.currentScene) {
      return { success: false, narration: "You can't travel right now." };
    }

    const currentLocation = this.worldManager.getLocation(this.currentScene.locationId);
    if (!currentLocation) {
      return { success: false, narration: "Current location not found." };
    }

    const connection = currentLocation.connections?.find(c => c.targetId === connectionId);
    if (!connection) {
      return { success: false, narration: "That exit doesn't exist." };
    }

    try {
      // Check if destination location already exists
      let destinationLocation = this.worldManager.getLocation(connection.targetId);

      if (!destinationLocation) {
        // Generate new location
        console.log(`Generating new location: ${connection.description}...`);
        destinationLocation = await this.contentGenerator.generateNewLocation(
          currentLocation.name,
          connection.description || connection.direction || 'unknown passage',
          this.worldManager.state.theme
        );
        
        // Store the generated location
        this.worldManager.setLocation(destinationLocation);
      }

      // Create new scene at the destination
      const currentTurn = this.turnManager.getCurrentTurn();
      this.currentScene = {
        id: `scene-${Date.now()}`,
        name: destinationLocation.name,
        description: destinationLocation.description,
        locationId: destinationLocation.id,
        aspects: destinationLocation.aspects || [],
        startTurn: currentTurn?.turnId ?? 0,
        type: 'exploration'
      };

      // Collect delta for location change
      this.deltaCollector.collect({
        target: 'world',
        operation: 'set',
        path: ['currentScene'],
        previousValue: undefined,
        newValue: this.currentScene,
        cause: 'travel',
        eventId: `travel-${Date.now()}`
      });

      // Generate travel narration
      const travelNarration = await this.narrativeEngine.generateTravelNarration(
        currentLocation,
        destinationLocation,
        connection.direction || 'path'
      );

      console.log(`✨ Traveled to ${destinationLocation.name}`);

      return {
        success: true,
        newLocation: destinationLocation,
        narration: travelNarration
      };
    } catch (error) {
      console.error("Travel failed:", error);
      return {
        success: false,
        narration: "Something prevented you from traveling. Try again."
      };
    }
  }
}
