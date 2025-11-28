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
  fatePointsSpent?: number;
  aspectInvokes?: Array<{
    aspectName: string;
    bonus: '+2' | 'reroll';
  }>;
}

/**
 * Analyze recent history to detect repetition patterns and provide feedback
 */
interface ActionAnalysis {
  recentActions: string[];
  repeatedPatterns: string[];
  consecutiveFailures: number;
  sceneType: 'combat' | 'social' | 'exploration' | 'unknown';
  feedbackMessage: string;
  suggestedApproaches: string[];
}

function normalizeActionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPlayerAction(turn: Turn): string | null {
  if (!turn.events || turn.events.length === 0) return null;
  
  // Look for skill_check events which contain the action description
  const skillCheck = turn.events.find(e => e.type === 'skill_check');
  if (skillCheck?.description) {
    const match = skillCheck.description.match(/Player attempted to (.+?) using/);
    if (match) return match[1].trim();
  }
  
  // Try other event types
  for (const event of turn.events) {
    if (event.description && event.actor === 'player') {
      return event.description;
    }
  }
  
  return null;
}

function detectSceneType(currentScene: any, recentEvents: any[]): 'combat' | 'social' | 'exploration' | 'unknown' {
  // Check scene type directly if available
  if (currentScene?.type) {
    if (currentScene.type === 'combat' || currentScene.type === 'conflict') return 'combat';
    if (currentScene.type === 'social' || currentScene.type === 'dialogue') return 'social';
    if (currentScene.type === 'exploration') return 'exploration';
  }
  
  // Infer from recent events
  const eventTypes = recentEvents.map(e => e.type);
  if (eventTypes.includes('combat_attack') || eventTypes.includes('combat_defend')) {
    return 'combat';
  }
  if (eventTypes.includes('dialogue')) {
    return 'social';
  }
  
  return 'exploration';
}

