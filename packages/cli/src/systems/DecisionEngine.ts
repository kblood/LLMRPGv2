import { LLMProvider, ContextBuilder, withRetry, RetryPresets } from '@llmrpg/llm';
import { CharacterDefinition, Turn } from '@llmrpg/core';

export interface DecisionContext {
  action: any;
  player?: CharacterDefinition;
  worldState?: any;
  history?: Turn[];
  targetNPC?: CharacterDefinition;
  factionReputation?: { factionName: string; reputation: number; rank: string }[];
}

export interface WorldUpdate {
  type: 'add_aspect' | 'remove_aspect' | 'modify_feature' | 'add_feature' | 'remove_feature';
  targetId: string; // Location ID or Feature ID
  data?: any; // Aspect name, Feature description, etc.
}

export class DecisionEngine {
  private contextBuilder: ContextBuilder;

  constructor(private llm: LLMProvider) {
    this.contextBuilder = new ContextBuilder();
  }

  async selectSkill(context: DecisionContext): Promise<{ name: string; rating: number }> {
    if (!context.player) {
      return { name: "Mediocre", rating: 0 };
    }

    const skillsList = Object.entries(context.player.skills)
      .map(([name, rating]) => `${name} (${rating >= 0 ? '+' : ''}${rating})`)
      .join(", ");

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Select the most relevant skill for the player's action from their skill list.

SKILLS:
${skillsList}

GUIDELINES:
- Choose the skill that best matches the action description.
- If no skill fits perfectly, choose the closest one or "Mediocre" (0) if it's a default untrained action.
- If the action clearly falls under a specific skill (e.g., "I punch him" -> Fight), use that.

OUTPUT FORMAT:
Return ONLY the exact name of the skill.`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      immediateContext: `Action: "${context.action.description}"\n\nSelect the skill.`
    });

    try {
      const response = await withRetry(
        () => this.llm.generate({
          systemPrompt: prompt.system,
          userPrompt: prompt.user,
          temperature: 0.1
        }),
        RetryPresets.fast
      );

      const skillName = response.content.trim();

      let rating = 0;
      // Handle both Record<string, number> and Array<{name: string, rating/rank: number}>
      if (Array.isArray(context.player.skills)) {
          const skill = context.player.skills.find((s: any) => s.name === skillName);
          rating = skill ? (skill.rating || skill.rank || skill.level || 0) : 0;
      } else {
          rating = (context.player.skills as any)[skillName] || 0;
      }

      return { name: skillName, rating };
    } catch (error) {
      console.error("Skill selection failed after retries:", error);
      return { name: "Mediocre", rating: 0 };
    }
  }

  async classifyIntent(playerInput: string): Promise<'fate_action' | 'dialogue' | 'travel' | 'trade' | 'craft' | 'inventory' | 'status' | 'self_compel' | 'concede' | 'declaration' | 'advance'> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Classify the player's intent into one of the following categories:

CATEGORIES:
1. Travel: Moving to a new location via an exit. (e.g., "I head north", "Go down the passage", "Travel to...").
2. Dialogue: Talking TO or WITH a specific person/NPC. Asking questions, making conversation, negotiating, persuading. (e.g., "Ask the guard about...", "Talk to the merchant", "Tell the cultist...", "I speak with Marcus", "Question the prisoner", "Inquire about...", "Demand to know...", "Chat with...").
3. Trade: Buying, selling, or browsing goods at a shop.
4. Craft: Creating items, potions, or gear.
5. Inventory: Checking carried items or wealth.
6. Status: Checking health, stress, or character sheet.
7. Self Compel: The player explicitly proposes a complication for themselves based on one of their aspects to gain a Fate Point.
8. Concede: Giving up in a conflict to avoid being taken out.
9. Declaration: Spending a Fate Point to declare a story detail without rolling. (e.g., "I spend a FP to declare there's a ladder", "I declare I know this guy", "Spending a fate point to say...").
10. Advance: Spending a milestone to improve the character (e.g., "I want to spend my minor milestone", "Swap my skills", "Buy a new stunt").
11. Teamwork: Helping another character (NPC) with their action. (e.g., "I help Lysandra", "I assist the guard", "Combine efforts with Marcus").
12. Fate Action: Any OTHER gameplay action (fighting, exploring, using skills, examining things, physical actions). NOT dialogue with NPCs - that's category 2.

DIALOGUE VS FATE_ACTION:
- "Ask the cultists about the runes" → DIALOGUE (talking to NPCs)
- "Demand information from the guard" → DIALOGUE (talking to NPCs)
- "Study the ancient runes" → FATE_ACTION (examining objects, not talking)
- "Attack the goblin" → FATE_ACTION (combat)
- "Search the room" → FATE_ACTION (exploration)

OUTPUT FORMAT:
Return ONLY the category key: "dialogue", "travel", "trade", "craft", "inventory", "status", "self_compel", "concede", "declaration", "advance", "teamwork", or "fate_action".`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Player Input: "${playerInput}"\n\nClassify this intent.`
    });

    try {
      const response = await withRetry(
        () => this.llm.generate({
          systemPrompt: prompt.system,
          userPrompt: prompt.user,
          temperature: 0.1
        }),
        RetryPresets.fast
      );

      const intent = response.content.trim().toLowerCase();
      if (["dialogue", "travel", "trade", "craft", "inventory", "status", "self_compel", "concede", "declaration", "advance", "teamwork"].includes(intent)) {
        return intent as any;
      }
      return "fate_action";
    } catch (error) {
      console.error("Intent classification failed after retries:", error);
      return "fate_action";
    }
  }

  async parseTeamwork(playerInput: string, presentNPCs: CharacterDefinition[]): Promise<{ targetName: string; description: string } | null> {
    const npcNames = presentNPCs.map(n => n.name).join(', ');
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Parse the player's teamwork/assistance proposal.

PRESENT NPCS:
${npcNames}

INSTRUCTIONS:
- Identify who the player is trying to help.
- Identify how they are helping.

OUTPUT FORMAT:
Return a JSON object:
{
  "targetName": "Name of the NPC being helped",
  "description": "How the player is helping"
}
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Player Input: "${playerInput}"\n\nParse teamwork.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1,
        jsonMode: true
      });

      return JSON.parse(response.content);
    } catch (error) {
      console.error("Teamwork parsing failed:", error);
      return null;
    }
  }

  async parseDialogue(playerInput: string, presentNPCs: CharacterDefinition[]): Promise<{ targetName: string; topic: string; dialogueType: 'ask' | 'tell' | 'negotiate' | 'intimidate' | 'persuade' | 'chat' } | null> {
    const npcNames = presentNPCs.map(n => n.name).join(', ');
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Parse the player's dialogue request to determine who they're talking to and what about.

PRESENT NPCS:
${npcNames || 'No NPCs present'}

INSTRUCTIONS:
- Identify the NPC the player wants to talk to
- Identify the topic or purpose of the conversation
- Determine the type of dialogue:
  - ask: Seeking information or answers
  - tell: Sharing information with the NPC
  - negotiate: Trying to make a deal or bargain
  - intimidate: Threatening or coercing
  - persuade: Convincing or appealing
  - chat: General friendly conversation

OUTPUT FORMAT:
Return a JSON object:
{
  "targetName": "Name of the NPC (as close a match as possible)",
  "topic": "What they want to discuss",
  "dialogueType": "ask" | "tell" | "negotiate" | "intimidate" | "persuade" | "chat"
}

If no matching NPC or unclear intent, return: null
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Player Input: "${playerInput}"\n\nParse the dialogue request.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1,
        jsonMode: false
      });

      const content = response.content.trim();
      
      // Check if response is "null"
      if (content === 'null' || content === 'null\n' || content.includes('"null"')) {
        return null;
      }

      const parsed = JSON.parse(content);
      
      // Validate the NPC exists in presentNPCs (fuzzy match)
      const matchedNPC = presentNPCs.find(n => 
        n.name.toLowerCase().includes(parsed.targetName.toLowerCase()) ||
        parsed.targetName.toLowerCase().includes(n.name.toLowerCase())
      );
      
      if (matchedNPC) {
        return {
          targetName: matchedNPC.name, // Use the actual NPC name
          topic: parsed.topic,
          dialogueType: parsed.dialogueType || 'ask'
        };
      }
      
      // Allow dialogue even if NPC not in presentNPCs (maybe talking to a group like "cultists")
      return parsed;
    } catch (error) {
      console.error("Dialogue parsing failed:", error);
      return null;
    }
  }

  async parseTravel(playerInput: string, availableExits: Array<{ direction: string; description: string; targetId: string }>): Promise<{ direction: string; targetId: string } | null> {
    if (availableExits.length === 0) {
      return null;
    }

    const exitsDesc = availableExits.map(e => `${e.direction} (${e.description})`).join(', ');
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Parse the player's travel request to identify which direction they want to go.

AVAILABLE EXITS:
${exitsDesc}

INSTRUCTIONS:
- Match the player's input to one of the available exits.
- The direction must be one of: ${availableExits.map(e => e.direction).join(', ')}.
- If the player's intent is ambiguous or matches no exit, return null.

OUTPUT FORMAT:
Return a JSON object:
{
  "direction": "Direction they're heading (e.g., 'north', 'down', 'back')",
  "targetId": "ID of the destination location"
}

If no match is found, respond with: null
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Player Input: "${playerInput}"\n\nDetermine travel direction.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1,
        jsonMode: false
      });

      const content = response.content.trim();
      
      // Check if response is "null"
      if (content === 'null' || content === 'null\n') {
        return null;
      }

      const parsed = JSON.parse(content);

      // Validate parsed direction is not null
      if (!parsed.direction) {
        return null;
      }

      // Validate the direction exists in availableExits
      const exit = availableExits.find(e => e.direction.toLowerCase() === parsed.direction.toLowerCase());
      if (exit) {
        return {
          direction: exit.direction,
          targetId: exit.targetId
        };
      }

      return null;
    } catch (error) {
      console.error("Travel parsing failed:", error);
      return null;
    }
  }

  async parseAdvancement(playerInput: string): Promise<any> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Parse the player's advancement request.

ADVANCEMENT TYPES:
- swap_skills: Swap the ratings of two skills. (Minor)
- rename_aspect: Rename an aspect. (Minor)
- change_stunt: Exchange one stunt for another. (Minor)
- buy_stunt: Buy a new stunt (costs 1 refresh). (Minor)
- increase_skill: Increase a skill rating by one. (Significant)
- buy_skill: Buy a new skill at Average (+1). (Significant)
- rename_consequence: Rename a recovering consequence. (Significant)
- increase_refresh: Gain +1 Refresh. (Major)
- rename_high_concept: Rename High Concept aspect. (Major)
- recover_consequence: Clear a consequence (if time passed). (Significant/Major)

OUTPUT FORMAT:
Return a JSON object matching this structure:
{
  "type": "advancement_type",
  "milestoneRequired": "minor" | "significant" | "major",
  "details": {
    "skillName": "string (optional)",
    "targetSkillName": "string (optional)",
    "aspectName": "string (optional)",
    "newAspectName": "string (optional)",
    "stuntName": "string (optional)",
    "newStuntName": "string (optional)",
    "newStuntDescription": "string (optional)",
    "consequenceName": "string (optional)"
  }
}
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Player Input: "${playerInput}"\n\nParse advancement.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1,
        jsonMode: true
      });

      return JSON.parse(response.content);
    } catch (error) {
      console.error("Advancement parsing failed:", error);
      return null;
    }
  }

  async parseDeclaration(playerInput: string): Promise<string> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Extract the story detail the player is declaring.

Examples:
- "I spend a FP to declare there's a ladder here." -> "There is a ladder here"
- "I declare I know this guy from my past." -> "I know this NPC from the past"

OUTPUT FORMAT:
Return ONLY the declared fact as a short sentence or phrase.`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Player Input: "${playerInput}"\n\nExtract declaration.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1
      });

      return response.content.trim();
    } catch (error) {
      return "Something is true";
    }
  }

  async parseSelfCompel(playerInput: string, player: CharacterDefinition): Promise<{ aspectName: string; description: string } | null> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Parse the player's self-compel proposal.

