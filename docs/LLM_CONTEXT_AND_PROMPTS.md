# LLM Context Management and Prompt System

## Overview

Different actors in the game (Game Master, NPCs, Player Agent) require different context windows and prompting strategies. This document defines how context is constructed, managed, and optimized for each role.

**Related Documents:**
- [Fate Mechanics Reference](./FATE_MECHANICS_REFERENCE.md) - RPG rules context
- [NPC and Player Knowledge System](./NPC_AND_PLAYER_KNOWLEDGE_SYSTEM.md) - Knowledge gates
- [Turn and Action System](./TURN_AND_ACTION_SYSTEM.md) - Action context
- [Delta and Snapshot System](./DELTA_AND_SNAPSHOT_SYSTEM.md) - State for context

---

## Context Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTEXT LAYERS                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: SYSTEM PROMPT (Static)                            │
│  ├─ Role definition                                         │
│  ├─ World rules (Fate mechanics)                           │
│  ├─ Response format requirements                            │
│  └─ Behavioral constraints                                  │
│                                                              │
│  Layer 2: CHARACTER DEFINITION (Semi-static)                │
│  ├─ Identity (name, high concept, trouble)                 │
│  ├─ Personality traits                                      │
│  ├─ Backstory summary                                       │
│  ├─ Skills and stunts                                       │
│  └─ Current aspects                                         │
│                                                              │
│  Layer 3: WORLD STATE (Dynamic)                             │
│  ├─ Current location/scene                                  │
│  ├─ Present characters                                      │
│  ├─ Active scene aspects                                    │
│  ├─ Relevant quest state                                    │
│  └─ Time of day                                             │
│                                                              │
│  Layer 4: CONVERSATION HISTORY (Rolling)                    │
│  ├─ Recent turns (last 5-10)                               │
│  ├─ Recent dialogue                                         │
│  ├─ Recent events                                           │
│  └─ Summarized older context                                │
│                                                              │
│  Layer 5: IMMEDIATE CONTEXT (Current turn)                  │
│  ├─ Player's current action/statement                       │
│  ├─ Dice roll results (if any)                             │
│  └─ Required response type                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Character Definition System

### Core Character Schema

Every character (NPC and Player) has a structured definition:

```typescript
interface CharacterDefinition {
  // === IDENTITY ===
  id: string;
  name: string;
  
  // Fate Core Aspects
  highConcept: string;      // Core identity aspect
  trouble: string;          // Personal complication
  aspects: string[];        // Additional aspects (up to 3)
  
  // === PERSONALITY ===
  personality: {
    traits: string[];       // 3-5 key traits
    values: string[];       // What they care about
    fears: string[];        // What they avoid/fear
    quirks: string[];       // Distinctive behaviors
    speechPattern: string;  // How they talk
  };
  
  // === BACKSTORY ===
  backstory: {
    summary: string;        // 2-3 sentence overview
    origin: string;         // Where they came from
    motivation: string;     // What drives them
    secrets: string[];      // Things they hide
    keyEvents: string[];    // Defining moments
  };
  
  // === CAPABILITIES ===
  skills: Record<string, number>;  // Fate skill ratings
  stunts: Stunt[];                 // Special abilities
  
  // === CURRENT STATE ===
  stress: { physical: boolean[]; mental: boolean[] };
  consequences: { mild?: string; moderate?: string; severe?: string };
  fatePoints: number;
  
  // === RELATIONSHIPS ===
  relationships: Relationship[];
  
  // === KNOWLEDGE ===
  knowledge: {
    knownLocations: string[];
    knownCharacters: string[];
    knownSecrets: string[];
    knownQuests: string[];
  };
}

interface Relationship {
  targetId: string;
  targetName: string;
  aspect: string;           // Relationship as Fate aspect
  attitude: number;         // -100 to +100
  history: string;          // Brief relationship history
}

interface Stunt {
  name: string;
  description: string;
  mechanical: string;       // Game effect
}
```

### Example: NPC Definition

