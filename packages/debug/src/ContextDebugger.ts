import { ContextBuilder, ContextLayers } from '@llmrpg/llm';
import { StateInspector } from './StateInspector';
import { GameState } from '@llmrpg/protocol';

export interface BuiltContext {
    systemPrompt: string;
    userMessage: string;
    layers: {
        world: string;
        character: string;
        session: string;
        immediate: string;
    };
    filteredKnowledge?: string[];
}

export interface ContextInspection {
  actor: 'gm' | 'npc' | 'player';
  turn: number;
  systemPrompt: string;
  userMessage: string;
  tokenCount: number;
  breakdown: {
    worldContext: string;
    characterContext: string;
    sessionContext: string;
    immediateContext: string;
  };
  filteredKnowledge: string[];
}

export class ContextDebugger {
  constructor(private stateInspector: StateInspector) {}

  // See exactly what context was sent to LLM
  async inspectContext(
    sessionId: string, 
    turn: number, 
    actor: 'gm' | 'npc' | 'player',
    npcId?: string
  ): Promise<ContextInspection> {
    const state = await this.stateInspector.getStateAtTurn(sessionId, turn);
    const builder = new ContextBuilder();
    
    // Simulate context building based on actor
    const layers: ContextLayers = {
        systemPrompt: "You are the Game Master.", // Default
        characterDefinition: undefined,
        worldState: JSON.stringify(state.world), // Simplified
        history: [], // TODO: Get history from state or loader
        immediateContext: "What happens next?"
    };

    if (actor === 'npc' && npcId) {
        // TODO: Fetch NPC from state
        // layers.characterDefinition = state.npcs[npcId];
        layers.systemPrompt = "You are an NPC.";
    } else if (actor === 'player') {
        // layers.characterDefinition = state.player;
        layers.systemPrompt = "You are the Player.";
    }

    const { system, user } = builder.assemblePrompt(layers);

    return {
      actor,
      turn,
      systemPrompt: system,
      userMessage: user,
      tokenCount: this.countTokens(system, user),
      breakdown: {
        worldContext: layers.worldState || '',
        characterContext: layers.characterDefinition ? builder.buildCharacterContext(layers.characterDefinition) : '',
        sessionContext: layers.history ? builder.buildHistoryContext(layers.history) : '',
        immediateContext: layers.immediateContext || '',
      },
      filteredKnowledge: [],
    };
  }

  private countTokens(system: string, user: string): number {
      // Simple approximation
      return (system.length + user.length) / 4;
  }
}
