import { LLMProvider, LLMRequest, LLMResponse } from '../types';

export class MockAdapter implements LLMProvider {
  private responseQueue: string[] = [];

  setNextResponse(response: string) {
    this.responseQueue.push(response);
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (this.responseQueue.length > 0) {
        return {
            content: this.responseQueue.shift()!,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            model: "mock-model"
        };
    }

    let content = "This is a mock response.";
    
    if (request.jsonMode) {
        if (request.userPrompt?.includes("theme")) {
            content = JSON.stringify({
                name: "Mock World",
                genre: "Mock Genre",
                tone: "Mock Tone",
                keywords: ["Mock", "Test", "Debug"]
            });
        } else if (request.userPrompt?.includes("location")) {
            content = JSON.stringify({
                name: "Mock Location",
                description: "A mock location description.",
                aspects: [
                    { name: "Mock Aspect 1", type: "situation" },
                    { name: "Mock Aspect 2", type: "environment" }
                ],
                features: [
                    { name: "Mock Feature 1", description: "A mock feature." }
                ]
            });
        } else if (request.userPrompt?.includes("scenario")) {
            content = JSON.stringify({
                title: "Mock Scenario",
                description: "A mock scenario description.",
                hook: "A mock hook."
            });
        } else if (request.userPrompt?.includes("character")) {
            content = JSON.stringify({
                name: "Mock Character",
                appearance: "A mock appearance.",
                aspects: [
                    { name: "Mock High Concept", type: "highConcept" },
                    { name: "Mock Trouble", type: "trouble" },
                    { name: "Mock Aspect 3", type: "other" }
                ],
                skills: [
                    { name: "Fight", level: 4 },
                    { name: "Athletics", level: 3 }
                ],
                stunts: [
                    { name: "Mock Stunt", description: "A mock stunt." }
                ],
                personality: {
                    traits: ["Mock Trait"],
                    values: ["Mock Value"],
                    quirks: ["Mock Quirk"],
                    fears: ["Mock Fear"],
                    desires: ["Mock Desire"]
                },
                backstory: {
                    origin: "Mock Origin",
                    formativeEvent: "Mock Event",
                    secret: "Mock Secret",
                    summary: "Mock Summary"
                },
                voice: {
                    speechPattern: "Mock Speech",
                    vocabulary: "simple",
                    phrases: ["Mock Phrase"],
                    quirks: ["Mock Quirk"]
                }
            });
        } else {
            content = JSON.stringify({
                name: "Generic Mock",
                description: "Generic mock data."
            });
        }
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