```javascript
const khaosbyte = {
  id: "npc-khaosbyte",
  name: "Khaosbyte",
  
  // Fate Aspects
  highConcept: "Underground Info Broker with Corporate Secrets",
  trouble: "Too Many Enemies in High Places",
  aspects: [
    "My Network is My Power",
    "Trust is Earned in Credits",
    "Former Zaibatsu Data Analyst"
  ],
  
  // Personality
  personality: {
    traits: ["Cautious", "Shrewd", "Loyal to paying clients"],
    values: ["Information", "Survival", "Independence"],
    fears: ["Corporate hunters", "Betrayal", "Losing her network"],
    quirks: [
      "Always sits facing the door",
      "Speaks in metaphors when discussing sensitive info",
      "Taps fingers when nervous"
    ],
    speechPattern: "Clipped, efficient sentences. Uses tech slang. " +
                   "Never says names in public, uses nicknames. " +
                   "Gets more verbose when comfortable."
  },
  
  // Backstory
  backstory: {
    summary: "Former corporate data analyst who fled after discovering " +
             "illegal experiments. Now runs an underground info network.",
    origin: "Upper-middle corporate family, education at Zaibatsu Academy",
    motivation: "Expose corporate crimes while staying alive",
    secrets: [
      "Has a dead man's switch with damaging Zaibatsu data",
      "Her brother still works for Zaibatsu (unknowing asset)",
      "She's dying from corporate-inflicted neural damage"
    ],
    keyEvents: [
      "Discovered Project Chimera files",
      "Escaped assassination attempt, faked death",
      "Built info network over 3 years"
    ]
  },
  
  // Capabilities
  skills: {
    "Investigate": 4,   // Great
    "Contacts": 4,      // Great
    "Deceive": 3,       // Good
    "Notice": 3,        // Good
    "Stealth": 2,       // Fair
    "Rapport": 2,       // Fair
    "Will": 2,          // Fair
    "Empathy": 1        // Average
  },
  
  stunts: [
    {
      name: "I Know a Guy",
      description: "Extensive contact network",
      mechanical: "+2 to Contacts when finding specialists"
    },
    {
      name: "Read the Room",
      description: "Quickly assess danger",
      mechanical: "+2 to Notice for detecting threats"
    }
  ],
  
  // Relationships
  relationships: [
    {
      targetId: "player",
      targetName: "Unknown Client",
      aspect: "Potential Valuable Asset",
      attitude: 0,  // Neutral, needs to earn trust
      history: "Just met, seems competent"
    },
    {
      targetId: "npc-marcus",
      targetName: "Marcus",
      aspect: "Old Debt Between Us",
      attitude: 30,
      history: "He helped me escape, I owe him"
    }
  ],
  
  // Knowledge
  knowledge: {
    knownLocations: ["hacker-cafe", "safehouse-delta", "corporate-district"],
    knownCharacters: ["marcus", "dr-chen", "runner-jin"],
    knownSecrets: ["project-chimera-exists", "lab-location-industrial"],
    knownQuests: ["main-quest-virus", "side-quest-marcus-debt"]
  }
};
```

### Example: Player Character Definition

```javascript
const playerCharacter = {
  id: "player-vex",
  name: "Vex",
  
  // Fate Aspects
  highConcept: "Street-Smart Netrunner with a Conscience",
  trouble: "Hunted by Zaibatsu Security",
  aspects: [
    "Military-Grade Cyberdeck",
    "Owes Luna a Big Favor",
    "The Streets Raised Me"
  ],
  
  // Personality (set by player or generated)
  personality: {
    traits: ["Resourceful", "Cynical", "Protective of underdogs"],
    values: ["Freedom", "Loyalty", "The little guy"],
    fears: ["Capture", "Losing humanity to chrome", "Failing those who trust me"],
    quirks: [
      "Cracks knuckles before hacking",
      "Distrusts anyone in a suit",
      "Collects vintage music chips"
    ],
    speechPattern: "Street slang mixed with tech jargon. " +
                   "Sarcastic but not cruel. Direct when it matters."
  },
  
  // Backstory
  backstory: {
    summary: "Orphan who learned to hack to survive, now uses skills " +
             "to help others escape corporate control.",
    origin: "Lower city, grew up in communal housing block",
    motivation: "Take down the corps that killed my parents",
    secrets: [
      "Parents were actually corp researchers who tried to defect",
      "Has partial memories of being in a Zaibatsu facility as a child"
    ],
    keyEvents: [
      "Parents disappeared when I was 8",
      "First major hack at 15, freed data prisoners",
      "Luna saved my life, created the debt"
    ]
  },
  
  // Skills (player-chosen)
  skills: {
    "Hack": 4,        // Great (custom skill)
    "Notice": 3,      // Good
    "Stealth": 3,     // Good
    "Athletics": 2,   // Fair
    "Shoot": 2,       // Fair
    "Contacts": 2,    // Fair
    "Fight": 1,       // Average
    "Will": 1,        // Average
    "Rapport": 1,     // Average
    "Investigate": 1  // Average
  },
  
  stunts: [
    {
      name: "Ghost in the System",
      description: "Expert at avoiding detection",
      mechanical: "+2 to Hack when avoiding security traces"
    },
    {
      name: "Street Cred",
      description: "Known in the underground",
      mechanical: "+2 to Contacts in lower city areas"
    }
  ],
  
  // Starting relationships
  relationships: [
    {
      targetId: "npc-luna",
      targetName: "Luna",
      aspect: "I Owe Her My Life",
      attitude: 80,
      history: "She pulled me out of a Zaibatsu trap"
    }
  ]
};
```

