import { describe, it, expect, vi } from 'vitest';
import { ContextBuilder } from '../src/ContextBuilder';
import { OpenAIAdapter } from '../src/adapters/OpenAIAdapter';
import { OllamaAdapter } from '../src/adapters/OllamaAdapter';
import { CharacterDefinition } from '@llmrpg/core';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock response' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            model: 'gpt-mock'
          })
        }
      }
    }
  }
});

// Mock Ollama
vi.mock('ollama', () => {
  return {
    Ollama: class {
      chat = vi.fn().mockResolvedValue({
        message: { content: 'Ollama response' },
        prompt_eval_count: 10,
        eval_count: 5,
        model: 'llama2'
      })
    }
  }
});

describe('ContextBuilder', () => {
  it('should assemble prompts correctly', () => {
    const builder = new ContextBuilder();
    const character: CharacterDefinition = {
      id: 'char-1',
      name: 'Hero',
      highConcept: 'A brave hero',
      trouble: 'Afraid of spiders',
      aspects: ['Strong', 'Fast'],
      personality: {
        traits: ['Brave'],
        values: ['Justice'],
        fears: ['Spiders'],
        quirks: ['Hums'],
        speechPattern: 'Formal'
      },
      backstory: {
        summary: 'A hero',
        origin: 'Village',
        motivation: 'Save world',
        secrets: [],
        keyEvents: []
      },
      skills: { Fight: 4 },
      stunts: [],
      stress: { physical: [], mental: [] },
      consequences: {},
      fatePoints: 3,
      relationships: [],
      knowledge: {
        knownLocations: [],
        knownCharacters: [],
        knownSecrets: [],
        knownQuests: []
      }
    };

    const { system, user } = builder.assemblePrompt({
      systemPrompt: 'You are a GM.',
      characterDefinition: character,
      immediateContext: 'The hero enters the cave.'
    });

    expect(system).toBe('You are a GM.');
    expect(user).toContain('NAME: Hero');
    expect(user).toContain('HIGH CONCEPT: A brave hero');
    expect(user).toContain('The hero enters the cave.');
  });
});

describe('OpenAIAdapter', () => {
  it('should generate text', async () => {
    const adapter = new OpenAIAdapter({ apiKey: 'test', model: 'gpt-4' });
    const response = await adapter.generate({
      systemPrompt: 'System',
      userPrompt: 'User'
    });

    expect(response.content).toBe('Mock response');
    expect(response.model).toBe('gpt-mock');
  });
});

describe('OllamaAdapter', () => {
  it('should generate text', async () => {
    const adapter = new OllamaAdapter({ model: 'llama2' });
    const response = await adapter.generate({
      systemPrompt: 'System',
      userPrompt: 'User'
    });

    expect(response.content).toBe('Ollama response');
    expect(response.model).toBe('llama2');
  });
});
