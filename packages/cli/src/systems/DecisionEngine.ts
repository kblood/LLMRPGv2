import { LLMProvider, ContextBuilder } from '@llmrpg/llm';
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
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1
      });

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
      console.error("Skill selection failed:", error);
      return { name: "Mediocre", rating: 0 };
    }
  }

  async classifyIntent(playerInput: string): Promise<'fate_action' | 'trade' | 'craft' | 'inventory' | 'status'> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Classify the player's intent into one of the following categories:

CATEGORIES:
1. Trade: Buying, selling, or browsing goods at a shop. (e.g., "Buy a sword", "Sell my loot", "What do you have for sale?")
2. Craft: Creating items, potions, or gear. (e.g., "Craft a potion", "Make a sword", "What can I build?")
3. Inventory: Checking carried items or wealth. (e.g., "Check inventory", "What do I have?", "Look in bag")
4. Status: Checking health, stress, or character sheet. (e.g., "Status", "How am I doing?", "Check health")
5. Fate Action: Any other gameplay action (fighting, talking, exploring, moving, using skills).

OUTPUT FORMAT:
Return ONLY the category key: "trade", "craft", "inventory", "status", or "fate_action".`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Player Input: "${playerInput}"\n\nClassify this intent.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1
      });

      const intent = response.content.trim().toLowerCase();
      if (["trade", "craft", "inventory", "status"].includes(intent)) {
        return intent as any;
      }
      return "fate_action";
    } catch (error) {
      console.error("Intent classification failed:", error);
      return "fate_action";
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
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Classify the player's intended action into one of the four Fate Core actions.

ACTIONS:
1. Overcome: Get past an obstacle, solve a problem, or achieve a goal.
2. Create Advantage: Create a new aspect, discover an existing one, or take advantage of one.
3. Attack: Harm another character or object.
4. Defend: Prevent an attack or an advantage from being created.

OUTPUT FORMAT:
Return ONLY the action name in lowercase: "overcome", "create_advantage", "attack", or "defend".`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      worldState: context.worldState ? JSON.stringify(context.worldState, null, 2) : undefined,
      history: context.history,
      immediateContext: `Player Input: "${playerInput}"\n\nClassify this action.`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.1
      });

      const action = response.content.trim().toLowerCase();
      const validActions = ["overcome", "create_advantage", "attack", "defend"];
      
      if (validActions.includes(action)) {
        return action;
      }
      
      // Fallback logic if LLM returns something else
      if (action.includes("attack") || action.includes("fight") || action.includes("hit")) return "attack";
      if (action.includes("defend") || action.includes("block") || action.includes("dodge")) return "defend";
      if (action.includes("create") || action.includes("advantage") || action.includes("assess") || action.includes("notice")) return "create_advantage";
      
      return "overcome";
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

  async decideNPCAction(npc: CharacterDefinition, context: DecisionContext): Promise<{ action: string; description: string; target?: string }> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are controlling an NPC in a Fate Core RPG. Decide their next action in a conflict.

NPC: ${npc.name}
High Concept: ${npc.highConcept}
Trouble: ${npc.trouble}

ACTIONS:
- Attack: Harm the player.
- Create Advantage: Set up a better position or hinder the player.
- Overcome: Move or bypass an obstacle.
- Defend: (Usually reactive, but can be active preparation)

GUIDELINES:
- Act according to personality and goals.
- If aggressive, Attack.
- If tactical, Create Advantage.
- If losing, consider fleeing (Overcome) or conceding.

OUTPUT FORMAT:
JSON with fields:
- action: "attack" | "create_advantage" | "overcome"
- description: string (Narrative description of the action)
- target: string (Target name, usually "Player")`
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