---

## Context by Actor Type

### 1. Game Master Context

The GM LLM orchestrates the story and controls all non-player elements.

```typescript
interface GameMasterContext {
  // Layer 1: System
  systemPrompt: string;
  
  // Layer 2: GM "Character"
  gmPersonality: {
    narrativeStyle: string;     // "noir", "epic", "gritty"
    pacing: string;             // "fast", "deliberate"
    complicationFrequency: string;
    descriptionLength: string;  // "terse", "moderate", "verbose"
  };
  
  // Layer 3: World State
  worldState: {
    theme: ThemeDefinition;
    currentScene: Scene;
    activeQuests: Quest[];
    globalAspects: string[];
    recentWorldEvents: Event[];
  };
  
  // Layer 4: Session History
  sessionHistory: {
    recentTurns: Turn[];        // Last 10 turns
    majorEvents: string[];      // Key moments this session
    playerTendencies: string[]; // Observed player patterns
  };
  
  // Layer 5: Current Situation
  currentSituation: {
    playerAction: string;
    rollResult?: RollResult;
    requiredOutput: "narration" | "npc_response" | "consequence" | "scene_setup";
  };
}
```

**GM System Prompt Template:**

```
You are the Game Master for an RPG using Fate Core mechanics.

ROLE:
- Narrate the world and NPCs (but not player actions)
- Set scene aspects and opposition difficulties
- Decide when to compel player aspects
- Create dramatic complications and rewards
- Maintain consistent world and NPC behavior

STYLE:
{theme.narrativeStyle} - {theme.tone}
Description length: {gmPersonality.descriptionLength}
Pacing: {gmPersonality.pacing}

RULES:
- Use Fate Core's four actions: Overcome, Create Advantage, Attack, Defend
- The Ladder: Terrible(-2) to Legendary(+8)
- Players can invoke aspects for +2 or reroll
- You can compel aspects (offer fate point for complication)
- Stress absorbs damage, consequences create aspects

RESPONSE FORMAT:
{format specification based on requiredOutput}

CONSTRAINTS:
- Never control player character's decisions
- NPCs act according to their defined personality and knowledge
- Maintain information barriers (NPCs only know what they know)
- Respect established continuity
```

### 2. NPC Context

Each NPC interaction uses focused context about that specific character.

```typescript
interface NPCContext {
  // Layer 1: System (NPC role)
  systemPrompt: string;
  
  // Layer 2: This NPC's Definition
  character: CharacterDefinition;
  
  // Layer 3: Situational Awareness
  situation: {
    currentLocation: Location;
    currentScene: Scene;
    presentCharacters: string[];
    timeOfDay: string;
    recentLocalEvents: string[];
  };
  
  // Layer 4: Conversation History
  conversationHistory: {
    previousExchanges: DialogueExchange[];  // This conversation
    pastInteractions: string[];              // Summary of prior meetings
  };
  
  // Layer 5: Current Interaction
  currentInteraction: {
    playerStatement: string;
    playerApproach: string;  // "friendly", "threatening", "deceptive"
    rollResult?: RollResult; // If player rolled to influence
  };
}
```

**NPC System Prompt Template:**

