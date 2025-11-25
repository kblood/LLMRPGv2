import { LLMProvider, LLMRequest, LLMResponse } from '../types';

export class MockAdapter implements LLMProvider {
  async generate(request: LLMRequest): Promise<LLMResponse> {
    let content = "This is a mock response.";
    
    if (request.jsonMode) {
        content = JSON.stringify({
            name: "Mock Location",
            description: "A mock location description.",
            aspects: ["Mock Aspect 1", "Mock Aspect 2"]
        });
    } else if (request.systemPrompt.includes("difficulty")) {
        content = "2";
    } else if (request.systemPrompt.includes("Game Master")) {
        content = "The Game Master narrates: You successfully performed the action.";
    }

    return {
      content,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      model: 'mock-model'
    };
  }
}
