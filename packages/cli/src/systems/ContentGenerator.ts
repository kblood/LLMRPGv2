import { LLMProvider, ContextBuilder } from '@llmrpg/llm';
import { WorldState, Location, Aspect } from '@llmrpg/protocol';

export class ContentGenerator {
  private contextBuilder: ContextBuilder;

  constructor(private llm: LLMProvider) {
    this.contextBuilder = new ContextBuilder();
  }

  async generateWorldTheme(input: string): Promise<WorldState['theme']> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "World Builder",
      `You are an expert World Builder for a Fate Core RPG. Generate a compelling world theme based on the user's input.

GUIDELINES:
- The theme should be cohesive and provide a strong foundation for adventure.
- Define the genre, tone, and key themes.
- Provide a list of keywords that capture the essence of the world.

OUTPUT FORMAT:
JSON with fields:
- name: string (Name of the setting)
- genre: string (e.g., "Cyberpunk", "High Fantasy", "Noir")
- tone: string (e.g., "Gritty", "Whimsical", "Dark")
- keywords: string[] (5-7 keywords)`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Generate a world theme based on this input: "${input}".\nReturn JSON.`
    });

    const response = await this.llm.generate({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0.9,
      jsonMode: true
    });

    try {
      return JSON.parse(response.content);
    } catch (e) {
      console.error("Failed to parse generated theme:", e);
      return {
        name: "The Unknown Lands",
        genre: "Fantasy",
        tone: "Mysterious",
        keywords: ["Magic", "Ruins", "Exploration"]
      };
    }
  }

  async generateStartingLocation(theme: WorldState['theme']): Promise<Location> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "World Builder",
      `You are an expert World Builder for a Fate Core RPG. Generate a starting location for a new campaign.

THEME CONTEXT:
Name: ${theme.name}
Genre: ${theme.genre}
Tone: ${theme.tone}
Keywords: ${theme.keywords.join(", ")}

GUIDELINES:
- The location should be a suitable starting point for an adventure (e.g., a tavern, a space station hub, a detective's office).
- Include 2-3 interesting Aspects.
- Include 1-2 interactive features.

OUTPUT FORMAT:
JSON with fields:
- name: string
- description: string
- aspects: { name: string, type: "situation" | "environment" }[]
- features: { name: string, description: string }[]`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Generate a starting location for this world.\nReturn JSON.`
    });

    const response = await this.llm.generate({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0.8,
      jsonMode: true
    });

    try {
      const data = JSON.parse(response.content);
      
      // Map to Location type
      return {
        id: `loc-${Date.now()}`,
        name: data.name,
        description: data.description,
        aspects: data.aspects.map((a: any) => ({
          id: `asp-${Math.random().toString(36).substr(2, 9)}`,
          name: a.name,
          kind: a.type || 'situation',
          isTemporary: false
        })),
        connections: [],
        presentNPCs: [],
        features: data.features.map((f: any) => ({
          id: `feat-${Math.random().toString(36).substr(2, 9)}`,
          name: f.name,
          description: f.description,
          interactable: true
        })),
        discovered: true,
        tier: 'locale'
      };
    } catch (e) {
      console.error("Failed to parse generated location:", e);
      return {
        id: `loc-${Date.now()}`,
        name: "The Beginning",
        description: "A generic starting point.",
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: true,
        tier: 'locale'
      };
    }
  }

  async generateStartingScenario(theme: WorldState['theme'], location: Location): Promise<{ title: string; description: string; hook: string }> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Narrative Designer",
      `You are an expert Narrative Designer for a Fate Core RPG. Generate an engaging starting scenario for a new campaign.

THEME CONTEXT:
Name: ${theme.name}
Genre: ${theme.genre}
Tone: ${theme.tone}

STARTING LOCATION:
Name: ${location.name}
Description: ${location.description}

GUIDELINES:
- Create a scenario that immediately involves the player.
- Provide a hook that gives the player a clear goal or problem to solve.
- The scenario should take place in the starting location.

OUTPUT FORMAT:
JSON with fields:
- title: string (Title of the scenario)
- description: string (Opening narration/description of the situation)
- hook: string (The immediate call to action or problem)`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Generate a starting scenario.\nReturn JSON.`
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
      console.error("Failed to parse generated scenario:", e);
      return {
        title: "The Beginning",
        description: "You find yourself at the start of your journey.",
        hook: "What do you do?"
      };
    }
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

  async generateCharacter(concept: string, theme: WorldState['theme']): Promise<any> {
    const systemPrompt = this.contextBuilder.buildSystemPrompt(
      "Character Creator",
      `You are an expert Character Creator for a Fate Core RPG. Generate a complete player character based on the user's concept.

THEME CONTEXT:
Name: ${theme.name}
Genre: ${theme.genre}
Tone: ${theme.tone}

GUIDELINES:
- The character should fit the world theme and the user's concept.
- Follow Fate Core rules for Aspects (High Concept, Trouble, 3 others).
- Follow Fate Core rules for Skills (Pyramid: One +4, Two +3, Three +2, Four +1).
- Create 3 Stunts that reflect the character's skills and aspects.
- Define a distinct personality and voice.

OUTPUT FORMAT:
JSON with fields:
- name: string
- appearance: string
- aspects: { name: string, type: "highConcept" | "trouble" | "other" }[]
- skills: { name: string, level: number }[]
- stunts: { name: string, description: string }[]
- personality: {
    traits: string[],
    values: string[],
    quirks: string[],
    fears: string[],
    desires: string[]
  }
- backstory: {
    origin: string,
    formativeEvent: string,
    secret: string,
    summary: string
  }
- voice: {
    speechPattern: string,
    vocabulary: "simple" | "moderate" | "sophisticated" | "archaic",
    phrases: string[],
    quirks: string[]
  }`
    );

    const prompt = this.contextBuilder.assemblePrompt({
      systemPrompt,
      immediateContext: `Generate a character based on this concept: "${concept}".\nReturn JSON.`
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
      console.error("Failed to parse generated character:", e);
      // Return a fallback character
      return {
        name: "The Stranger",
        appearance: "A mysterious figure in a cloak.",
        aspects: [
            { name: "Mysterious Stranger", type: "highConcept" },
            { name: "Dark Past", type: "trouble" },
            { name: "Quick Reflexes", type: "other" }
        ],
        skills: [{ name: "Fight", level: 4 }],
        stunts: [{ name: "First Strike", description: "+2 to Fight when attacking first." }],
        personality: {
            traits: ["Quiet", "Observant"],
            values: ["Survival"],
            quirks: [],
            fears: ["Discovery"],
            desires: ["Redemption"]
        },
        backstory: {
            origin: "Unknown",
            formativeEvent: "The Great War",
            secret: "I am a deserter.",
            summary: "A soldier running from their past."
        },
        voice: {
            speechPattern: "Gruff and short",
            vocabulary: "simple",
            phrases: ["Hmph."],
            quirks: []
        }
      };
    }
  }
}
