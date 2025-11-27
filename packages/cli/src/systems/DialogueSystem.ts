import { LLMProvider, ContextBuilder } from '@llmrpg/llm';
import { CharacterDefinition, Turn } from '@llmrpg/core';
import { Relationship } from '@llmrpg/protocol';

export interface DialogueContext {
  npc: CharacterDefinition;
  player: CharacterDefinition;
  history: Turn[];
  relationship?: Relationship;
  topic?: string;
  factionReputation?: { factionName: string; reputation: number; rank: string }[];
}

export class DialogueSystem {
  private contextBuilder: ContextBuilder;

  constructor(private llm: LLMProvider) {
    this.contextBuilder = new ContextBuilder();
  }

  async generateDialogue(playerInput: string, context: DialogueContext): Promise<string> {
    const npc = context.npc;
    // Map core CharacterDefinition to protocol-like structure for prompt
    const voice = { 
        speechPattern: npc.personality?.speechPattern || "neutral", 
        vocabulary: "moderate", 
        phrases: [], 
        quirks: [] 
    };
    const personality = npc.personality || { traits: [], values: [], fears: [], quirks: [] };

    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "NPC Actor",
      `You are roleplaying as ${npc.name}.

CHARACTER PROFILE:
- High Concept: ${npc.highConcept}
- Trouble: ${npc.trouble}
- Personality: ${personality.traits.join(", ")}
- Values: ${personality.values.join(", ")}
- Fears: ${personality.fears.join(", ")}
- Quirks: ${personality.quirks.join(", ")}

VOICE & SPEECH:
- Pattern: ${voice.speechPattern}
- Vocabulary: ${voice.vocabulary}
- Signature Phrases: ${voice.phrases.join(", ")}
- Speech Quirks: ${voice.quirks.join(", ")}

RELATIONSHIP WITH PLAYER:
- Trust: ${context.relationship?.trust || 0}
- Affection: ${context.relationship?.affection || 0}
- Respect: ${context.relationship?.respect || 0}
- Influence: ${context.relationship?.influence || 0}
- Type: ${context.relationship?.type || 'neutral'}
${context.factionReputation ? `
FACTION REPUTATION:
${context.factionReputation.map(f => `- ${f.factionName}: ${f.rank} (${f.reputation})`).join('\n')}
` : ''}

INSTRUCTIONS:
- Respond to the player's input as this character.
- Stay in character at all times.
- Use the defined voice and speech patterns.
- Reflect the current relationship, trust, affection, respect, and influence levels.
- Consider FACTION REPUTATION: If the player is hostile to your faction, be guarded or aggressive. If allied, be helpful.
- Be concise (1-3 sentences usually).
- Do not describe actions, ONLY speak dialogue (unless actions are subtle body language).`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      characterDefinition: context.player,
      immediateContext: `Player says: "${playerInput}"\n\n${npc.name} responds:`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.8
      });

      return response.content;
    } catch (error) {
      console.error("Dialogue generation failed:", error);
      return "...";
    }
  }

  async analyzeSocialIntent(playerInput: string): Promise<{ intent: string; targetSkill?: string }> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `Analyze the player's input to determine their social intent.

INTENTS:
- "inform": Sharing information
- "inquire": Asking a question
- "persuade": Trying to convince (Skill: Rapport)
- "intimidate": Trying to scare/coerce (Skill: Provoke)
- "deceive": Lying or misleading (Skill: Deceive)
- "charm": Flirting or befriending (Skill: Rapport)
- "neutral": Casual conversation

OUTPUT FORMAT:
JSON with fields:
- intent: string
- targetSkill: string (optional, if a roll is needed)`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Player Input: "${playerInput}"\n\nAnalyze intent.`
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
      return { intent: "neutral" };
    }
  }
}
