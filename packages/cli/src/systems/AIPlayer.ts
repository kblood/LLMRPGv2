import { LLMProvider, ContextBuilder } from '@llmrpg/llm';
import { CharacterDefinition, Turn } from '@llmrpg/core';

export interface AIPlayerContext {
  player: CharacterDefinition;
  worldState: any;
  history?: Turn[];
  currentScene?: any;
  objectives?: string[];
  lastNarration?: string;
}

export interface AIPlayerAction {
  action: string;
  reasoning: string;
  strategy?: string;
  expectedOutcome?: string;
}

/**
 * AIPlayer - An LLM-controlled player character that explains its reasoning
 * 
 * This system allows the AI to play as the character, making decisions
 * based on the character's personality, goals, and current situation.
 * It provides transparent reasoning for each action taken.
 */
export class AIPlayer {
  private contextBuilder: ContextBuilder;

  constructor(private llm: LLMProvider) {
    this.contextBuilder = new ContextBuilder();
  }

  /**
   * Decide what action the AI player should take next
   * Returns both the action and the reasoning behind it
   */
  async decideAction(context: AIPlayerContext): Promise<AIPlayerAction> {
    const { player, worldState, history, currentScene, objectives, lastNarration } = context;

    // Build character context
    const aspectsList = player.aspects?.join(', ') || 'Unknown aspects';
    const skillsList = typeof player.skills === 'object' && !Array.isArray(player.skills)
      ? Object.entries(player.skills).map(([name, rating]) => `${name}: +${rating}`).join(', ')
      : Array.isArray(player.skills) 
        ? (player.skills as any[]).map(s => `${s.name}: +${s.rating || s.rank || 0}`).join(', ')
        : 'Unknown skills';

    // Get current location info
    const locationName = worldState?.currentLocation?.name || currentScene?.name || 'Unknown location';
    const locationDescription = worldState?.currentLocation?.description || currentScene?.description || '';
    const presentNPCs = worldState?.currentLocation?.presentNPCs || currentScene?.npcsPresent || [];
    const locationFeatures = worldState?.currentLocation?.features || [];
    const locationAspects = worldState?.currentLocation?.aspects || currentScene?.aspects || [];

    // Build objectives string
    const objectivesText = objectives && objectives.length > 0
      ? `CURRENT OBJECTIVES:\n${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
      : 'OBJECTIVE: Explore and discover opportunities';

    // Build recent history summary
    const recentHistory = history?.slice(-5).map(t => {
      const eventSummary = t.events?.map(e => e.description || e.action).join('; ') || 'Unknown action';
      return `Turn ${t.turnNumber}: ${eventSummary}`;
    }).join('\n') || 'No previous actions';

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Player Character",
      `You are role-playing as ${player.name}, a character in a Fate Core RPG.

YOUR CHARACTER:
- High Concept: ${player.highConcept}
- Trouble: ${player.trouble}
- Aspects: ${aspectsList}
- Skills: ${skillsList}
- Personality: ${player.personality?.traits?.join(', ') || 'Unknown'}

YOUR ROLE:
You must decide what action to take next, staying true to your character's personality and goals.
Think like your character would think. Consider:
1. What does my character want right now?
2. What would my character notice in this situation?
3. How would my character's personality affect their choice?
4. What skills can I leverage?
5. Are there any dangers or opportunities?

ACTION TYPES (Fate Core):
- Overcome: Get past obstacles, solve problems, travel, search, investigate
- Create Advantage: Gather information, prepare, set up aspects, assess situations
- Attack: Only when in combat with a valid hostile target present
- Defend: Only when being attacked or resisting something

GUIDELINES:
- Be proactive and curious - explore, interact, investigate
- Stay in character - use your aspects and personality
- Don't repeat the same action multiple times
- Consider your objectives but also react to the current situation
- If someone is talking to you, respond appropriately
- Be specific about what you're doing, not vague

OUTPUT FORMAT:
You must respond with a JSON object containing:
{
  "action": "The specific action you take (what you say or do)",
  "reasoning": "Your character's internal thoughts explaining WHY you chose this action (1-2 sentences)",
  "strategy": "Your tactical thinking about HOW this helps your goals (optional)",
  "expectedOutcome": "What you hope to achieve (optional)"
}`
    );

    const userPrompt = `CURRENT SITUATION:
Location: ${locationName}
${locationDescription}

${locationAspects.length > 0 ? `Scene Aspects: ${locationAspects.map((a: any) => a.name || a).join(', ')}` : ''}
${presentNPCs.length > 0 ? `People Present: ${presentNPCs.map((n: any) => n.name || n).join(', ')}` : 'You are alone.'}
${locationFeatures.length > 0 ? `Notable Features: ${locationFeatures.map((f: any) => f.name || f.description || f).join(', ')}` : ''}

${objectivesText}

RECENT HISTORY:
${recentHistory}

${lastNarration ? `LAST NARRATION FROM GM:\n"${lastNarration}"\n` : ''}

What do you do next? Respond with a JSON object containing your action and reasoning.`;

    try {
      const response = await this.llm.generate({
        systemPrompt,
        userPrompt,
        temperature: 0.8,
        jsonMode: true
      });

      const parsed = JSON.parse(response.content);
      
      return {
        action: parsed.action || "I look around carefully.",
        reasoning: parsed.reasoning || "Assessing the situation before acting.",
        strategy: parsed.strategy,
        expectedOutcome: parsed.expectedOutcome
      };
    } catch (error) {
      console.error("AI Player decision failed:", error);
      // Fallback action
      return {
        action: "I observe my surroundings carefully.",
        reasoning: "When uncertain, it's best to gather more information.",
        strategy: "Assessment before action"
      };
    }
  }

  /**
   * Generate a reaction to an event (used for dialogue or special situations)
   */
  async react(context: AIPlayerContext, event: string): Promise<AIPlayerAction> {
    const { player } = context;

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Player Character",
      `You are ${player.name}. React to the following event in character.

YOUR CHARACTER:
- High Concept: ${player.highConcept}
- Trouble: ${player.trouble}
- Personality: ${player.personality?.traits?.join(', ') || 'Unknown'}

Respond naturally as your character would. Consider their personality, background, and current goals.

OUTPUT FORMAT:
{
  "action": "Your reaction (what you say or do)",
  "reasoning": "Brief internal thought explaining your reaction"
}`
    );

    try {
      const response = await this.llm.generate({
        systemPrompt,
        userPrompt: `EVENT: ${event}\n\nHow do you react?`,
        temperature: 0.8,
        jsonMode: true
      });

      const parsed = JSON.parse(response.content);
      return {
        action: parsed.action || "I pause to consider this.",
        reasoning: parsed.reasoning || "Processing the situation."
      };
    } catch (error) {
      console.error("AI Player reaction failed:", error);
      return {
        action: "I consider the situation carefully.",
        reasoning: "Taking a moment to think."
      };
    }
  }

  /**
   * Generate dialogue response when an NPC speaks to the player
   */
  async respondToDialogue(context: AIPlayerContext, npcName: string, npcDialogue: string): Promise<AIPlayerAction> {
    const { player, worldState } = context;

    // Find NPC info if available
    const npcs = worldState?.currentLocation?.presentNPCs || [];
    const npc = npcs.find((n: any) => (n.name || n) === npcName);

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Player Character",
      `You are ${player.name}. An NPC is speaking to you. Respond in character.

YOUR CHARACTER:
- High Concept: ${player.highConcept}
- Trouble: ${player.trouble}
- Personality: ${player.personality?.traits?.join(', ') || 'Unknown'}
- Speaking Style: ${player.personality?.speechPattern || 'Normal'}

${npc ? `NPC INFO: ${npc.name} - ${npc.highConcept || 'Unknown'}` : ''}

Respond as your character would speak. Match your personality and speech pattern.

OUTPUT FORMAT:
{
  "action": "Your spoken response (in quotes) and any physical actions",
  "reasoning": "Why you're responding this way"
}`
    );

    try {
      const response = await this.llm.generate({
        systemPrompt,
        userPrompt: `${npcName} says: "${npcDialogue}"\n\nHow do you respond?`,
        temperature: 0.8,
        jsonMode: true
      });

      const parsed = JSON.parse(response.content);
      return {
        action: parsed.action || `I nod at ${npcName}.`,
        reasoning: parsed.reasoning || "Being polite."
      };
    } catch (error) {
      console.error("AI Player dialogue response failed:", error);
      return {
        action: `I acknowledge ${npcName}'s words with a thoughtful nod.`,
        reasoning: "Taking time to consider before responding."
      };
    }
  }
}