PLAYER ASPECTS:
${player.aspects.map(a => `- ${a}`).join('\n')}

INSTRUCTIONS:
- Identify which aspect the player is trying to compel.
- Identify the proposed complication/description.
- If the aspect is not clear, pick the most likely one from the list.

OUTPUT FORMAT:
Return a JSON object:
{
  "aspectName": "Name of the aspect",
  "description": "The complication description"
}
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: player,
      immediateContext: `Player Input: "${playerInput}"\n\nParse self-compel.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1,
        jsonMode: true
      });

      return JSON.parse(response.content);
    } catch (error) {
      console.error("Self-compel parsing failed:", error);
      return null;
    }
  }

  async parseTradeIntent(playerInput: string): Promise<{ type: 'buy' | 'sell' | 'list'; itemName?: string; quantity?: number }> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Parse the player's trading intent.

OUTPUT FORMAT:
Return a JSON object with:
- type: "buy", "sell", or "list"
- itemName: (string, optional) The name of the item to buy/sell
- quantity: (number, optional) The quantity (default 1)

Examples:
"Buy a sword" -> {"type": "buy", "itemName": "sword", "quantity": 1}
"Sell 5 potions" -> {"type": "sell", "itemName": "potion", "quantity": 5}
"What do you have?" -> {"type": "list"}
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Player Input: "${playerInput}"\n\nParse trade intent.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1,
        jsonMode: true
      });

      return JSON.parse(response.content);
    } catch (error) {
      console.error("Trade intent parsing failed:", error);
      return { type: 'list' };
    }
  }

  async parseCraftIntent(playerInput: string): Promise<{ type: 'craft' | 'list'; recipeName?: string }> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Parse the player's crafting intent.

OUTPUT FORMAT:
Return a JSON object with:
- type: "craft" or "list"
- recipeName: (string, optional) The name of the item/recipe to craft

Examples:
"Craft a potion" -> {"type": "craft", "recipeName": "potion"}
"Make a sword" -> {"type": "craft", "recipeName": "sword"}
"What can I make?" -> {"type": "list"}
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Player Input: "${playerInput}"\n\nParse crafting intent.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1,
        jsonMode: true
      });

      return JSON.parse(response.content);
    } catch (error) {
      console.error("Craft intent parsing failed:", error);
      return { type: 'list' };
    }
  }

  async classifyAction(playerInput: string, context: DecisionContext): Promise<string> {
    // Extract present NPCs from world state for combat context
    const presentNPCs = context.worldState?.currentLocation?.presentNPCs || [];
    const hostileNPCs = presentNPCs.filter((npc: any) => 
      npc.disposition === 'hostile' || npc.hostile === true
    );
    const hasHostileTargets = hostileNPCs.length > 0;
    const npcNames = presentNPCs.map((npc: any) => npc.name || npc).join(', ');

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Classify the player's intended action into one of the four Fate Core actions.

ACTIONS:
1. Overcome: Get past an obstacle, solve a problem, move somewhere, explore, or achieve a non-combat goal.
   Examples: walking, running, climbing, jumping, opening doors, navigating, searching, examining, picking locks
2. Create Advantage: Create a new aspect, discover information, assess a situation, or set up for future actions.
   Examples: looking around, noticing details, preparing, finding weaknesses, creating distractions
3. Attack: ONLY use when explicitly trying to harm a specific, named target that is PRESENT in the scene.
   Examples: "punch the guard", "shoot the bandit", "stab Marcus" (requires a valid target!)
4. Defend: Prevent an attack or an advantage from being created against you.
   Examples: blocking, dodging, parrying, resisting influence

CRITICAL RULES FOR ATTACK:
- Attack requires an EXPLICIT TARGET that the player names or clearly indicates
- Attack requires the target to be PRESENT at the current location
- Movement actions (walk, run, go, move, travel, head, proceed) are NEVER attacks - they are Overcome
- Exploration actions (look, search, examine, investigate) are NEVER attacks - they are Overcome or Create Advantage
- If no valid target is named, it is NOT an attack

CURRENT SCENE CONTEXT:
${npcNames ? `NPCs present: ${npcNames}` : 'No NPCs present at current location'}
${hasHostileTargets ? `Hostile NPCs: ${hostileNPCs.map((n: any) => n.name || n).join(', ')}` : 'No hostile NPCs present'}

OUTPUT FORMAT:
Return ONLY the action name in lowercase: "overcome", "create_advantage", "attack", or "defend".`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      worldState: context.worldState ? JSON.stringify(context.worldState, null, 2) : undefined,
      history: context.history,
      immediateContext: `Player Input: "${playerInput}"\n\nClassify this action based on the rules above.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1
      });

      let action = response.content.trim().toLowerCase();
      const validActions = ["overcome", "create_advantage", "attack", "defend"];
      
      // Normalize response
      if (!validActions.includes(action)) {
        // Fallback logic if LLM returns something else
        if (action.includes("attack") || action.includes("fight") || action.includes("hit")) action = "attack";
        else if (action.includes("defend") || action.includes("block") || action.includes("dodge")) action = "defend";
        else if (action.includes("create") || action.includes("advantage") || action.includes("assess") || action.includes("notice")) action = "create_advantage";
        else action = "overcome";
      }
      
      // POST-CLASSIFICATION VALIDATION: Prevent attack misclassification
      if (action === "attack") {
        const inputLower = playerInput.toLowerCase();
        
        // Check for movement/exploration verbs that should NEVER be attacks
        const nonCombatVerbs = [
          'walk', 'run', 'go', 'move', 'travel', 'head', 'proceed', 'continue',
          'look', 'search', 'examine', 'investigate', 'explore', 'check',
          'enter', 'exit', 'leave', 'approach', 'return', 'climb', 'descend',
          'open', 'close', 'push', 'pull', 'turn', 'use'
        ];
        
        const hasNonCombatVerb = nonCombatVerbs.some(verb => 
          inputLower.startsWith(verb) || 
          inputLower.includes(` ${verb} `) ||
          inputLower.includes(` ${verb}`)
        );
        
        // Check if any present NPC is mentioned in the input
        const mentionsPresenceNPC = presentNPCs.some((npc: any) => {
          const npcName = (npc.name || npc || '').toLowerCase();
          return npcName && inputLower.includes(npcName.toLowerCase());
        });
        
        // Check for combat-indicating words
        const combatWords = ['attack', 'fight', 'hit', 'strike', 'punch', 'kick', 'stab', 'slash', 'shoot', 'kill', 'hurt', 'harm', 'damage'];
        const hasCombatWord = combatWords.some(word => inputLower.includes(word));
        
        // Override attack classification if:
        // 1. Uses movement/exploration verbs AND doesn't mention an NPC
        // 2. No combat words present AND no hostile targets AND no NPC mentioned
        if (hasNonCombatVerb && !mentionsPresenceNPC && !hasCombatWord) {
          action = "overcome";
        } else if (!hasCombatWord && !hasHostileTargets && !mentionsPresenceNPC) {
          // No combat words, no hostile targets, no NPC mentioned - probably not an attack
          action = "overcome";
        }
      }
      
      return action;
    } catch (error) {
      console.error("Action classification failed:", error);
      return "overcome";
    }
  }

  async setOpposition(context: DecisionContext): Promise<number> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Determine the difficulty of actions based on the Fate Ladder.

FATE LADDER:
+8 Legendary
+7 Epic
+6 Fantastic
+5 Superb
+4 Great
+3 Good
+2 Fair
+1 Average
0 Mediocre
-1 Poor
-2 Terrible

GUIDELINES:
- Average (+1) is routine for competent people.
- Fair (+2) is a challenge for professionals.
- Great (+4) is a serious challenge.

CONTEXT:
${context.targetNPC ? `Target NPC: ${context.targetNPC.name}` : ''}
${context.factionReputation ? `Faction Reputation: ${context.factionReputation.map(f => `${f.factionName}: ${f.rank} (${f.reputation})`).join(', ')}` : ''}
If the player has poor reputation with the target's faction, increase difficulty for social actions.

OUTPUT FORMAT:
Return ONLY the integer number (e.g., 2).`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      worldState: context.worldState ? JSON.stringify(context.worldState, null, 2) : undefined,
      history: context.history,
      immediateContext: `Determine the difficulty for this action:\n${JSON.stringify(context.action)}\n\nReturn only a number representing the difficulty on the Fate Ladder (e.g., 2 for Fair, 4 for Great).`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.3
      });

      const difficulty = parseInt(response.content.trim());
      return isNaN(difficulty) ? 2 : difficulty;
    } catch (error) {
      console.error("Decision generation failed:", error);
      return 2; // Default to Fair
    }
  }

  async decideNPCAction(npc: CharacterDefinition, context: DecisionContext, side: 'player' | 'opposition' = 'opposition'): Promise<{ action: string; description: string; target?: string }> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are controlling an NPC in a Fate Core RPG. Decide their next action in a conflict.

