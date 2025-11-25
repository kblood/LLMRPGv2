# Complete RPG System Integration & Architecture

## Overview

This document describes how all RPG systems integrate together, built on **Fate Core** mechanics.

**Related Documents:**
- [Fate Mechanics Reference](./FATE_MECHANICS_REFERENCE.md) - Core RPG rules
- [Turn and Action System](./TURN_AND_ACTION_SYSTEM.md) - Turn/Event structure
- [Delta and Snapshot System](./DELTA_AND_SNAPSHOT_SYSTEM.md) - State tracking
- [Session File Architecture](./SESSION_FILE_ARCHITECTURE.md) - Data persistence
- [Game Loop Flowchart](./GAME_LOOP_FLOWCHART.md) - Loop diagrams

---

## System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        GAME MASTER                               │
│  (Orchestrates narrative, generates content, makes decisions)   │
│                                                                  │
│  • Narrative Engine (Controls story flow)                       │
│  • Content Generator (Creates locations, NPCs, items)          │
│  • Decision Engine (Compels, Opposition, Consequences)         │
│  • World Manager (Manages state, time, persistence)            │
│  • Delta Collector (Tracks all state changes)                  │
└──────────┬──────────────────────────────────────────────────────┘
           │
    ┌──────┴──────────┬──────────────┬──────────────┐
    │                 │              │              │
    ▼                 ▼              ▼              ▼
┌────────┐      ┌─────────┐    ┌──────────┐   ┌──────────┐
│ PLAYER │      │  WORLD  │    │   NPC    │   │ CONFLICT │
│ SYSTEM │      │ SYSTEM  │    │ SYSTEM   │   │ SYSTEM   │
│ (Fate) │      │         │    │          │   │ (Fate)   │
│        │      │         │    │          │   │          │
│• Aspect│      │• Scenes │    │• Schedule│   │• Stress  │
│• Skills│      │• Zones  │    │• Memory  │   │• Conseq  │
│• Stress│      │• Aspects│    │• Aspects │   │• Zones   │
│• Fate ▲│      │• Items  │    │• Skills  │   │• Actions │
└────────┘      └─────────┘    └──────────┘   └──────────┘
    │                 │              │              │
    └─────────────────┴──────────────┴──────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │   GAME LOOP      │
            │  (Turn-based)    │
            │                  │
            │  → Log Turns     │
            │  → Collect Deltas│
            │  → Create Snaps  │
            └──────────────────┘
```

---

## Core Components Required

### 1. Enhanced GameMaster System

```javascript
class GameMaster {
  constructor() {
    this.narrativeEngine = new NarrativeEngine();
    this.contentGenerator = new ContentGenerator();
    this.decisionEngine = new DecisionEngine();
    this.worldManager = new WorldManager();
    this.deltaCollector = new DeltaCollector();  // Track state changes
  }
  
  // Main methods - now returns Turn with Events and Deltas
  async processPlayerAction(player, action) {
    const turn = this.createTurn(player, action);
    
    // 1. Determine Fate action type
    const fateAction = this.mapToFateAction(action);
    
    // 2. Set opposition (difficulty or opposed roll)
    const opposition = await this.decisionEngine.setOpposition({
      action: fateAction,
      playerState: player,
      worldState: this.worldManager.state
    });
    
    // 3. Roll dice and resolve
    const roll = this.rollFateDice(player, fateAction, opposition);
    
    // 4. Generate events based on outcome
    const events = await this.generateEvents(roll, fateAction);
    
    // 5. Collect deltas from events
    const deltas = this.deltaCollector.collectFromEvents(events);
    
    // 6. Narrate outcome
    const narration = await this.narrativeEngine.narrate(events);
    
    return { turn, events, deltas, narration };
  }
  
  mapToFateAction(action) {
    // Map player intent to Fate's four actions
    const mapping = {
      'travel': 'overcome',
      'unlock': 'overcome',
      'climb': 'overcome',
      'talk': 'createAdvantage',
      'investigate': 'createAdvantage',
      'prepare': 'createAdvantage',
      'attack': 'attack',
      'defend': 'defend'
    };
    return mapping[action.type] || 'overcome';
  }
  
