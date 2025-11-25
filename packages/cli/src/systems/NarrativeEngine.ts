import { LLMProvider, ContextBuilder } from '@llmrpg/llm';
import { CharacterDefinition, Turn } from '@llmrpg/core';

export interface NarrativeContext {
  events: any[];
  player?: CharacterDefinition;
  worldState?: any;
  history?: Turn[];
}

export class NarrativeEngine {
  private contextBuilder: ContextBuilder;

  constructor(private llm: LLMProvider) {
    this.contextBuilder = new ContextBuilder();
  }

  async narrate(context: NarrativeContext): Promise<string> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master for an RPG using Fate Core mechanics.

ROLE:
- Narrate the world and NPCs (but not player actions)
- Set scene aspects and opposition difficulties
- Decide when to compel player aspects
- Create dramatic complications and rewards
- Maintain consistent world and NPC behavior

RULES:
- Use Fate Core's four actions: Overcome, Create Advantage, Attack, Defend
- The Ladder: Terrible(-2) to Legendary(+8)
- Players can invoke aspects for +2 or reroll
- You can compel aspects (offer fate point for complication)
- Stress absorbs damage, consequences create aspects

CONSTRAINTS:
- Never control player character's decisions
- NPCs act according to their defined personality and knowledge
- Maintain information barriers (NPCs only know what they know)
- Respect established continuity
- Be descriptive but concise.`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      worldState: context.worldState ? JSON.stringify(context.worldState, null, 2) : undefined,
      history: context.history,
      immediateContext: `Events to narrate:\n${JSON.stringify(context.events, null, 2)}`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.7
      });

      return response.content;
    } catch (error) {
      console.error("Narrative generation failed:", error);
      return "The Game Master is silent. (Error generating narrative)";
    }
  }
}
