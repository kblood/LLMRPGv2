import { CharacterDefinition, Turn } from '@llmrpg/core';

export interface ContextLayers {
  systemPrompt: string;
  characterDefinition?: CharacterDefinition;
  worldState?: string; // Simplified for now, should be structured
  history?: Turn[];
  immediateContext?: string;
}

export class ContextBuilder {
  buildSystemPrompt(role: string, rules: string): string {
    return `You are ${role}.\n\nRULES:\n${rules}`;
  }

  /**
   * Phase 28b: Optimized context for decision-making (skill selection, action classification, opposition setting)
   * Reduces context by ~40-50% compared to full character context
   * Includes only essential fields: identity, aspects, and skill ratings
   * Excludes: detailed personality, backstory, stunt descriptions, complex relationships
   */
  buildCharacterContextForDecisions(character: CharacterDefinition): string {
    return `
## CHARACTER IDENTITY
NAME: ${character.name}
HIGH CONCEPT: ${character.highConcept}
TROUBLE: ${character.trouble}
ASPECTS: ${character.aspects.join(', ')}

## CAPABILITIES
SKILLS: ${Object.entries(character.skills).map(([k, v]) => `${k} (+${v})`).join(', ')}
    `.trim();
  }

  /**
   * Full character context for narrative and roleplay (NPC dialogue, personality-driven decisions)
   * Includes all personality details, backstory, stunts, and relationships
   */
  buildCharacterContext(character: CharacterDefinition): string {
    const personality = character.personality;
    const backstory = character.backstory;

    return `
## CHARACTER IDENTITY
NAME: ${character.name}
HIGH CONCEPT: ${character.highConcept}
TROUBLE: ${character.trouble}
ASPECTS: ${character.aspects.join(', ')}

## PERSONALITY
TRAITS: ${personality.traits.join(', ')}
VALUES: ${personality.values.join(', ')}
FEARS: ${personality.fears.join(', ')}
QUIRKS: ${personality.quirks.join(', ')}
SPEECH PATTERN: ${personality.speechPattern}

## BACKSTORY
SUMMARY: ${backstory.summary}
MOTIVATION: ${backstory.motivation}
ORIGIN: ${backstory.origin}

## CAPABILITIES
SKILLS: ${Object.entries(character.skills).map(([k, v]) => `${k} (+${v})`).join(', ')}
STUNTS: ${character.stunts.map(s => `${s.name} (${s.description})`).join('; ')}
    `.trim();
  }

  buildHistoryContext(turns: Turn[]): string {
    return turns.map(t => `Turn ${t.turnNumber} (${t.actor}): ${JSON.stringify(t.events)}`).join('\n');
  }

  assemblePrompt(layers: ContextLayers, forDecisions: boolean = false): { system: string; user: string } {
    const system = layers.systemPrompt;

    let user = '';

    if (layers.characterDefinition) {
      const charContext = forDecisions
        ? this.buildCharacterContextForDecisions(layers.characterDefinition)
        : this.buildCharacterContext(layers.characterDefinition);
      user += `## CHARACTER\n${charContext}\n\n`;
    }

    if (layers.worldState) {
      user += `## WORLD STATE\n${layers.worldState}\n\n`;
    }

    if (layers.history && layers.history.length > 0) {
      user += `## HISTORY\n${this.buildHistoryContext(layers.history)}\n\n`;
    }

    if (layers.immediateContext) {
      user += `## CURRENT SITUATION\n${layers.immediateContext}\n\n`;
    }

    return { system, user };
  }

  /**
   * Phase 28b: Estimate context size in tokens (rough estimate, 1 char ≈ 0.25 tokens for English)
   * Used for adaptive history pruning and context monitoring
   */
  estimateContextTokens(text: string): number {
    // Rough tokenization: typical English has ~4 chars per token
    // JSON overhead increases this to ~3.5 chars per token
    return Math.ceil(text.length / 3.5);
  }
}
