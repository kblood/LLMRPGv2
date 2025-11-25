import OpenAI from 'openai';
import { LLMProvider, LLMRequest, LLMResponse } from '../types';

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
  organization?: string;
}

export class OpenAIAdapter implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
    });
    this.model = config.model;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stop: request.stop,
      response_format: request.jsonMode ? { type: 'json_object' } : undefined,
    });

    const choice = completion.choices[0];
    
    return {
      content: choice.message.content || '',
      usage: completion.usage ? {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      } : undefined,
      model: completion.model,
    };
  }
}
