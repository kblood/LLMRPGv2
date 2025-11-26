import { KnowledgeProfile } from '@llmrpg/protocol';

export interface Stunt {
  name: string;
  description: string;
  mechanical: string;
}

export interface Relationship {
  targetId: string;
  targetName: string;
  aspect: string;
  attitude: number; // -100 to +100
  history: string;
}

export interface CharacterDefinition {
  // === IDENTITY ===
  id: string;
  name: string;

  // Fate Core Aspects
  highConcept: string;
  trouble: string;
  aspects: string[];

  // === PERSONALITY ===
  personality: {
    traits: string[];
    values: string[];
    fears: string[];
    quirks: string[];
    speechPattern: string;
  };

  // === BACKSTORY ===
  backstory: {
    summary: string;
    origin: string;
    motivation: string;
    secrets: string[];
    keyEvents: string[];
  };

  // === CAPABILITIES ===
  skills: Record<string, number>;
  stunts: Stunt[];

  // === AFFILIATIONS ===
  affiliations?: {
    factionId: string;
    factionName: string;
    role: string;
    loyalty: number;
  }[];

  // === CURRENT STATE ===
  stress: {
    physical: boolean[];
    mental: boolean[];
  };
  consequences: {
    mild?: string;
    moderate?: string;
    severe?: string;
  };
  fatePoints: number;

  // === RELATIONSHIPS ===
  relationships: Relationship[];

  // === KNOWLEDGE ===
  knowledge: KnowledgeProfile;
}
