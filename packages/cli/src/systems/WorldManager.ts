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
      aspects: [],
      time: { 
        value: "0", 
        period: "Day" 
      },
      plotThreads: [],
      quests: [],
      establishedFacts: {}
    };
  }

  get state(): WorldState {
    return this._state;
  }

  set state(newState: WorldState) {
    // Validate schema if needed, but for now just set it
    this._state = newState;
  }

  /**
   * Get a location by ID
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
   * Add or update a location
   */
  setLocation(location: Location): void {
    this._state.locations[location.id] = location;
  }

  /**
   * Get all locations
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
   * Add a global aspect
   */
  addAspect(aspect: Aspect): void {
    this._state.aspects.push(aspect);
  }

  /**
   * Remove a global aspect by ID
   */
  removeAspect(aspectId: string): void {
    this._state.aspects = this._state.aspects.filter(a => a.id !== aspectId);
  }
}