NPC: ${npc.name}
SIDE: ${side === 'player' ? 'Ally of the Player' : 'Enemy of the Player'}
High Concept: ${npc.highConcept}
Trouble: ${npc.trouble}

ACTIONS:
- Attack: Harm the enemy.
- Create Advantage: Set up a better position or hinder the enemy.
- Overcome: Move or bypass an obstacle.
- Defend: (Usually reactive, but can be active preparation)

GUIDELINES:
- Act according to personality and goals.
- If aggressive, Attack.
- If tactical, Create Advantage.
- If losing, consider fleeing (Overcome) or conceding.
- If Ally: Help the player or attack the player's enemies.
- If Enemy: Attack the player or their allies.

OUTPUT FORMAT:
JSON with fields:
- action: "attack" | "create_advantage" | "overcome"
- description: string (Narrative description of the action)
- target: string (Target name)`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: npc, // Use NPC as the character context
      worldState: context.worldState ? JSON.stringify(context.worldState, null, 2) : undefined,
      history: context.history,
      immediateContext: `It is ${npc.name}'s turn. The player is present. Decide the action.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.7,
        jsonMode: true
      });

      return JSON.parse(response.content);
    } catch (error) {
      console.error("NPC decision failed:", error);
      return { action: "attack", description: `${npc.name} attacks blindly!`, target: "Player" };
    }
  }

  async determineKnowledgeGain(context: DecisionContext, outcome: string): Promise<any | null> {
    if (outcome === 'failure') return null;

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Determine if the player gained any new knowledge from their action.

CONTEXT:
Action: ${context.action.description}
Outcome: ${outcome}

INSTRUCTIONS:
- If the action was about gathering information (investigating, searching, talking) and it was successful, generate a knowledge update.
- If no significant knowledge was gained, return null.

OUTPUT FORMAT:
Return a JSON object representing the knowledge gained, or null if nothing was learned.
The JSON should follow this structure:
{
  "category": "locations" | "npcs" | "quests" | "factions" | "secrets" | "items" | "topics",
  "id": "string (unique identifier, e.g., 'loc-sewers', 'npc-luna')",
  "data": {
    "name": "Name of the thing",
    "details": "What was learned",
    "known": true,
    "confidence": "high"
  }
}
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      worldState: context.worldState ? JSON.stringify(context.worldState, null, 2) : undefined,
      history: context.history,
      immediateContext: `Action: "${context.action.description}"\nOutcome: ${outcome}\n\nDid they learn anything?`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1
      });

      const content = response.content.trim();
      if (content === 'null' || content.toLowerCase() === 'no') return null;

      try {
        return JSON.parse(content);
      } catch (e) {
        console.warn("Failed to parse knowledge gain JSON:", content);
        return null;
      }
    } catch (error) {
      console.error("Knowledge determination failed:", error);
      return null;
    }
  }

  async determineQuestUpdate(context: DecisionContext, outcome: string): Promise<any> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Analyze the player's action and the outcome to determine if any quests are affected.