```
You are {character.name}, an NPC in an RPG.

IDENTITY:
High Concept: {character.highConcept}
Trouble: {character.trouble}
Aspects: {character.aspects.join(", ")}

PERSONALITY:
{character.personality.traits.join(", ")}
Speech Pattern: {character.personality.speechPattern}
Values: {character.personality.values.join(", ")}
Fears: {character.personality.fears.join(", ")}

BACKSTORY:
{character.backstory.summary}
Motivation: {character.backstory.motivation}

RELATIONSHIP WITH PLAYER:
{relationship.aspect} (Attitude: {relationship.attitude}/100)
History: {relationship.history}

WHAT YOU KNOW:
- Locations: {character.knowledge.knownLocations.join(", ")}
- People: {character.knowledge.knownCharacters.join(", ")}
- Secrets: {getKnowledgeForTrust(relationship.attitude)}

CURRENT SITUATION:
Location: {situation.currentLocation.name}
Time: {situation.timeOfDay}
Scene: {situation.currentScene.description}

CONSTRAINTS:
- Stay in character at all times
- Only reveal information you actually know
- React based on your personality and relationship
- If asked about something you don't know, you don't know it
- Your attitude can shift based on player actions

RESPONSE FORMAT:
Respond as {character.name} would speak. Include:
- Dialogue (in quotes)
- Brief action/expression (in *asterisks*)
- Internal thought only if relevant (in [brackets])
```

### 3. Player Agent Context (For AI-Controlled Player)

When the player is AI-controlled, it needs different context.

```typescript
interface PlayerAgentContext {
  // Layer 1: System (Player role)
  systemPrompt: string;
  
  // Layer 2: Character Definition
  character: CharacterDefinition;
  
  // Layer 3: Player Goals
  goals: {
    primaryQuest: Quest;
    activeObjectives: Objective[];
    personalGoals: string[];  // From backstory
  };
  
  // Layer 4: Available Information
  knowledge: {
    discoveredLocations: Location[];
    knownNPCs: NPCKnowledge[];
    learnedSecrets: string[];
    currentRumors: string[];
  };
  
  // Layer 5: Current Situation
  currentSituation: {
    location: Location;
    scene: Scene;
    presentNPCs: string[];
    availableActions: Action[];
    recentEvents: Event[];
    gmNarration: string;  // What GM just described
  };
}
```

**Player Agent System Prompt Template:**

```
You are playing {character.name} in an RPG using Fate Core mechanics.

YOUR CHARACTER:
High Concept: {character.highConcept}
Trouble: {character.trouble}
Aspects: {character.aspects.join(", ")}

PERSONALITY (play true to this):
{character.personality.traits.join(", ")}
Speech Pattern: {character.personality.speechPattern}

YOUR GOALS:
Primary: {goals.primaryQuest.currentObjective}
Personal: {character.backstory.motivation}

WHAT YOU KNOW:
- Quest Progress: {summarizeQuestProgress()}
- Known Locations: {knowledge.discoveredLocations.map(l => l.name).join(", ")}
- Known NPCs: {summarizeNPCKnowledge()}
- Rumors: {knowledge.currentRumors.join("; ")}

CURRENT SITUATION:
{currentSituation.gmNarration}

Location: {currentSituation.location.name}
Present: {currentSituation.presentNPCs.join(", ")}
Scene Aspects: {currentSituation.scene.aspects.join(", ")}

YOUR CAPABILITIES:
Skills: {formatSkills(character.skills)}
Stunts: {character.stunts.map(s => s.name).join(", ")}
Fate Points: {character.fatePoints}

AVAILABLE ACTIONS:
{formatAvailableActions(currentSituation.availableActions)}

RESPONSE FORMAT:
State your action clearly:
- What you do (Fate action: Overcome, Create Advantage, etc.)
- What skill you're using (if applicable)
- What you say (if speaking)
- Your intent (what you're trying to achieve)
```

---

## Context Window Management

### Token Budget Allocation

For a typical 8K-16K context window:

```
┌─────────────────────────────────────────┐
│ CONTEXT BUDGET (Example: 8000 tokens)   │
├─────────────────────────────────────────┤
│                                         │
│ System Prompt:        ~800 tokens (10%) │
│ Character Definition: ~1200 tokens (15%)│
│ World State:          ~1600 tokens (20%)│
│ Conversation History: ~2400 tokens (30%)│
│ Current Turn:         ~800 tokens (10%) │
│ Response Buffer:      ~1200 tokens (15%)│
│                                         │
└─────────────────────────────────────────┘
```

