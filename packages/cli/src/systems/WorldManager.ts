import { WorldState, Location, Aspect, WorldStateSchema } from '@llmrpg/protocol';
import { LocationRegistry } from '@llmrpg/core';

export class WorldManager {
  private _state: WorldState;
  private locationRegistry: LocationRegistry;

  constructor(initialState?: WorldState) {
    this._state = initialState || this.createDefaultState();
    this.locationRegistry = new LocationRegistry();
    // Initialize registry with existing locations
    if (this._state.locations) {
      this.locationRegistry.registerLocations(Object.values(this._state.locations));
    }
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
      events: [],
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
   * Also registers it in the LocationRegistry (Phase 23)
   */
  setLocation(location: Location): void {
    this._state.locations[location.id] = location;
    this.locationRegistry.registerLocation(location);
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

  // ============ Phase 23: Location Persistence Methods ============

  /**
   * Get the LocationRegistry for advanced location operations
   */
  getLocationRegistry(): LocationRegistry {
    return this.locationRegistry;
  }

  /**
   * Add a bidirectional connection between two locations (Phase 23)
   */
  addLocationConnection(
    fromId: string,
    toId: string,
    fromDirection: string,
    toDirection: string,
    description?: string
  ): void {
    try {
      this.locationRegistry.addConnection(fromId, toId, fromDirection, toDirection, description);

      // Update the location objects in state
      const fromLoc = this._state.locations[fromId];
      const toLoc = this._state.locations[toId];
      if (fromLoc && toLoc) {
        // Location objects are already updated by registry.addConnection()
        // Just ensure they're in sync with world state
        this.setLocation(fromLoc);
        this.setLocation(toLoc);
      }
    } catch (error) {
      console.error(`Failed to add location connection: ${error}`);
    }
  }

  /**
   * Get nearby locations for exploration/travel (Phase 23)
   */
  getNearbyLocations(locationId: string): Location[] {
    return this.locationRegistry.getNearbyLocations(locationId);
  }

  /**
   * Get locations within graph distance (for map generation, Phase 23)
   */
  getLocationsWithinDistance(locationId: string, maxDistance: number): Map<string, number> {
    return this.locationRegistry.getLocationsWithin(locationId, maxDistance);
  }

  /**
   * Find location by name in registry (supports multiple same-named locations, Phase 23)
   */
  findLocationsByName(name: string): Location[] {
    return this.locationRegistry.getLocationsByName(name);
  }

  /**
   * Check if a connection already exists (prevents duplicates, Phase 23)
   */
  hasLocationConnection(fromId: string, toId: string, direction?: string): boolean {
    return this.locationRegistry.hasConnection(fromId, toId, direction);
  }

  /**
   * Generate a stable location ID for a region (Phase 23)
   */
  generateStableLocationId(regionPrefix: string, sequenceNumber: number): string {
    return this.locationRegistry.generateStableLocationId(regionPrefix, sequenceNumber);
  }
}