GUIDELINES:
- Check if the action satisfies any active quest objectives.
- Check if the action triggers a new quest.
- Check if the action fails a quest.
- If a new quest is started, provide title, description, and objectives.

OUTPUT FORMAT:
Return a JSON object with the update details, or null if no update.
Types: "new", "update_objective", "complete_quest", "fail_quest"

Example (Update):
{
  "type": "update_objective",
  "questId": "quest-123",
  "objectiveId": "obj-1",
  "count": 1, // Amount to ADD to current count
  "status": "completed" // Optional, force status
}

Example (New):
{
  "type": "new",
  "quest": {
    "id": "generated-id", // Suggest an ID
    "title": "Quest Title",
    "description": "Quest Description",
    "objectives": [
      { "id": "obj-1", "description": "Do the thing", "type": "custom", "requiredCount": 1 }
    ]
  }
}
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      worldState: context.worldState ? JSON.stringify(context.worldState, null, 2) : undefined,
      history: context.history,
      immediateContext: `Action: "${context.action.description}"\nOutcome: ${outcome}\n\nAre there any quest updates? Return JSON or null.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1,
        jsonMode: true
      });

      const content = response.content.trim();
      if (content === 'null' || content.toLowerCase() === 'no') return null;

      try {
        return JSON.parse(content);
      } catch (e) {
        console.warn("Failed to parse quest update JSON:", content);
        return null;
      }
    } catch (error) {
      console.error("Quest determination failed:", error);
      return null;
    }
  }

  async identifyTarget(context: DecisionContext): Promise<string | null> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `Identify the target of the player's action.