### Context Compression Strategies

```typescript
class ContextManager {
  private tokenLimit: number;
  private compressionThreshold: number = 0.8;  // Compress at 80%
  
  buildContext(actor: Actor, situation: Situation): string {
    let context = this.buildFullContext(actor, situation);
    
    if (this.estimateTokens(context) > this.tokenLimit * this.compressionThreshold) {
      context = this.compressContext(context);
    }
    
    return context;
  }
  
  compressContext(context: FullContext): CompressedContext {
    return {
      // Keep system prompt intact
      systemPrompt: context.systemPrompt,
      
      // Compress character to essentials
      character: this.compressCharacter(context.character),
      
      // Summarize world state
      worldState: this.summarizeWorldState(context.worldState),
      
      // Keep only recent history, summarize older
      history: this.compressHistory(context.history),
      
      // Keep current turn intact
      currentTurn: context.currentTurn
    };
  }
  
  compressCharacter(char: CharacterDefinition): CompressedCharacter {
    return {
      name: char.name,
      highConcept: char.highConcept,
      trouble: char.trouble,
      // Only top 3 aspects
      keyAspects: char.aspects.slice(0, 3),
      // Only relevant skills (3+ rating)
      topSkills: Object.entries(char.skills)
        .filter(([_, v]) => v >= 3)
        .map(([k, v]) => `${k}:${v}`),
      // One-line personality
      personalitySummary: char.personality.traits.slice(0, 3).join(", ")
    };
  }
  
  compressHistory(history: Turn[]): CompressedHistory {
    const recent = history.slice(-5);  // Keep last 5 turns detailed
    const older = history.slice(0, -5);
    
    return {
      recentTurns: recent,
      olderSummary: this.summarizeTurns(older)
    };
  }
  
  summarizeTurns(turns: Turn[]): string {
    // Use LLM to summarize or use rule-based extraction
    const keyEvents = turns
      .flatMap(t => t.events)
      .filter(e => e.significance === 'high')
      .map(e => e.summary);
    
    return `Previous events: ${keyEvents.join('; ')}`;
  }
}
```

### Memory and History Management

```typescript
interface ConversationMemory {
  // Short-term: Full detail
  recentTurns: Turn[];           // Last 5-10 turns
  
  // Medium-term: Summarized
  sessionSummary: string;        // AI-generated summary
  keyDecisions: Decision[];      // Important choices
  relationshipChanges: Change[]; // Who likes/dislikes player now
  
  // Long-term: Extracted facts
  learnedFacts: Fact[];          // Things player discovered
  completedObjectives: string[]; // What's been done
  consequencesActive: string[];  // Ongoing effects of past actions
}

class MemoryManager {
  // Periodically compress old history into summaries
  async compressOldHistory(session: Session): Promise<void> {
    const turnsToCompress = session.turns.slice(0, -10);
    
    if (turnsToCompress.length > 20) {
      const summary = await this.llm.summarize(
        turnsToCompress,
        "Summarize these RPG turns, noting: key events, NPC interactions, " +
        "information learned, and any ongoing consequences. Be concise."
      );
      
      session.memory.sessionSummary = summary;
      session.memory.recentTurns = session.turns.slice(-10);
    }
  }
  
  // Extract key facts that should persist
  extractFacts(turn: Turn): Fact[] {
    const facts: Fact[] = [];
    
    for (const event of turn.events) {
      if (event.type === 'knowledge_gain') {
        facts.push({
          type: 'learned',
          content: event.knowledge,
          source: event.source,
          turnId: turn.turnId
        });
      }
      if (event.type === 'relationship_change') {
        facts.push({
          type: 'relationship',
          content: `${event.npc}: ${event.newAttitude}`,
          turnId: turn.turnId
        });
      }
    }
    
    return facts;
  }
}
```

---

## Knowledge Gating

NPCs should only reveal information based on:
1. What they actually know
2. Their relationship with the player
3. The player's approach/roll result