  async fleshOutLocation(locationId, context) {
    // Generate zones (Fate concept), aspects, NPCs
    const location = await this.contentGenerator.generateLocation({
      locationId,
      theme: this.worldManager.theme,
      questContext: context
    });
    
    // Record as deltas
    this.deltaCollector.add({
      scope: 'world',
      op: 'set',
      path: `locations.${locationId}`,
      value: location
    });
    
    return location;
  }
  
  async handleTravel(player, destination) {
    // Fate: Overcome action
    const difficulty = this.decisionEngine.getTravelDifficulty(
      player.location, destination
    );
    
    const roll = this.rollFateDice(player, {
      type: 'overcome',
      skill: 'Athletics'
    }, difficulty);
    
    if (roll.success) {
      return await this.completeTravel(player, destination);
    } else {
      // Failure or tie: complication
      return await this.handleTravelComplication(player, destination, roll);
    }
  }
  async handleInteraction(player, npc) {
    // Fate: Create Advantage action
    // Try to create an aspect like "Trusts Me" or "Revealed Secret"
    
    const roll = this.rollFateDice(player, {
      type: 'createAdvantage',
      skill: 'Rapport'  // or Empathy, Deceive
    }, npc.skills.Will);  // Opposed by NPC's Will
    
    const result = await this.resolveCreateAdvantage(roll, npc);
    
    // Record relationship change as delta
    if (result.aspectCreated) {
      this.deltaCollector.add({
        scope: 'world',
        op: 'push',
        path: `npcs.${npc.id}.aspects`,
        value: result.aspectCreated
      });
    }
    
    return result;
  }
  
  async handleConflict(player, opponents) {
    // See Conflict System - uses Fate stress/consequences
  }
  
  async onQuestProgress(questId, progress) {
    // Update world state based on quest progress
    this.deltaCollector.add({
      scope: 'world',
      op: 'set',
      path: `quests.${questId}.progress`,
      value: progress
    });
  }
}
```

### 2. World Manager System

```javascript
class WorldManager {
  constructor() {
    this.scenes = new SceneManager();      // Fate scenes
    this.locations = new LocationCache();
    this.npcs = new NPCRegistry();
    this.aspects = [];                     // Global aspects
    this.time = new GameTime();            // Turn-based time
    this.deltaCollector = new DeltaCollector();
  }
  
  // Scene Management (Fate concept)
  createScene(type, location, aspects = []) {
    const scene = {
      sceneId: generateId(),
      type: type,  // exploration, social, conflict
      location: location,
      aspects: aspects,  // Scene aspects
      zones: this.generateZones(location),
      npcsPresent: this.getNPCsAt(location.id)
    };
    
    this.deltaCollector.add({
      scope: 'scene',
      op: 'set',
      path: 'currentScene',
      value: scene
    });
    
    return scene;
  }
  
  generateZones(location) {
    // Fate zones for movement in conflict
    // Each zone has aspects and adjacent zones
    return location.zones || [];
  }
  
  // Location Management
  getLocation(locationId) {
    return this.locations.get(locationId);
  }
  
  async generateLocationContent(locationId, context) {
    // Use ContentGenerator to flesh out location
    // Add zones, aspects, NPCs
    const content = await this.contentGenerator.generate(locationId, context);
    
    this.deltaCollector.add({
      scope: 'world',
      op: 'set',
      path: `locations.${locationId}`,
      value: content
    });
    
    return content;
  }
  
  // NPC Management
  getNPCsAt(locationId) {
    const currentTime = this.time.current;
    return this.npcs.filter(npc => 
      npc.getLocationAt(currentTime) === locationId
    );
  }
  
  updateNPCPositions() {
    // Update all NPC locations based on schedules
    // Generate deltas for each movement
    for (const npc of this.npcs.all()) {
      const newLocation = npc.getLocationAt(this.time.current);
      if (newLocation !== npc.currentLocation) {
        this.deltaCollector.add({
          scope: 'world',
          op: 'set',
          path: `npcs.${npc.id}.currentLocation`,
          value: newLocation,
          previousValue: npc.currentLocation
        });
        npc.currentLocation = newLocation;
      }
    }
  }
  