CONTEXT:
World State: ${JSON.stringify(context.worldState, null, 2)}

INSTRUCTIONS:
- Return the name of the NPC or Object being targeted.
- If no specific target, return "null".
- If targeting the environment/scene, return "scene".

OUTPUT FORMAT:
Return ONLY the target name or "null".`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      immediateContext: `Action: "${context.action.description}"\n\nIdentify target.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1
      });
      
      const target = response.content.trim();
      return target.toLowerCase() === "null" ? null : target;
    } catch (error) {
      return null;
    }
  }

  async generateCompel(context: DecisionContext): Promise<any | null> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Determine if a Compel is appropriate for the player based on their Aspects and the current situation.

FATE CORE COMPEL RULES:
- A Compel complicates the player's life due to one of their Aspects.
- It offers a Fate Point in exchange for the complication.
- Types:
  1. Decision Compel: The aspect forces a specific decision (e.g., "Because you are 'Stubborn', you refuse to back down.").
  2. Event Compel: The aspect causes an external complication (e.g., "Because you have 'Enemies in High Places', the guard recognizes you.").

PLAYER ASPECTS:
${context.player?.aspects.map(a => `- ${a}`).join('\n')}

INSTRUCTIONS:
- Only generate a compel if it makes narrative sense and adds drama.
- Do NOT generate a compel every turn. Only when relevant.
- If no compel is appropriate, return null.

