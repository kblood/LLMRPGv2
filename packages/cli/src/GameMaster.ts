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
    this.economyManager = new EconomyManager();
    this.craftingManager = new CraftingManager(this.actionResolver, this.fateDice);
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
    
    // Set initial time (numeric string for proper increment)
    this.worldManager.setTime("0", "Day 1, morning");

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
        milestones: { minor: 0, significant: 0, major: 0 }
    };

    console.log(`Character created: ${this.player.name}`);
    console.log(`High Concept: ${this.player.aspects.find(a => a.name === charData.aspects.find((ca: any) => ca.type === 'highConcept')?.name)?.name}`);
    
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
            turnId: 'pending'
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
    }

    return this.processFateAction(playerAction, turn, playerReasoning, skipCompelCheck);
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
    this.spendFatePoints(1, `Story Declaration: ${declarationData.fact}`);

    // 4. Apply Declaration (Add Aspect or Modify World)
    // For simplicity, we'll add a situational aspect to the scene or location
    if (this.currentScene) {
        const location = this.worldManager.getLocation(this.currentScene.locationId);
        if (location) {
            const newAspect = {
                id: uuidv4(),
                name: declarationData.aspectName || declarationData.fact, // Use provided name or the fact itself
                type: 'situational',
                freeInvokes: 0, // Declarations don't give free invokes usually, just establish truth
                description: `Declared by player: ${declarationData.fact}`
            };
            
            location.aspects.push(newAspect);
            
            this.turnManager.addEvent('state_change', 'declaration', {
                description: `Player declared: ${declarationData.fact}`,
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

    const narration = `You spend a Fate Point to declare a detail about the world. ${declarationData.fact}`;
    return this.finalizeTurn(turn, narration, "success");
  }

  private async processFateAction(playerAction: string, turn: Turn, playerReasoning?: string, skipCompelCheck: boolean = false) {
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
        invokes: invokeObjects
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

    await this.applyActionConsequences(fateAction, resolution, turn);

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
            invokes: invokeObjects
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
    return {
        player: this.getCharacterDefinition(),
        worldState: this.worldManager.state,
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
    
    // Update history
    this.history.push(turn);
    if (this.history.length > 10) {
        this.history.shift();
    }

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
        this.turnManager.addEvent('system', 'advancement_failed', { description: narration, reason: validation.reason });
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

  private async applyActionConsequences(action: string, resolution: any, turn: Turn) {
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