  // Time Management
  advanceTurn() {
    this.time.advance();
    this.updateNPCPositions();
    this.checkScheduledEvents();
  }
}
```

### 3. NPC System with Fate Aspects

```javascript
class NPC {
  constructor() {
    this.id = uuid();
    this.name = "";
    this.role = "";
    
    // Fate character elements
    this.highConcept = "";     // Core aspect
    this.trouble = "";         // Complication aspect
    this.aspects = [];         // Additional aspects
    this.skills = {};          // Fate skill ratings
    this.stunts = [];          // Special abilities
    this.stress = { physical: [], mental: [] };
    this.consequences = {};
    
    // Location & schedule
    this.currentLocation = "";
    this.schedule = [];        // Time-based location schedule
    
    // Knowledge system
    this.knownQuests = [];
    this.knownLocations = [];
    this.knownNPCs = [];
    this.relationships = new Map();
    this.memory = new MemorySystem();
  }
  
  // Fate skill check
  getSkillRating(skill) {
    return this.skills[skill] || 0;
  }
  
  // Location-based
  getLocationAt(gameTime) {
    const entry = this.schedule.find(s => 
      s.timeOfDay === gameTime.timeOfDay
    );
    return entry ? entry.location : this.currentLocation;
  }
  
  // Knowledge Management
  knowsAboutQuest(questId) {
    return this.knownQuests.some(q => q.id === questId);
  }
  
  canReferPlayerTo(topic) {
    // Can this NPC point player to someone who knows more?
    for (const npc of this.knownNPCs) {
      if (npc.knowsAbout?.includes(topic)) {
        return { canRefer: true, referTo: npc.id };
      }
    }
    return { canRefer: false };
  }
  
  // Interaction using Fate
  async respondToQuery(player, query, gameState) {
    // Response quality depends on:
    // - Roll outcome (did player Create Advantage successfully?)
    // - Relationship aspects
    // - NPC's knowledge
    
    const context = {
      npc: this,
      player: player,
      query: query,
      relationship: this.relationships.get(player.id),
      npcAspects: [this.highConcept, this.trouble, ...this.aspects],
      sceneAspects: gameState.currentScene.aspects
    };
    
    return await LLM.generateNPCResponse(context);
  }
}
```

### 4. Conflict System (Fate Core)

```javascript
class ConflictSystem {
  constructor() {
    this.deltaCollector = new DeltaCollector();
  }
  
  async initiateConflict(participants, context) {
    // 1. Create conflict scene
    const scene = this.createConflictScene(context);
    
    // 2. Determine turn order (Notice skill)
    const turnOrder = this.determineTurnOrder(participants);
    
    // 3. Set up zones
    const zones = this.setupZones(context.location);
    
    // 4. Begin conflict loop
    return await this.runConflict(participants, turnOrder, scene);
  }
  
  async runConflict(participants, turnOrder, scene) {
    let exchange = 1;
    
    while (!this.isConflictOver(participants)) {
      // Each participant acts once per exchange
      for (const participant of turnOrder) {
        if (participant.takenOut) continue;
        
        // Get action (player input or AI decision)
        const action = await this.getAction(participant, scene);
        
        // Resolve Fate action
        const result = await this.resolveFateAction(action, scene);
        
        // Collect deltas
        this.collectConflictDeltas(result);
        
        // Check for taken out / concession
        await this.checkConflictStatus(participants);
      }
      
      exchange++;
    }
    
    return await this.resolveConflictEnd(participants, scene);
  }
  
  async resolveFateAction(action, scene) {
    switch (action.type) {
      case 'attack':
        return this.resolveAttack(action);
      case 'defend':
        return this.resolveDefend(action);
      case 'createAdvantage':
        return this.resolveCreateAdvantage(action, scene);
      case 'overcome':
        return this.resolveOvercome(action, scene);
    }
  }
  
  resolveAttack(action) {
    // Roll: 4dF + Attack skill (Fight, Shoot, etc.)
    // vs: Defender's 4dF + Defense skill (Athletics, etc.)
    
    const attackRoll = this.rollFateDice(action.attacker, action.skill);
    const defendRoll = this.rollFateDice(action.target, 'Athletics');
    
    const shifts = attackRoll.total - defendRoll.total;
    
    if (shifts > 0) {
      // Hit! Apply stress
      const stress = shifts + (action.weapon?.rating || 0);
      return this.applyStress(action.target, stress);
    } else {
      return { hit: false, shifts: 0 };
    }
  }
  
