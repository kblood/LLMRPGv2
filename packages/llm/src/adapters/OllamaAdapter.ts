import { Ollama } from 'ollama';
import { LLMProvider, LLMRequest, LLMResponse } from '../types';

export interface OllamaConfig {
  host?: string;
  model: string;
}

export class OllamaAdapter implements LLMProvider {
  private client: Ollama;
  private model: string;

  constructor(config: OllamaConfig) {
    this.client = new Ollama({
      host: config.host || 'http://127.0.0.1:11434',
    });
    this.model = config.model;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      options: {
        temperature: request.temperature,
        stop: request.stop,
        num_predict: request.maxTokens,
      },
      format: request.jsonMode ? 'json' : undefined,
    });

    return {
      content: response.message.content,
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
      model: response.model,
    };
  }
}
