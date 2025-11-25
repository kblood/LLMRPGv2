import { LLMProvider, ContextBuilder } from '@llmrpg/llm';

export class ContentGenerator {
  private contextBuilder: ContextBuilder;

  constructor(private llm: LLMProvider) {
    this.contextBuilder = new ContextBuilder();
  }

  async generateLocation(description: string) {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "World Builder",
      `You are an expert World Builder for a Fate Core RPG. Generate interesting locations with Aspects.

GUIDELINES:
- Locations should be evocative and fit the genre.
- Aspects should be double-edged (can be invoked or compelled).
- Descriptions should appeal to multiple senses.

OUTPUT FORMAT:
JSON with fields:
- name: string
- description: string
- aspects: string[]`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Generate a location based on this description: "${description}".\nReturn JSON with fields: name, description, aspects (array of strings).`
    });

    const response = await this.llm.generate({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0.8,
      jsonMode: true
    });

    try {
      return JSON.parse(response.content);
    } catch (e) {
      console.error("Failed to parse generated location:", e);
      return {
        name: "Unknown Location",
        description: description,
        aspects: ["Mystery"]
      };
    }
  }
}