  applyStress(target, amount) {
    // Target chooses: stress boxes or consequences
    // AI/rules decide automatically
    
    // Check stress boxes
    if (target.stress.physical[amount - 1] === false) {
      target.stress.physical[amount - 1] = true;
      
      this.deltaCollector.add({
        scope: 'player',  // or 'world' for NPCs
        op: 'set',
        path: `stress.physical[${amount - 1}]`,
        value: true
      });
      
      return { absorbed: true, method: 'stress' };
    }
    
    // Or take consequence
    return this.offerConsequence(target, amount);
  }
  
  async resolveConflictEnd(participants, scene) {
    const winner = participants.find(p => !p.takenOut && !p.conceded);
    const loser = participants.find(p => p.takenOut || p.conceded);
    
    if (loser.conceded) {
      // Concession: loser gets Fate point, winner narrates
      this.deltaCollector.add({
        scope: loser.isPlayer ? 'player' : 'world',
        op: 'increment',
        path: 'fatePoints',
        value: 1
      });
    }
    
    // Winner narrates outcome
    const narration = await this.narrateConflictEnd(winner, loser, scene);
    
    // Create snapshot after conflict
    return {
      winner,
      loser,
      narration,
      createSnapshot: true,
      snapshotReason: 'conflict_end'
    };
  }
}
```

### 5. Player Instruction System (For LLM Player)

```javascript
class PlayerInstructionSystem {
  generateInstructions(player, gameState) {
    return {
      // Current status
      status: {
        health: player.health,
        location: player.location,
        inventory: player.inventory,
        activeQuests: getActiveQuests(gameState)
      },
      
      // Primary goals
      primaryGoal: {
        questId: mainQuestId,
        objective: getCurrentObjective(mainQuestId),
        hint: getGameMasterHint(mainQuestId)
      },
      
      // Available actions
      availableActions: {
        travel: getAvailableDestinations(player),
        interact: getAvailableNPCs(player),
        search: canSearchCurrentLocation(player),
        examine: getExaminableObjects(player)
      },
      
      // Context
      context: {
        currentTime: gameState.time,
        locationDescription: getLocationDesc(player.location),
        visibleNPCs: getNPCsAt(player.location),
        recentEvents: player.memory.getRecent(5),
        questProgress: getQuestProgressSummary(gameState)
      },
      
      // Reasoning for next action
      reasoning: {
        suggestion: generateGameMasterSuggestion(gameState),
        warnings: generateWarnings(player, gameState),
        opportunities: generateOpportunities(player, gameState)
      }
    };
  }
}
```

---

## Data Flow: Example - Player Travel Action

```
PLAYER: "Travel to Temple District"
│
├─ Parse action: Travel(destination="Temple District")
│
▼
GameMaster.processPlayerAction()
│
├─ 1. Check if Temple District is reachable
│    └─ From current location
│
├─ 2. Check if Temple District is defined
│    ├─ YES: Use existing definition
│    └─ NO: Call fleshOutLocation()
│         └─ Generate sub-locations, NPCs, items
│         └─ Cache for future visits
│
├─ 3. Narrate travel journey
│    └─ LLM describes journey based on:
│       ├─ Route taken
│       ├─ World theme
│       ├─ Quest context
│       └─ Time of day
│
├─ 4. Check for travel encounters
│    └─ GameMaster.decisionEngine.shouldEncounter()
│       ├─ Consider: Player level, location danger, quest state
│       ├─ 30% chance for random encounter
│       └─ Or: Quest-specific encounter
│
├─ 5a. If encounter:
│      └─ CombatSystem.initiateCombat() or negotiation
│
└─ 5b. If no encounter:
       │
       ├─ Update player.location = Temple District
       ├─ Update game clock
       ├─ Update NPC positions (some NPCs move)
       │
       └─ Describe arrival:
          "You arrive at the Temple District...
           You see: Khaosbyte, Merchant, Guard
           Exits: north to downtown, east to market"
          │
          └─ Return to Main Loop

