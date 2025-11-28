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
        } else if (request.userPrompt?.includes("world events") || request.userPrompt?.includes("Generate world events")) {
            content = JSON.stringify([
                {
                    name: "Storm Approaching",
                    description: "Dark clouds gather on the horizon.",
                    trigger: { type: "time", turn: 5 },
                    effects: [{ type: "aspect_add", target: "world", data: { name: "Ominous Storm", type: "situational" } }],
                    active: true
                }
            ]);
        } else if (request.userPrompt?.includes("factions") || request.userPrompt?.includes("Generate factions")) {
            content = JSON.stringify([
                {
                    name: "The Syndicate",
                    description: "A powerful criminal organization.",
                    aspects: ["Underworld Connections", "Ruthless Efficiency"],
                    goals: ["Control the black market", "Eliminate rivals"],
                    resources: [
                        { type: "Safe houses", level: 3 },
                        { type: "Informants", level: 4 }
                    ],
                    isHidden: false
                },
                {
                    name: "The Order",
                    description: "A secretive guild of protectors.",
                    aspects: ["Ancient Knowledge", "Hidden Network"],
                    goals: ["Protect the innocent", "Preserve balance"],
                    resources: [
                        { type: "Hidden temples", level: 2 },
                        { type: "Trained agents", level: 3 }
                    ],
                    isHidden: true
                }
            ]);
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
    } else if (request.systemPrompt.includes("Classify the player's intent")) {
        content = "fate_action";
    } else if (request.systemPrompt.includes("Classify the player's intended action")) {
        content = "overcome";
    } else if (request.systemPrompt.includes("Game Master") && (request.systemPrompt.includes("narrat") || request.systemPrompt.includes("Narrat"))) {
        // Narration responses - prioritize over other checks
        content = "The Game Master narrates: You successfully performed the action.";
    } else if (request.systemPrompt.includes("Select the most relevant skill")) {
        content = "Fight";
    } else if (request.systemPrompt.includes("NPC") && request.systemPrompt.includes("action")) {
        // NPC decision response - must be valid JSON
        content = JSON.stringify({
            action: "attack",
            description: "lunges forward with a fierce attack",
            target: "Player"
        });
    } else if (request.systemPrompt.includes("compel")) {
        // Compel response - return null for no compel
        content = "null";
    } else if (request.systemPrompt.includes("dialogue") || request.systemPrompt.includes("Dialogue")) {
        content = "Greetings, traveler. What brings you to these parts?";
    } else if (request.systemPrompt.includes("knowledge") && request.systemPrompt.includes("gain")) {
        content = JSON.stringify({
            category: "locations",
            id: "loc-discovered",
            data: { name: "Hidden Area", discovered: true }
        });
    } else if (request.systemPrompt.includes("quest") && request.systemPrompt.includes("update")) {
        content = JSON.stringify({
            type: "update_objective",
            questId: "quest-1",
            objectiveId: "obj-1",
            status: "completed"
        });
    } else if (request.systemPrompt.includes("world") && request.systemPrompt.includes("update")) {
        content = JSON.stringify([{
            type: "add_aspect",
            data: { name: "Changed Environment", type: "situational" }
        }]);
    } else if (request.systemPrompt.includes("declaration")) {
        content = "Hidden Passage Behind Bookshelf";
    } else if (request.systemPrompt.includes("boost")) {
        content = "Momentum";
    } else if (request.systemPrompt.includes("Game Master")) {
        // Fallback for any other Game Master prompts
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