```typescript
class KnowledgeGate {
  // Determine what NPC will share
  getShareableKnowledge(
    npc: NPC,
    player: Player,
    approach: Approach,
    rollResult?: RollResult
  ): ShareableKnowledge {
    
    const relationship = npc.relationships.find(r => r.targetId === player.id);
    const trustLevel = this.calculateTrust(relationship, approach, rollResult);
    
    return {
      // Always share
      publicKnowledge: npc.knowledge.filter(k => k.secrecy === 'public'),
      
      // Share if trust >= 30
      casualKnowledge: trustLevel >= 30 
        ? npc.knowledge.filter(k => k.secrecy === 'casual')
        : [],
      
      // Share if trust >= 60
      privateKnowledge: trustLevel >= 60
        ? npc.knowledge.filter(k => k.secrecy === 'private')
        : [],
      
      // Share if trust >= 90 OR player succeeded with style
      secretKnowledge: (trustLevel >= 90 || rollResult?.successWithStyle)
        ? npc.knowledge.filter(k => k.secrecy === 'secret')
        : [],
      
      // Never share (GM use only)
      hiddenKnowledge: []  // Never included
    };
  }
  
  calculateTrust(
    relationship: Relationship | undefined,
    approach: Approach,
    rollResult?: RollResult
  ): number {
    let trust = relationship?.attitude || 0;
    
    // Approach modifiers
    if (approach === 'friendly') trust += 10;
    if (approach === 'threatening') trust -= 20;
    if (approach === 'deceptive' && !rollResult?.success) trust -= 30;
    
    // Roll modifiers
    if (rollResult) {
      trust += rollResult.shifts * 10;  // Each shift = +10 trust for this interaction
    }
    
    return Math.max(-100, Math.min(100, trust));
  }
}
```

---

## Prompt Templates

### GM Narration Prompt

```
CURRENT SCENE:
{scene.description}
Aspects: {scene.aspects.join(", ")}

PLAYER ACTION:
{player.name} attempts to {action.description}
Using: {action.skill} ({action.skillRating})
Fate Action: {action.fateAction}

ROLL RESULT:
Dice: {roll.dice} = {roll.diceTotal}
Total: {roll.total} vs Difficulty {roll.difficulty}
Outcome: {roll.outcome} ({roll.shifts} shifts)

INSTRUCTION:
Narrate the outcome of this action. Consider:
- The {roll.outcome} result and what it means
- The scene aspects that might be relevant
- Any complications or bonuses from shifts
- Maintain the {theme.tone} tone

Keep narration to 2-3 paragraphs. End with what the player now perceives.
```

### NPC Dialogue Prompt

```
You are {npc.name}.
{npc.personality.speechPattern}

The player just said: "{playerDialogue}"

Your current attitude toward them: {relationship.attitude}/100
What you know that's relevant: {relevantKnowledge}
What you want from this interaction: {npc.currentGoal}

Respond in character. Remember:
- You only know what's in your knowledge list
- Your personality traits: {npc.personality.traits.join(", ")}
- Current mood based on situation: {assessMood(situation)}

If asked about something you don't know, deflect naturally or admit ignorance.
If asked about secrets, only share if trust is high enough.
```

### Player Decision Prompt (AI Player)

```
SITUATION:
{gmNarration}

YOUR STATUS:
Health: {formatStress(player.stress)}
Fate Points: {player.fatePoints}
Relevant Aspects: {getRelevantAspects(situation)}

YOUR OBJECTIVES:
Current: {currentObjective}
How this scene might help: {analyzeOpportunity(situation)}

WHAT YOU NOTICE:
- NPCs present: {presentNPCs.map(formatNPCKnowledge).join("\n")}
- Scene aspects you could use: {scene.aspects}
- Potential threats: {assessThreats(situation)}

CHOOSE YOUR ACTION:
Consider your character's personality ({player.personality.traits.join(", ")})
and your goals. What do you do?

Format: [ACTION TYPE] Description of action
Example: [CREATE ADVANTAGE using Investigate] I search the room for clues about the lab's location.
```

---

## Response Parsing

### Structured Output Schemas

