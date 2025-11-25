import { LLMProvider, ContextBuilder } from '@llmrpg/llm';

export class DecisionEngine {
  private contextBuilder: ContextBuilder;

  constructor(private llm: LLMProvider) {
    this.contextBuilder = new ContextBuilder();
  }

  async setOpposition(context: any): Promise<number> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Game Master",
      `You are the Game Master. Determine the difficulty of actions based on the Fate Ladder.

FATE LADDER:
+8 Legendary
+7 Epic
+6 Fantastic
+5 Superb
+4 Great
+3 Good
+2 Fair
+1 Average
0 Mediocre
-1 Poor
-2 Terrible

GUIDELINES:
- Average (+1) is routine for competent people.
- Fair (+2) is a challenge for professionals.
- Great (+4) is a serious challenge.
- Superb (+5) and above are heroic feats.

Output ONLY the number representing the difficulty.`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Determine the difficulty for this action:\n${JSON.stringify(context)}\n\nReturn only a number representing the difficulty on the Fate Ladder (e.g., 2 for Fair, 4 for Great).`
    });

    try {
      const response = await this.llm.generate({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        temperature: 0.3
      });

      const difficulty = parseInt(response.content.trim());
      return isNaN(difficulty) ? 2 : difficulty;
    } catch (error) {
      console.error("Decision generation failed:", error);
      return 2; // Default to Fair
    }
  }
}
