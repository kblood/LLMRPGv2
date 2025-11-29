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
  attemptedTargets: Record<string, number>; // Track how many times each target was attempted
}

function normalizeActionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFeatureName(name: string): string {
  // Normalize a feature name for matching against attempted targets
  // "the ancient temple of the abyssal eye" -> "temple abyssal eye"
  return name
    .toLowerCase()
    .replace(/^the\s+/, '') // Remove leading "the"
    .replace(/\s+(of|in|the)\s+/g, ' ') // Remove prepositions
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
}

interface ExtractedAction {
  action: string;
  target: string | null;
}

function extractPlayerAction(turn: Turn): ExtractedAction | null {
  if (!turn.events || turn.events.length === 0) return null;

  // Look for skill_check events which contain the action description
  const skillCheck = turn.events.find(e => e.type === 'skill_check');
  if (skillCheck?.description) {
    const match = skillCheck.description.match(/Player attempted to (.+?) using/);
    if (match) {
      const actionText = match[1].trim();
      // Extract target more conservatively - just the immediate noun phrase
      // e.g., "examine the ancient rune tablet for hidden passages" -> target is "ancient rune tablet"
      const targetMatch = actionText.match(/(?:examine|search|interact with|talk to|attack|defend|overcome|create advantage|open|close|take|push|pull|investigate|study|look at|listen to)\s+(?:the\s+)?([^,]+?)(?:\s*,|\s+for|\s+looking|\s+in\s|$)/i);

      // If we found a target, clean it up (remove trailing prepositions and extra words)
      let target: string | null = null;
      if (targetMatch) {
        target = targetMatch[1]
          .trim()
          .toLowerCase()
          .replace(/^(of|in|from)\s+/, '') // Remove leading prepositions
          .replace(/\s+(of|in|from|at|for|to).*$/, ''); // Remove trailing prepositions and clauses
      }

      return { action: actionText, target };
    }
  }

  // Try other event types
  for (const event of turn.events) {
    if (event.description && event.actor === 'player') {
      return { action: event.description, target: null };
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
    suggestedApproaches: [],
    attemptedTargets: {}
  };

  if (!history || history.length === 0) {
    return result;
  }

  const recentTurns = history.slice(-10);
  const allEvents = recentTurns.flatMap(t => t.events || []);

  // Detect scene type
  result.sceneType = detectSceneType(currentScene, allEvents);

  // Extract recent player actions and track targets
  let lastInventoryCheckTurn = -100; // Track when inventory was last checked
  const inventoryChecksTurn: number[] = [];

  for (let i = 0; i < recentTurns.length; i++) {
    const turn = recentTurns[i];
    const extracted = extractPlayerAction(turn);
    if (extracted) {
      result.recentActions.push(extracted.action);
      // Track how many times each target was attempted
      if (extracted.target) {
        result.attemptedTargets[extracted.target] = (result.attemptedTargets[extracted.target] || 0) + 1;
      }

      // Detect inventory checks for spam prevention
      if (extracted.action.toLowerCase().includes('inventory') ||
          extracted.action.toLowerCase().includes('check my belongings') ||
          extracted.action.toLowerCase().includes('what do i have')) {
        inventoryChecksTurn.push(i);
        lastInventoryCheckTurn = i;
      }
    }
  }

  // Detect inventory spam: multiple checks within 5 turns
  const recentInventoryChecks = inventoryChecksTurn.filter(turn => turn >= inventoryChecksTurn.length - 5);
  (result as any).inventoryCheckSpam = recentInventoryChecks.length > 1;
  
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

  // Find feature saturation: same feature examined 3+ times
  const featureSaturation: string[] = [];
  for (const [target, count] of Object.entries(result.attemptedTargets)) {
    if (count >= 3) {
      featureSaturation.push(`"${target}" (${count} times)`);
    }
  }
  (result as any).featureSaturation = featureSaturation;

  // Check for inventory spam
  const inventorySpam = (result as any).inventoryCheckSpam;

  // Generate feedback based on analysis
  if (inventorySpam) {
    result.feedbackMessage = `⚠️ ACTION SPAM DETECTED: You've checked your inventory multiple times recently. You already know what you're carrying - focus on something else!`;
    result.suggestedApproaches = [
      'Interact with the environment or an NPC',
      'Move to a different location',
      'Examine a specific object or feature',
      'Try using one of your skills on a challenge'
    ];
  } else if (featureSaturation.length > 0) {
    result.feedbackMessage = `⚠️ FEATURE SATURATION: You've examined these features excessively: ${featureSaturation.join(', ')}. These won't reveal anything new. Try something different!`;
    result.suggestedApproaches = [
      'Move to a different location',
      'Interact with a different object or person',
      'Try a skill-based action (Overcome, Create Advantage, etc.)',
      'Explore an area you haven\'t been to yet'
    ];
  } else if (result.repeatedPatterns.length > 0 && result.sceneType !== 'combat') {
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

    // Mark features with attempt counts to guide LLM away from repetition
    const markedFeatures = locationFeatures.map((f: any) => {
      const featureName = f.name || f.description || String(f);
      const normalizedName = normalizeFeatureName(featureName);

      // Check for this feature in attempted targets (including partial matches)
      let attemptCount = 0;
      for (const [attemptedTarget, count] of Object.entries(analysis.attemptedTargets)) {
        // Check if the attempted target mentions this feature name
        if (attemptedTarget.includes(normalizedName) || normalizedName.includes(attemptedTarget)) {
          attemptCount += count as number;
        }
      }
      attemptCount = attemptCount > 0 ? attemptCount : (analysis.attemptedTargets[normalizedName] || 0);

      if (attemptCount === 0) {
        return featureName; // Fresh option, no marker
      } else if (attemptCount === 1) {
        return `${featureName} [tried once]`;
      } else if (attemptCount === 2) {
        return `${featureName} [tried ${attemptCount} times - consider alternatives]`;
      } else {
        return `${featureName} [tried ${attemptCount} times - this is NOT working, pick something else]`;
      }
    });

    // Get available exits/connections if any, ordered by freshness
    const exitConnections = knownLocation?.connections
      ?.filter((c: any) => c.discovered !== false)
      ?.map((c: any) => {
        const direction = c.direction || 'exit';
        const description = c.description || c.name || 'passage';
        const normalizedDir = direction.toLowerCase();
        const attemptCount = analysis.attemptedTargets[normalizedDir] || 0;
        return { direction, description, attemptCount, text: `${direction}: ${description}` };
      }) || [];

    // Sort exits: untried first, then by attempt count
    exitConnections.sort((a: any, b: any) => a.attemptCount - b.attemptCount);

    // Build detailed exit information with status indicators
    const formattedExits = exitConnections.map((e: any) => {
      if (e.attemptCount === 0) {
        return `✨ ${e.direction} → ${e.description} [NEW]`;
      } else if (e.attemptCount === 1) {
        return `↔️ ${e.direction} → ${e.description} [visited]`;
      } else {
        return `${e.direction} → ${e.description} [visited ${e.attemptCount} times]`;
      }
    });

    const availableExits = exitConnections.map((e: any) => e.text).join(', ');
    const detailedExits = formattedExits.join('\n');

    // Show investigation-worthy aspects (Fate-aligned discovery)
    // Players can invoke these aspects or use Create Advantage to discover opportunities
    const investigationAspects = knownLocation?.aspects
      ?.filter((a: any) => a.name?.includes('Path') || a.name?.includes('Hidden') || a.name?.includes('Unexplored') || a.name?.includes('Passage') || a.name?.includes('Investigation') || a.name?.includes('Secret'))
      ?.map((a: any) => a.name)
      .join(', ') || '';

    const investigationSection = investigationAspects
      ? `\n🔍 INVESTIGATION OPPORTUNITIES (you can invoke these aspects or use Create Advantage to investigate):\n${investigationAspects}\n`
      : '';

    // Warn about dead-end locations to help AI avoid loops
    const deadEndWarning = knownLocation?.isDeadEnd
      ? `\n⚠️ DEAD-END WARNING: This location only has one exit! You may want to explore other locations to avoid getting stuck here.\n`
      : '';

    // Build location memory: track visited locations and identify dead-ends
    const visitedLocations = new Map<string, number>(); // location name -> visit count
    if (history) {
      history.forEach((turn, index) => {
        const location = (turn as any).location?.name || (worldState?.locations?.[Object.keys(worldState.locations || {})[0]]?.name);
        if (location) {
          visitedLocations.set(location, (visitedLocations.get(location) || 0) + 1);
        }
      });
    }

    // Find dead-end locations that have been visited to warn the AI
    const knownDeadEnds: string[] = [];
    Object.values(worldState?.locations || {}).forEach((loc: any) => {
      if (loc.isDeadEnd && visitedLocations.has(loc.name) && loc.name !== locationName) {
        knownDeadEnds.push(`${loc.name} (only exit: ${loc.connections?.[0]?.direction || 'unknown'})`);
      }
    });

    const locationMemorySection = knownDeadEnds.length > 0
      ? `\n📍 LOCATION MEMORY - Known Dead-Ends (avoid unless necessary):\n${knownDeadEnds.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}\n`
      : '';

    // Check for saturated (over-examined) objects at current location
    const examinationHistory = (worldState as any)?.examinationHistory || [];
    const saturatedObjectsAtLocation = examinationHistory
      .filter((record: any) => record.locationId === knownLocation?.id && record.examineCount >= 3)
      .map((record: any) => record.objectName);

    const saturationSection = saturatedObjectsAtLocation.length > 0
      ? `\n🔄 EXAMINED THOROUGHLY (no new information):\n${saturatedObjectsAtLocation.map((obj: string, i: number) => `  ${i + 1}. "${obj}" (thoroughly explored)`).join('\n')}\nFocus on something else!\n`
      : '';

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

CRITICAL GUIDELINES FOR AVOIDING LOOPS:
- VARIETY IS ESSENTIAL: Never repeat the same action twice in a row
- If an approach fails 2-3 times, IMMEDIATELY ABANDON IT - do not continue
- If you've tried the same location/action 5+ times: YOU MUST LEAVE IMMEDIATELY
- TRAVEL to new locations whenever you're not making progress
- Talk to different people, use different skills, interact with different objects
- Be proactive and curious - if stuck, explore a new area
- Stay in character - use your aspects and personality
- If someone is talking to you, respond appropriately
- You only know what your character has experienced
- WHEN STUCK (2+ failures or repeated actions): TRAVELING TO A NEW LOCATION is the solution
${player.fatePoints && player.fatePoints > 0 ? `\n💡 You have ${player.fatePoints} Fate Points - USE THEM to invoke aspects for +2 or reroll, or to declare story advantages!` : ''}

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

    // CRITICAL: Detect if stuck in loop and force escape
    const isStuckInLoop = analysis.repeatedPatterns.length > 0 &&
                         analysis.consecutiveFailures >= 2 &&
                         analysis.recentActions.length >= 5;

    if (isStuckInLoop) {
      actionFeedbackSection = `
🚨 CRITICAL: You are stuck in a loop! Your last ${analysis.consecutiveFailures} actions have failed, and you keep repeating: ${analysis.repeatedPatterns.join(', ')}

THIS APPROACH WILL NOT WORK. YOU MUST ESCAPE THIS LOOP.

MANDATORY ACTION: You MUST do ONE of the following:
1. TRAVEL to a DIFFERENT LOCATION (this is the primary recommendation)
2. Use a completely different skill or approach
3. Interact with a different object or person
4. Spend Fate Points to declare a story advantage that changes the situation

If available exits exist, TRAVELING TO A NEW LOCATION is your best option.
`;
    } else if (analysis.repeatedPatterns.length > 0 && analysis.sceneType !== 'combat') {
      actionFeedbackSection = `
⚠️ ACTION ALERT: You've been repeating similar actions - this approach is NOT working!
Repeated patterns: ${analysis.repeatedPatterns.join(', ')}
REQUIRED: Choose something COMPLETELY DIFFERENT from your recent actions.
Consider: ${analysis.suggestedApproaches.slice(0, 2).join('; ')}
`;
    } else if (analysis.consecutiveFailures >= 3) {
      actionFeedbackSection = `
⚠️ CRITICAL NOTICE: Your last ${analysis.consecutiveFailures} actions FAILED. This approach is broken.
MANDATORY: Try a fundamentally different action - prefer TRAVELING to a new location if possible.
${analysis.suggestedApproaches.length > 0 ? `Ideas: ${analysis.suggestedApproaches.slice(0, 2).join('; ')}` : ''}
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
${markedFeatures.length > 0 ? `Notable Features:\n${markedFeatures.map((f: string, i: number) => `  ${i + 1}. ${f}`).join('\n')}` : ''}

🚪 TRAVEL OPTIONS:
${detailedExits ? `Available Exits:
${detailedExits}

You can travel to any of these locations. Exits marked with ✨ [NEW] are unexplored. Prioritize new exits to discover fresh opportunities!` : 'No obvious exits visible. You might search for hidden passages or alternative routes.'}
${deadEndWarning}
${locationMemorySection}${saturationSection}

${objectivesText}
${actionFeedbackSection}
RECENT HISTORY:
${recentHistory}

REMEMBER: You only know what has been described or what you've experienced. If something isn't mentioned, your character doesn't know about it. You can declare new story details by spending Fate Points if it fits your character's background or makes narrative sense.

EXPLORATION TIP: If you're stuck with a challenge, consider exploring a new location! Different areas may have different opportunities and solutions.

What do you do next? Respond with a JSON object containing your action and reasoning.`;

    try {
      // DEBUG: Check for repetition and log context
      const isRepeating = analysis.repeatedPatterns.length > 0 || analysis.consecutiveFailures >= 2;
      let debugLogPath = '';

      if (isRepeating) {
        const fs = require('fs');
        const path = require('path');
        debugLogPath = path.join(process.cwd(), 'debug-repeated-actions.txt');
        const timestamp = new Date().toISOString();
        const debugLog = `
================================================================================
REPEATED ACTION DEBUG LOG [${timestamp}]
================================================================================
LOCATION: ${locationName}
REPEATED PATTERNS: ${analysis.repeatedPatterns.join(', ')}
CONSECUTIVE FAILURES: ${analysis.consecutiveFailures}
RECENT ACTIONS (last 8):
${analysis.recentActions.slice(-8).map((a, i) => `  ${i + 1}. ${a}`).join('\n')}

ATTEMPTED TARGETS:
${Object.entries(analysis.attemptedTargets).map(([t, c]) => `  - "${t}": ${c} attempts`).join('\n')}

MARKED FEATURES:
${markedFeatures.map((f: any, i: any) => `  ${i + 1}. ${f}`).join('\n')}

AVAILABLE EXITS:
${availableExits}

USER PROMPT (recent situation section):
${userPrompt.substring(0, 1500)}...
--------------------------------------------------------------------------------
`;
        fs.appendFileSync(debugLogPath, debugLog);
      }

      const response = await this.llm.generate({
        systemPrompt,
        userPrompt,
        temperature: 0.8,
        jsonMode: true
      });

      const parsed = JSON.parse(response.content);

      // DEBUG: Log LLM response for repeated actions
      if (isRepeating && debugLogPath) {
        const fs = require('fs');
        const responseLog = `
LLM RESPONSE (full):
${response.content}

PARSED ACTION:
  action: "${parsed.action}"
  reasoning: "${parsed.reasoning}"
  strategy: "${parsed.strategy || 'none'}"

================================================================================
`;
        fs.appendFileSync(debugLogPath, responseLog);
      }

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

      // DEBUG: Log fallback usage
      const isRepeating = analysis.repeatedPatterns.length > 0 || analysis.consecutiveFailures >= 2;
      if (isRepeating) {
        const fs = require('fs');
        const path = require('path');
        const debugLogPath = path.join(process.cwd(), 'debug-repeated-actions.txt');
        const fallbackLog = `
ERROR - FALLBACK TRIGGERED:
  Error: ${(error as any).message}
  Stack: ${(error as any).stack?.substring(0, 200)}

================================================================================
`;
        fs.appendFileSync(debugLogPath, fallbackLog);
      }

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