UI gets update:
{
  playerLocation: "Temple District",
  visibleNPCs: [Khaosbyte, Merchant, Guard],
  narrative: "You arrive at the Temple District...",
  availableActions: [talk, search, travel, examine]
}
```

---

## Complete Session Flow

```
SESSION START
│
├─ GameMaster initializes world
│  ├─ Load pre-defined regions/cities
│  ├─ Set starting location
│  ├─ Create main quest + side quests
│  └─ Place NPCs at starting locations
│
├─ Player spawns at starting location
│  ├─ Receive initial instructions
│  └─ See starting area description
│
▼
MAIN GAME LOOP (repeats each frame)
│
├─ 1. Get Player Action
│
├─ 2. GameMaster processes action
│  └─ May generate new content
│
├─ 3. Execute action (Travel/Interact/Combat/etc)
│
├─ 4. Update NPC schedules & positions
│
├─ 5. Check quest progress
│
├─ 6. Generate new instructions for LLM player (if needed)
│
├─ 7. Publish state update to UI
│
└─ 8. Next frame
    │
    └─ Repeat until game end

SESSION END
│
├─ Resolve final quests
├─ Calculate final score
├─ Save replay data
└─ Load results
```

---

## Integration Checklist

```
Core Systems:
☐ GameMaster (orchestrator)
☐ World Manager (locations, NPCs, items)
☐ NPC System (location-based, knowledge)
☐ Combat System (with story integration)
☐ Player Instruction System (for LLM)

Content Generation:
☐ Location Generator (sub-locations)
☐ NPC Generator (with roles, quests)
☐ Item Generator (thematic)
☐ Encounter Generator
☐ Dialogue Generator (contextual)

Scheduling & Time:
☐ Game Clock (time management)
☐ NPC Schedules (movement patterns)
☐ Quest Timeline (based on progress)
☐ Event Scheduling

Knowledge Management:
☐ Quest Knowledge (who knows what)
☐ Location Knowledge (who knows where)
☐ NPC Knowledge (who knows whom)
☐ Gossip Network (information flow)

UI/Display:
☐ Location description display
☐ NPC roster with locations
☐ Quest tracking with objectives
☐ Player instructions
☐ Dialogue interface
☐ Combat interface

Persistence:
☐ World state saving
☐ NPC state saving
☐ Player progress saving
☐ Replay log saving
```

---

## Key Design Principles

### 1. **Game Master Controls Narrative**
- GM makes all story decisions
- GM decides encounters
- GM paces story progression

### 2. **Locations Are Location-Based**
- NPCs exist in specific places
- Must visit to interact
- Dynamic discovery (fleshing out on visit)

### 3. **Knowledge Is Distributed**
- NPCs know different things
- Knowledge has barriers/conditions
- Information network (ask who knows)

### 4. **Combat Has Story Weight**
- Not random encounters
- Quest-relevant or GM-generated
- Affects story progression

### 5. **World Feels Living**
- NPCs have schedules
- Time passes (quests change)
- Consequences for actions
- Gossip spreads

---

## Example: Quest with Location Discovery

```
Main Quest: "Stop the Virus"
└─ Objective 1: "Find the Lab"
   │
   └─ Player asks: "Where is the lab?"
      │
      ├─ Option A: Ask Khaosbyte (she might know)
      │  └─ Must be neutral+ relationship
      │  └─ She says: "I heard it's in industrial sector"
      │  └─ Gives hint, not exact location
      │
      ├─ Option B: Ask around for who knows
      │  └─ Guard: "I don't know, try the Information Broker"
      │  └─ Points to Khaosbyte
      │  └─ Merchant: "Something's weird in the industrial sector"
      │
      └─ Option C: Explore industrial sector
         └─ GM generates locations as player explores
         └─ Eventually finds lab
         └─ Discovery counts as quest progress

When player travels to Industrial Sector:
├─ GameMaster.fleshOutLocation("industrial-sector")
│  ├─ Generates 6-8 sub-locations
│  │  ├─ Factory Complex (where lab is hidden)
│  │  ├─ Worker Housing
│  │  ├─ Security Checkpoint
│  │  └─ etc
│  │
│  ├─ Generates NPCs
│  │  ├─ Security Guard
│  │  ├─ Factory Worker
│  │  └─ Corporate Executive
│  │
│  └─ Generates encounters
│     └─ Possibly: Guards if player investigates lab
│
└─ Player explores and finds lab through exploration or NPC hints
   └─ Marks objective complete
   └─ Quest progresses to next objective
```

This approach creates:
✅ Exploration (discovering locations)
✅ Investigation (asking NPCs)
✅ Social dynamics (NPCs know different things)
✅ Sense of living world (NPCs have locations & schedules)
✅ Story progression (quests guide but don't force)
