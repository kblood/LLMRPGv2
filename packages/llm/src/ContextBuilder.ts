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

  buildCharacterContext(character: CharacterDefinition): string {
    return `
NAME: ${character.name}
HIGH CONCEPT: ${character.highConcept}
TROUBLE: ${character.trouble}
ASPECTS: ${character.aspects.join(', ')}
SKILLS: ${JSON.stringify(character.skills)}
    `.trim();
  }

  buildHistoryContext(turns: Turn[]): string {
    return turns.map(t => `Turn ${t.turnNumber} (${t.actor}): ${JSON.stringify(t.events)}`).join('\n');
  }

  assemblePrompt(layers: ContextLayers): { system: string; user: string } {
    const system = layers.systemPrompt;
    
    let user = '';
    
    if (layers.characterDefinition) {
      user += `## CHARACTER\n${this.buildCharacterContext(layers.characterDefinition)}\n\n`;
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
}