OUTPUT FORMAT:
Return a JSON object or null:
{
  "aspectName": "Name of the aspect being compelled",
  "type": "decision" | "event",
  "description": "The complication being introduced",
  "reasoning": "Why this compel fits the narrative"
}
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      worldState: context.worldState ? JSON.stringify(context.worldState, null, 2) : undefined,
      history: context.history,
      immediateContext: `Current Situation: The player is acting in the scene.\n\nIs there a relevant Compel? Return JSON or null.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.3,
        jsonMode: true
      });

      const content = response.content.trim();
      if (content === 'null' || content.toLowerCase() === 'no') return null;

      return JSON.parse(content);
    } catch (error) {
      console.error("Compel generation failed:", error);
      return null;
    }
  }

  /**
   * Generate a proactive compel description based on the player's trouble aspect
   * and their recent failures. This helps break failure spirals by offering
   * the player a Fate Point in exchange for a complication.
   */
  async generateProactiveCompelDescription(
    troubleAspect: string,
    recentFailures: string,
    sceneDescription: string
  ): Promise<string | null> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. The player has failed multiple times in a row and seems stuck.
This is an opportunity to offer a COMPEL on their TROUBLE aspect to give them a Fate Point and introduce a complication that changes the situation.

PLAYER'S TROUBLE ASPECT: ${troubleAspect}

RECENT FAILURES:
${recentFailures}

CURRENT SCENE:
${sceneDescription}

INSTRUCTIONS:
Generate a COMPELLING complication that:
1. Directly relates to the trouble aspect "${troubleAspect}"
2. Changes the situation in a way that opens new options for the player
3. Introduces drama and narrative interest
4. Gives the player a chance to do something different

The complication should feel like a natural consequence of their aspect, not random bad luck.
It should create NEW opportunities, not just pile on more failures.

OUTPUT FORMAT:
Return ONLY a single sentence or short paragraph describing the complication.
Example: "Your Shattered Legacy catches up with you - an old associate appears, demanding repayment of a debt. You'll need to deal with them before you can continue."
`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Generate a proactive compel for the trouble aspect "${troubleAspect}".`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.7 // Higher temp for creative complications
      });

      const content = response.content.trim();
      if (!content || content === 'null') return null;

      return content;
    } catch (error) {
      console.error("Proactive compel generation failed:", error);
      return null;
    }
  }

  async generateBoostName(context: DecisionContext): Promise<string> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. The player has succeeded with style and earned a Boost (a temporary advantage).
Generate a short, punchy name for this Boost based on the action.

Examples:
- Action: "I slash at the goblin" -> "Off Balance" or "Momentum"
- Action: "I search the room" -> "Clue Found" or "Eye for Detail"
- Action: "I run away" -> "Head Start"

OUTPUT FORMAT:
Return ONLY the name of the boost.`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      immediateContext: `Action: "${context.action.description}"\n\nGenerate Boost Name.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.3
      });

      return response.content.trim();
    } catch (error) {
      return "Momentum";
    }
  }

  async determineWorldUpdates(context: DecisionContext, outcome: string): Promise<WorldUpdate[]> {
    if (outcome === 'fail') return [];

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `Analyze the action's impact on the world state.

CONTEXT:
Action: ${context.action.description}
Outcome: ${outcome}
World State: ${JSON.stringify(context.worldState, null, 2)}

INSTRUCTIONS:
- Determine if the action physically changed the environment (e.g., broke a door, lit a fire, dropped an item).
- Determine if a new situational aspect was created (e.g., "On Fire", "Crowded").
- Ignore minor changes that don't affect gameplay.

OUTPUT FORMAT:
JSON array of updates:
[
  { "type": "add_aspect", "targetId": "location_id", "data": { "name": "Aspect Name", "type": "situational" } },
  { "type": "modify_feature", "targetId": "feature_name", "data": { "description": "New description" } },
  ...
]
Return empty array [] if no significant changes.`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      immediateContext: `Action: "${context.action.description}"\nOutcome: ${outcome}\n\nDetermine world updates.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1,
        jsonMode: true
      });

      return JSON.parse(response.content);
    } catch (error) {
      return [];
    }
  }
}