function analyzeRecentHistory(history: Turn[] | undefined, currentScene: any): ActionAnalysis {
  const result: ActionAnalysis = {
    recentActions: [],
    repeatedPatterns: [],
    consecutiveFailures: 0,
    sceneType: 'unknown',
    feedbackMessage: '',
    suggestedApproaches: []
  };
  
  if (!history || history.length === 0) {
    return result;
  }
  
  const recentTurns = history.slice(-10);
  const allEvents = recentTurns.flatMap(t => t.events || []);
  
  // Detect scene type
  result.sceneType = detectSceneType(currentScene, allEvents);
  
  // Extract recent player actions
  for (const turn of recentTurns) {
    const action = extractPlayerAction(turn);
    if (action) {
      result.recentActions.push(action);
    }
  }
  
  // Count consecutive failures (from most recent)
  for (let i = recentTurns.length - 1; i >= 0; i--) {
    const turn = recentTurns[i];
    const skillCheck = turn.events?.find(e => e.type === 'skill_check');
    if (skillCheck && skillCheck.shifts !== undefined && skillCheck.shifts !== null) {
      if (skillCheck.shifts < 0) {
        result.consecutiveFailures++;
      } else {
        break; // Stop counting at first success
      }
    }
  }
  
  // Detect repeated action patterns
  const actionCounts: Record<string, number> = {};
  for (const action of result.recentActions) {
    const normalized = normalizeActionText(action).substring(0, 40);
    actionCounts[normalized] = (actionCounts[normalized] || 0) + 1;
  }
  
  // Find patterns that appear 3+ times
  result.repeatedPatterns = Object.entries(actionCounts)
    .filter(([_, count]) => count >= 3)
    .map(([pattern, count]) => `"${pattern}" (${count} times)`);
  
  // Generate feedback based on analysis
  if (result.repeatedPatterns.length > 0 && result.sceneType !== 'combat') {
    result.feedbackMessage = `⚠️ You've been repeating similar actions: ${result.repeatedPatterns.join(', ')}. This approach doesn't seem to be working.`;
    
    // Generate suggestions based on scene type
    if (result.sceneType === 'social') {
      result.suggestedApproaches = [
        'Try a completely different approach - perhaps leave and explore elsewhere',
        'Use a different skill (e.g., if Persuade failed, try Deceive or Provoke)',
        'Look for environmental clues or objects to interact with',
        'Consider whether this NPC will ever cooperate, or if you need a different source'
      ];
    } else if (result.sceneType === 'exploration') {
      result.suggestedApproaches = [
        'Move to a different area or room',
        'Interact with a different object or feature',
        'Look for hidden exits or passages',
        'Try talking to someone instead of investigating'
      ];
    } else {
      result.suggestedApproaches = [
        'Try a completely different type of action',
        'Change location or target',
        'Use a skill you haven\'t tried yet',
        'Spend a Fate Point to declare a story advantage'
      ];
    }
  } else if (result.consecutiveFailures >= 3) {
    result.feedbackMessage = `⚠️ You've failed ${result.consecutiveFailures} actions in a row. Consider spending Fate Points to invoke aspects, or try a different approach.`;
    result.suggestedApproaches = [
      'Invoke one of your aspects for +2 or a reroll',
      'Create an advantage first to get free invokes',
      'Try using your best skill instead',
      'Accept a compel to gain Fate Points'
    ];
  }
  
  return result;
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

    // Analyze recent history for repetition and failure patterns
    const analysis = analyzeRecentHistory(history, currentScene);

    // Build character context
    const aspectsList = player.aspects?.join(', ') || 'Unknown aspects';
    const skillsList = typeof player.skills === 'object' && !Array.isArray(player.skills)
      ? Object.entries(player.skills).map(([name, rating]) => `${name}: +${rating}`).join(', ')
      : Array.isArray(player.skills) 
        ? (player.skills as any[]).map(s => `${s.name}: +${s.rating || s.rank || 0}`).join(', ')
        : 'Unknown skills';

    // FILTERED CONTEXT: Only provide information the character actually knows
    // In Fate Core, players don't get god-like knowledge of the world
    const knownLocation = worldState?.currentLocation;
    const knownNPCs = worldState?.currentLocation?.presentNPCs || [];
    const sceneAspects = currentScene?.aspects || [];
    
    // Only include location details if discovered (simplified for now)
    const locationName = knownLocation?.name || 'Unknown location';
    const locationDescription = knownLocation?.description || 'You\'re not sure where you are exactly.';
    const presentNPCs = knownNPCs;
    const locationFeatures = knownLocation?.features || [];
    const locationAspects = sceneAspects;
    
    // Get available exits/connections if any
    const availableExits = knownLocation?.connections
      ?.filter((c: any) => c.discovered !== false)
      ?.map((c: any) => `${c.direction || 'exit'}: ${c.description || c.name || 'passage'}`)
      ?.join(', ') || '';

    // Build objectives string
    const objectivesText = objectives && objectives.length > 0
      ? `CURRENT OBJECTIVES:\n${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
      : 'OBJECTIVE: Explore and discover opportunities';

    // Build recent actions list (more specific than event summaries)
    const recentActionsText = analysis.recentActions.length > 0
      ? `YOUR RECENT ACTIONS (do not repeat these exactly):\n${analysis.recentActions.slice(-5).map((a, i) => `${i + 1}. ${a}`).join('\n')}`
      : '';

    // Build feedback message if there are issues
    const feedbackSection = analysis.feedbackMessage
      ? `\n⚠️ IMPORTANT FEEDBACK:\n${analysis.feedbackMessage}\n\nSUGGESTED ALTERNATIVES:\n${analysis.suggestedApproaches.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
      : '';

    // Build recent history summary (for context, not action tracking)
    const recentHistory = history?.slice(-3).map(t => {
      const narration = (t as any).narration;
      if (narration) {
        return `Turn ${t.turnNumber}: ${narration.substring(0, 150)}...`;
      }
      const eventSummary = t.events?.map(e => e.description || e.action).join('; ') || 'Unknown';
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

FATE CORE MECHANICS:
- Four Actions: Overcome, Create Advantage, Attack, Defend
- You can spend Fate Points to invoke aspects (+2 bonus or reroll)
- You can DECLARE story details by spending Fate Points (e.g., "I know someone here" or "There's a hidden passage")
- Aspects can be compelled against you for complications (but you get a Fate Point)
- Current Fate Points: ${player.fatePoints || 0}

CRITICAL GUIDELINES:
- VARIETY IS ESSENTIAL: Never repeat the same action twice in a row
- If an approach fails 2-3 times, ABANDON IT and try something completely different
- Move to new locations, talk to different people, use different skills
- Be proactive and curious - explore, interact, investigate
- Stay in character - use your aspects and personality
- If someone is talking to you, respond appropriately
- You only know what your character has experienced
- When stuck, consider: leaving the area, using a different skill, or spending Fate Points
${player.fatePoints && player.fatePoints > 0 ? `\n💡 You have ${player.fatePoints} Fate Points - USE THEM to invoke aspects for +2 or reroll!` : ''}

OUTPUT FORMAT:
You must respond with a JSON object containing:
{
  "action": "The specific action you take (what you say or do)",
  "reasoning": "Your character's internal thoughts explaining WHY you chose this action (1-2 sentences)",
  "strategy": "Your tactical thinking about HOW this helps your goals (optional)",
  "expectedOutcome": "What you hope to achieve (optional)",
  "fatePointsSpent": "Number of Fate Points spent on declarations (optional)",
  "aspectInvokes": "Array of aspects to invoke for bonuses (optional): [{ \"aspectName\": \"Aspect Name\", \"bonus\": \"+2\" or \"reroll\" }]"
}`
    );

    // Build action feedback for user prompt
    let actionFeedbackSection = '';
    if (analysis.repeatedPatterns.length > 0 && analysis.sceneType !== 'combat') {
      actionFeedbackSection = `
⚠️ ACTION ALERT: You've been repeating similar actions - this approach is NOT working!
Repeated patterns: ${analysis.repeatedPatterns.join(', ')}
REQUIRED: Choose something COMPLETELY DIFFERENT from your recent actions.
Consider: ${analysis.suggestedApproaches.slice(0, 2).join('; ')}
`;
    } else if (analysis.consecutiveFailures >= 2) {
      actionFeedbackSection = `
⚠️ NOTICE: Your last ${analysis.consecutiveFailures} actions failed. Consider trying a different approach.
${analysis.suggestedApproaches.length > 0 ? `Ideas: ${analysis.suggestedApproaches.slice(0, 2).join('; ')}` : ''}
`;
    }

    const userPrompt = `CURRENT SITUATION:
📍 LOCATION: ${locationName}
${lastNarration ? `\nGM DESCRIPTION:\n"${lastNarration}"\n` : 'You find yourself in a new situation.'}

${locationAspects.length > 0 ? `Scene Aspects: ${locationAspects.map((a: any) => a.name || a).join(', ')}` : ''}
${presentNPCs.length > 0 ? `People Present: ${presentNPCs.map((n: any) => n.name || n).join(', ')}` : 'You are alone.'}
${locationFeatures.length > 0 ? `Notable Features: ${locationFeatures.map((f: any) => f.name || f.description || f).join(', ')}` : ''}

🚪 TRAVEL OPTIONS:
${availableExits ? `Available Exits: ${availableExits}
You can move to a new location by traveling via any of these exits (e.g., "I head north down the winding path").` : 'No obvious exits visible. You might search for hidden passages or alternative routes.'}

${objectivesText}
${actionFeedbackSection}
RECENT HISTORY:
${recentHistory}

REMEMBER: You only know what has been described or what you've experienced. If something isn't mentioned, your character doesn't know about it. You can declare new story details by spending Fate Points if it fits your character's background or makes narrative sense.

EXPLORATION TIP: If you're stuck with a challenge, consider exploring a new location! Different areas may have different opportunities and solutions.

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
        expectedOutcome: parsed.expectedOutcome,
        fatePointsSpent: parsed.fatePointsSpent || 0,
        aspectInvokes: parsed.aspectInvokes || []
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