```typescript
// GM Narration Response
interface GMNarrationResponse {
  narration: string;           // The prose description
  mechanicalEffects: {
    aspectsCreated?: string[];
    aspectsRemoved?: string[];
    stressDealt?: { target: string; amount: number };
    consequenceInflicted?: { target: string; severity: string; aspect: string };
    fatePointsAwarded?: { target: string; reason: string };
  };
  sceneChanges?: {
    newAspects?: string[];
    removedAspects?: string[];
    npcsEntered?: string[];
    npcsExited?: string[];
  };
  promptsForPlayer?: string;   // Question or choice presented
}

// NPC Response
interface NPCResponse {
  dialogue: string;            // What they say
  action?: string;             // Physical action
  internalThought?: string;    // For GM knowledge only
  attitudeShift?: number;      // Change in relationship
  informationRevealed?: string[];
  refusalReason?: string;      // If they won't help
}

// Player Action Response (AI Player)
interface PlayerActionResponse {
  actionType: 'overcome' | 'createAdvantage' | 'attack' | 'defend' | 'other';
  skill?: string;
  description: string;
  dialogue?: string;
  intent: string;              // What player hopes to achieve
  aspectsToInvoke?: string[];  // Spending fate points
}
```

### Response Validation

```typescript
class ResponseValidator {
  validateGMResponse(response: any): GMNarrationResponse {
    // Ensure required fields
    if (!response.narration || typeof response.narration !== 'string') {
      throw new ValidationError('GM response must include narration');
    }
    
    // Validate mechanical effects
    if (response.mechanicalEffects) {
      this.validateMechanicalEffects(response.mechanicalEffects);
    }
    
    return response as GMNarrationResponse;
  }
  
  validateNPCResponse(response: any, npc: NPC): NPCResponse {
    // Ensure dialogue exists
    if (!response.dialogue) {
      throw new ValidationError('NPC response must include dialogue');
    }
    
    // Check information revealed is actually known
    if (response.informationRevealed) {
      for (const info of response.informationRevealed) {
        if (!npc.knowledge.includes(info)) {
          console.warn(`NPC revealed unknown info: ${info}`);
          // Could auto-correct or flag for review
        }
      }
    }
    
    return response as NPCResponse;
  }
}
```

---

## Implementation Classes

### ContextBuilder

```typescript
class ContextBuilder {
  buildGMContext(session: Session, currentTurn: Turn): string {
    const layers = [
      this.buildGMSystemPrompt(session.theme),
      this.buildWorldState(session),
      this.buildSessionHistory(session),
      this.buildCurrentSituation(currentTurn)
    ];
    
    return this.assembleAndCompress(layers);
  }
  
  buildNPCContext(npc: NPC, session: Session, interaction: Interaction): string {
    const layers = [
      this.buildNPCSystemPrompt(npc),
      this.buildNPCSituation(npc, session),
      this.buildConversationHistory(npc, session),
      this.buildCurrentInteraction(interaction)
    ];
    
    return this.assembleAndCompress(layers);
  }
  
  buildPlayerContext(player: Player, session: Session): string {
    const layers = [
      this.buildPlayerSystemPrompt(player),
      this.buildPlayerGoals(player, session),
      this.buildPlayerKnowledge(player),
      this.buildCurrentSituation(session)
    ];
    
    return this.assembleAndCompress(layers);
  }
  
  private assembleAndCompress(layers: string[]): string {
    let context = layers.join('\n\n---\n\n');
    
    while (this.tokenEstimate(context) > this.maxTokens) {
      context = this.compressLeastImportant(context);
    }
    
    return context;
  }
}
```

---

## Summary

### Key Principles

1. **Layered Context**: Static → Semi-static → Dynamic → Immediate
2. **Character-Driven**: Personality, backstory, and aspects drive behavior
3. **Knowledge Gating**: NPCs only share what they know and trust allows
4. **Token Management**: Compress intelligently, prioritize recent context
5. **Structured Output**: Parse responses into game-usable data
6. **Consistency**: Same character definition used across all interactions

### Character Elements

| Element | Purpose | Updates |
|---------|---------|---------|
| High Concept | Core identity | Rarely |
| Trouble | Source of complications | Rarely |
| Aspects | Narrative hooks | Per milestone |
| Personality | Behavioral guide | Never |
| Backstory | Context & motivation | Never |
| Skills | Mechanical capability | Per advancement |
| Relationships | Social dynamics | Per interaction |
| Knowledge | Information access | Per discovery |

### Context Priority (When Compressing)

1. **Keep**: Current turn, character identity, immediate situation
2. **Summarize**: Older history, world state details
3. **Drop**: Redundant information, low-relevance aspects
