import { 
  KnowledgeProfile, 
  LocationKnowledge, 
  NPCKnowledge, 
  QuestKnowledge,
  FactionKnowledge,
  SecretKnowledge,
  ItemKnowledge
} from '@llmrpg/protocol';

export class KnowledgeManager {
  
  static createEmptyProfile(): KnowledgeProfile {
    return {
      locations: {},
      npcs: {},
      quests: {},
      factions: {},
      secrets: {},
      items: {},
      topics: {}
    };
  }

  /**
   * Update knowledge about a location
   */
  static updateLocation(
    profile: KnowledgeProfile, 
    locationId: string, 
    data: Partial<LocationKnowledge>,
    turn: number
  ): void {
    const existing = profile.locations[locationId] || {
      locationId,
      name: "Unknown Location",
      known: true,
      confidence: 'medium',
      visited: false,
      knownSince: turn
    };
    
    profile.locations[locationId] = {
      ...existing,
      ...data,
      lastUpdated: turn
    };
  }

  /**
   * Update knowledge about an NPC
   */
  static updateNPC(
    profile: KnowledgeProfile, 
    npcId: string, 
    data: Partial<NPCKnowledge>,
    turn: number
  ): void {
    const existing = profile.npcs[npcId] || {
      npcId,
      name: "Unknown NPC",
      known: true,
      confidence: 'medium',
      knownSince: turn
    };
    
    profile.npcs[npcId] = {
      ...existing,
      ...data,
      lastUpdated: turn
    };
  }

  /**
   * Update knowledge about a Quest
   */
  static updateQuest(
    profile: KnowledgeProfile, 
    questId: string, 
    data: Partial<QuestKnowledge>,
    turn: number
  ): void {
    const existing = profile.quests[questId] || {
      questId,
      title: "Unknown Quest",
      description: "",
      known: true,
      confidence: 'medium',
      status: 'unknown',
      knownSince: turn
    };
    
    profile.quests[questId] = {
      ...existing,
      ...data,
      lastUpdated: turn
    };
  }

  /**
   * Update knowledge about a Faction
   */
  static updateFaction(
    profile: KnowledgeProfile, 
    factionId: string, 
    data: Partial<FactionKnowledge>,
    turn: number
  ): void {
    const existing = profile.factions[factionId] || {
      factionId,
      name: "Unknown Faction",
      known: true,
      confidence: 'medium',
      reputation: 0,
      knownSince: turn
    };
    
    profile.factions[factionId] = {
      ...existing,
      ...data,
      lastUpdated: turn
    };
  }

  /**
   * Update knowledge about a Secret
   */
  static updateSecret(
    profile: KnowledgeProfile, 
    secretId: string, 
    data: Partial<SecretKnowledge>,
    turn: number
  ): void {
    const existing = profile.secrets[secretId] || {
      secretId,
      topic: "Unknown Secret",
      content: "",
      known: true,
      confidence: 'medium',
      verified: false,
      knownSince: turn
    };
    
    profile.secrets[secretId] = {
      ...existing,
      ...data,
      lastUpdated: turn
    };
  }

  /**
   * Update knowledge about an Item
   */
  static updateItem(
    profile: KnowledgeProfile, 
    itemId: string, 
    data: Partial<ItemKnowledge>,
    turn: number
  ): void {
    const existing = profile.items[itemId] || {
      itemId,
      name: "Unknown Item",
      known: true,
      confidence: 'medium',
      knownSince: turn
    };
    
    profile.items[itemId] = {
      ...existing,
      ...data,
      lastUpdated: turn
    };
  }

  /**
   * Update knowledge about a Topic
   */
  static updateTopic(
    profile: KnowledgeProfile, 
    topicId: string, 
    data: { topic: string; knowledgeLevel: 'novice' | 'intermediate' | 'expert' | 'master'; details: string },
    turn: number
  ): void {
    profile.topics[topicId] = {
      ...data
    };
  }

  /**
   * Check if a character knows about a specific entity
   */
  static knows(profile: KnowledgeProfile, category: keyof KnowledgeProfile, id: string): boolean {
    const cat = profile[category] as Record<string, { known: boolean }>;
    return cat[id]?.known || false;
  }

  /**
   * Get all known items in a category
   */
  static getKnown(profile: KnowledgeProfile, category: keyof KnowledgeProfile): any[] {
    const cat = profile[category] as Record<string, { known: boolean }>;
    return Object.values(cat).filter(item => item.known);
  }
}
