import { LLMProvider, ContextBuilder } from '@llmrpg/llm';
import { CharacterDefinition, Turn } from '@llmrpg/core';

export interface DecisionContext {
  action: any;
  player?: CharacterDefinition;
  worldState?: any;
  history?: Turn[];
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
      const rating = context.player.skills[skillName] || 0;
      
      return { name: skillName, rating };
    } catch (error) {
      console.error("Skill selection failed:", error);
      return { name: "Mediocre", rating: 0 };
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
- Superb (+5) and above are heroic feats.

Output ONLY the number representing the difficulty.`
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
}
