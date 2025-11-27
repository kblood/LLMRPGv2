import { LLMProvider, ContextBuilder } from '@llmrpg/llm';
import { CharacterDefinition, Turn } from '@llmrpg/core';

export interface NarrativeContext {
  events: any[];
  player?: CharacterDefinition;
  worldState?: any;
  history?: Turn[];
  actionResolution?: ActionResolutionContext;
}

export interface ActionResolutionContext {
  playerAction: string;
  playerReasoning?: string;
  fateAction: string;
  skill: string;
  skillRating: number;
  difficulty: number;
  roll: number;
  shifts: number;
  outcome: 'success_with_style' | 'success' | 'tie' | 'failure';
  targetName?: string;
}

export class NarrativeEngine {
  private contextBuilder: ContextBuilder;

  constructor(private llm: LLMProvider) {
    this.contextBuilder = new ContextBuilder();
  }

  /**
   * Narrate the resolution of a player action
   * This is the main GM narration method that describes what happens
   */
  async narrateActionResolution(context: NarrativeContext): Promise<string> {
    const { events, player, worldState, actionResolution } = context;
    
    if (!actionResolution) {
      return this.narrate(context);
    }

    const { 
      playerAction, 
      playerReasoning,
      fateAction, 
      skill, 
      skillRating, 
      difficulty, 
      roll, 
      shifts, 
      outcome,
      targetName 
    } = actionResolution;

    // Get outcome description
    const outcomeDescriptions: Record<string, string> = {
      'success_with_style': 'brilliant success (with style!)',
      'success': 'success',
      'tie': 'a close tie (success at a cost)',
      'failure': 'failure'
    };

    const locationName = worldState?.currentLocation?.name || 'the area';
    const locationAspects = worldState?.currentLocation?.aspects?.map((a: any) => a.name || a) || [];

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master narrating an RPG scene using Fate Core mechanics.

YOUR ROLE:
- Describe what happens as a result of the player's action
- Bring the scene to life with sensory details
- Reflect the mechanical outcome in your narration
- Maintain a consistent tone and atmosphere
- Show consequences (both positive and negative)
- Include NPC reactions when relevant

NARRATION GUIDELINES:
- Write in second person ("You...", "Your...")
- Be vivid but concise (2-4 paragraphs max)
- Match narrative drama to the roll result
- Success with Style = exceptional, memorable moment
- Success = competent execution, goal achieved
- Tie = success but with complication or cost
- Failure = something goes wrong, but keep it interesting

CURRENT SCENE:
Location: ${locationName}
${locationAspects.length > 0 ? `Scene Aspects: ${locationAspects.join(', ')}` : ''}
${targetName ? `Target/Focus: ${targetName}` : ''}

MECHANICAL RESULT:
- Action Type: ${fateAction}
- Skill Used: ${skill} (+${skillRating})
- Difficulty: ${difficulty}
- Roll Result: ${roll >= 0 ? '+' : ''}${roll} (with skill: ${roll + skillRating})
- Shifts: ${shifts}
- Outcome: ${outcomeDescriptions[outcome] || outcome}

DO NOT:
- Mention dice, numbers, or game mechanics directly
- Say "you rolled" or reference the Fate system
- Control what the player decides to do next
- Break immersion with meta-commentary`
    );

    const userPrompt = `THE PLAYER'S ACTION:
"${playerAction}"

${playerReasoning ? `PLAYER'S INTENT: ${playerReasoning}\n` : ''}

EVENTS THAT OCCURRED:
${events.map(e => `- ${e.description || e.action}`).join('\n')}

Narrate what happens as a result. Describe the ${outcomeDescriptions[outcome] || outcome} in a dramatic, immersive way.`;

    try {
      const response = await this.llm.generate({
        systemPrompt,
        userPrompt,
        temperature: 0.8
      });

      return response.content;
    } catch (error) {
      console.error("Action resolution narration failed:", error);
      return this.getFallbackNarration(outcome, playerAction);
    }
  }

  /**
   * General narration for events (legacy method)
   */
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

  /**
   * Generate a scene introduction when entering a new location
   */
  async narrateSceneIntro(location: any, player?: CharacterDefinition): Promise<string> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master introducing a new scene. Set the atmosphere and describe what the player perceives.

GUIDELINES:
- Use vivid sensory details (sight, sound, smell, etc.)
- Hint at points of interest without being too explicit
- Establish the mood and tone
- Mention notable NPCs if present
- Be concise but evocative (1-2 paragraphs)`
    );

    const presentNPCs = location.presentNPCs?.map((n: any) => n.name || n) || [];
    const aspects = location.aspects?.map((a: any) => a.name || a) || [];
    const features = location.features?.map((f: any) => f.name || f.description || f) || [];

    const userPrompt = `LOCATION: ${location.name}
${location.description || ''}

${aspects.length > 0 ? `SCENE ASPECTS: ${aspects.join(', ')}` : ''}
${features.length > 0 ? `NOTABLE FEATURES: ${features.join(', ')}` : ''}
${presentNPCs.length > 0 ? `PEOPLE PRESENT: ${presentNPCs.join(', ')}` : 'The area appears empty.'}

Describe this scene as the player enters.`;

    try {
      const response = await this.llm.generate({
        systemPrompt,
        userPrompt,
        temperature: 0.7
      });

      return response.content;
    } catch (error) {
      console.error("Scene intro narration failed:", error);
      return `You find yourself in ${location.name}.`;
    }
  }

  private getFallbackNarration(outcome: string, action: string): string {
    switch (outcome) {
      case 'success_with_style':
        return `Your attempt to ${action} succeeds brilliantly, exceeding all expectations.`;
      case 'success':
        return `You manage to ${action} successfully.`;
      case 'tie':
        return `You ${action}, but not without some difficulty or complication.`;
      case 'failure':
        return `Your attempt to ${action} doesn't go as planned.`;
      default:
        return `You attempt to ${action}. The outcome is uncertain.`;
    }
  }
}

