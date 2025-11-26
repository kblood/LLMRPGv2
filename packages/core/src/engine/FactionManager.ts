import { 
  Faction, 
  FactionSchema, 
  getFactionRank, 
  FactionRank,
  WorldState
} from '@llmrpg/protocol';
import { v4 as uuidv4 } from 'uuid';

export class FactionManager {
  private worldState: WorldState;

  constructor(worldState: WorldState) {
    this.worldState = worldState;
    // Ensure factions object exists
    if (!this.worldState.factions) {
      this.worldState.factions = {};
    }
  }

  /**
   * Create a new faction
   */
  createFaction(data: Partial<Faction> & { name: string }): Faction {
    const id = data.id || uuidv4();
    
    const faction: Faction = {
      id,
      name: data.name,
      description: data.description || '',
      aspects: data.aspects || [],
      goals: data.goals || [],
      members: data.members || [],
      relationships: data.relationships || {},
      territory: data.territory || [],
      resources: data.resources || [],
      isHidden: data.isHidden || false,
    };

    // Validate
    const result = FactionSchema.safeParse(faction);
    if (!result.success) {
      throw new Error(`Invalid faction data: ${result.error.message}`);
    }

    this.worldState.factions[id] = faction;
    return faction;
  }

  /**
   * Get a faction by ID
   */
  getFaction(id: string): Faction | undefined {
    return this.worldState.factions[id];
  }

  /**
   * Get all factions
   */
  getAllFactions(): Faction[] {
    return Object.values(this.worldState.factions);
  }

  /**
   * Get factions that know about a specific NPC
   */
  getFactionsWithMember(npcId: string): Faction[] {
    return this.getAllFactions().filter(f => f.members.includes(npcId));
  }

  /**
   * Update reputation between a faction and a target (player or other faction)
   */
  updateReputation(factionId: string, targetId: string, change: number): number {
    const faction = this.getFaction(factionId);
    if (!faction) throw new Error(`Faction ${factionId} not found`);

    const current = faction.relationships[targetId] || 0;
    const newRep = Math.max(-100, Math.min(100, current + change));
    
    faction.relationships[targetId] = newRep;
    return newRep;
  }

  /**
   * Set absolute reputation
   */
  setReputation(factionId: string, targetId: string, value: number): void {
    const faction = this.getFaction(factionId);
    if (!faction) throw new Error(`Faction ${factionId} not found`);

    faction.relationships[targetId] = Math.max(-100, Math.min(100, value));
  }

  /**
   * Get reputation value
   */
  getReputation(factionId: string, targetId: string): number {
    const faction = this.getFaction(factionId);
    if (!faction) return 0;
    return faction.relationships[targetId] || 0;
  }

  /**
   * Get reputation rank (hostile, friendly, etc.)
   */
  getRank(factionId: string, targetId: string): FactionRank {
    const rep = this.getReputation(factionId, targetId);
    return getFactionRank(rep);
  }

  /**
   * Add a member to a faction
   */
  addMember(factionId: string, npcId: string): void {
    const faction = this.getFaction(factionId);
    if (!faction) throw new Error(`Faction ${factionId} not found`);

    if (!faction.members.includes(npcId)) {
      faction.members.push(npcId);
    }
  }

  /**
   * Remove a member from a faction
   */
  removeMember(factionId: string, npcId: string): void {
    const faction = this.getFaction(factionId);
    if (!faction) throw new Error(`Faction ${factionId} not found`);

    faction.members = faction.members.filter((id: string) => id !== npcId);
  }

  /**
   * Add territory to a faction
   */
  addTerritory(factionId: string, locationId: string): void {
    const faction = this.getFaction(factionId);
    if (!faction) throw new Error(`Faction ${factionId} not found`);

    if (!faction.territory.includes(locationId)) {
      faction.territory.push(locationId);
    }
  }

  /**
   * Remove territory from a faction
   */
  removeTerritory(factionId: string, locationId: string): void {
    const faction = this.getFaction(factionId);
    if (!faction) throw new Error(`Faction ${factionId} not found`);

    faction.territory = faction.territory.filter((id: string) => id !== locationId);
  }
}
