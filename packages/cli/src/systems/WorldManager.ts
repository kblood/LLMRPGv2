import { WorldState, Location, Aspect, WorldStateSchema } from '@llmrpg/protocol';

export class WorldManager {
  private _state: WorldState;

  constructor(initialState?: WorldState) {
    this._state = initialState || this.createDefaultState();
  }

  private createDefaultState(): WorldState {
    return {
      theme: {
        name: "Unknown",
        genre: "Unknown",
        tone: "Neutral",
        keywords: []
      },
      locations: {},
      aspects: [], // Global world aspects
      time: {
        value: "0",
        period: "Day"
      },
      plotThreads: [],
      quests: [],
      factions: {},
      establishedFacts: {}
    };
  }

  get state(): WorldState {
    return this._state;
  }

  set state(newState: WorldState) {
    this._state = newState;
  }

  /**
   * Get current scene aspects (Fate Core style)
   * In Fate, the world state is primarily aspects describing the situation
   */
  getCurrentSceneAspects(): Aspect[] {
    // For now, return global aspects. In full implementation,
    // this would combine global + scene-specific aspects
    return this._state.aspects;
  }

  /**
   * Add an aspect to the current scene/situation
   * This is how the world "changes" in Fate Core
   */
  addSceneAspect(aspect: Aspect): void {
    // Check if aspect already exists
    const existing = this._state.aspects.find(a => a.name === aspect.name);
    if (!existing) {
      this._state.aspects.push(aspect);
    }
  }

  /**
   * Remove a scene aspect
   */
  removeSceneAspect(aspectId: string): void {
    this._state.aspects = this._state.aspects.filter(a => a.id !== aspectId);
  }

  /**
   * Get aspects that can be invoked/compelled for a given situation
   */
  getRelevantAspects(situation: string): Aspect[] {
    // In Fate Core, aspects are relevant if they apply to the current situation
    // For now, return all aspects. In full implementation, this would filter
    // based on situation keywords and aspect types
    return this._state.aspects;
  }

  /**
   * Declare a new aspect (Fate Point declaration)
   * This allows players to add story details to the world
   */
  declareAspect(aspect: Aspect): void {
    this.addSceneAspect(aspect);
  }

  /**
   * Get a location by ID (simplified for Fate Core)
   * In Fate, locations are just named places, not detailed simulations
   */
  getLocation(id: string): Location | undefined {
    return this._state.locations[id];
  }

  /**
   * Get a location by name (case-insensitive exact match)
   */
  getLocationByName(name: string): Location | undefined {
    return Object.values(this._state.locations).find(
      loc => loc.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Add or update a location (minimal for Fate Core)
   */
  setLocation(location: Location): void {
    this._state.locations[location.id] = location;
  }

  /**
   * Get all locations (for travel options)
   */
  getAllLocations(): Location[] {
    return Object.values(this._state.locations);
  }

  /**
   * Get connected locations for a given location ID
   */
  getConnections(locationId: string): { location: Location; description?: string; direction?: string }[] {
    const location = this.getLocation(locationId);
    if (!location) return [];

    return location.connections
      .map(conn => {
        const target = this.getLocation(conn.targetId);
        if (!target) return null;
        return {
          location: target,
          description: conn.description,
          direction: conn.direction
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  /**
   * Update world time
   */
  setTime(value: string, period?: string): void {
    this._state.time = { value, period };
  }

  /**
   * Add a global aspect (persistent world truth)
   */
  addGlobalAspect(aspect: Aspect): void {
    this._state.aspects.push(aspect);
  }

  /**
   * Remove a global aspect by ID
   */
  removeGlobalAspect(aspectId: string): void {
    this._state.aspects = this._state.aspects.filter(a => a.id !== aspectId);
  }

  /**
   * Get established facts (things that have become permanent world truth)
   */
  getEstablishedFacts(): Record<string, any> {
    return this._state.establishedFacts;
  }

  /**
   * Establish a fact (make something permanent about the world)
   */
  establishFact(key: string, value: any): void {
    this._state.establishedFacts[key] = value;
  }
}
