import { Location } from '@llmrpg/protocol';

/**
 * LocationRegistry manages the persistence and lookup of locations across sessions.
 * It maintains:
 * - Stable location IDs that don't change between sessions
 * - Bidirectional connections between locations
 * - A name → ID mapping for finding previously-discovered locations
 * - Location relationship graph to prevent duplicate generation
 */
export class LocationRegistry {
  private locations: Map<string, Location> = new Map();
  private locationsByName: Map<string, Set<string>> = new Map();
  private connectionGraph: Map<string, Map<string, string>> = new Map(); // locId -> (direction -> targetId)

  /**
   * Register a location in the registry
   */
  registerLocation(location: Location): void {
    this.locations.set(location.id, location);

    // Index by name for fuzzy lookup
    const nameLower = location.name.toLowerCase();
    if (!this.locationsByName.has(nameLower)) {
      this.locationsByName.set(nameLower, new Set());
    }
    this.locationsByName.get(nameLower)!.add(location.id);

    // Build connection graph
    if (!this.connectionGraph.has(location.id)) {
      this.connectionGraph.set(location.id, new Map());
    }
    const graph = this.connectionGraph.get(location.id)!;
    for (const conn of location.connections) {
      if (conn.direction) {
        graph.set(conn.direction.toLowerCase(), conn.targetId);
      }
    }
  }

  /**
   * Bulk register multiple locations (for session load)
   */
  registerLocations(locations: Location[]): void {
    for (const location of locations) {
      this.registerLocation(location);
    }
  }

  /**
   * Get a location by ID
   */
  getLocationById(id: string): Location | undefined {
    return this.locations.get(id);
  }

  /**
   * Find locations by name (case-insensitive)
   */
  getLocationsByName(name: string): Location[] {
    const nameLower = name.toLowerCase();
    const ids = this.locationsByName.get(nameLower) || new Set();
    return Array.from(ids)
      .map(id => this.locations.get(id))
      .filter((loc): loc is Location => loc !== undefined);
  }

  /**
   * Get the target location for a given direction from a source location
   */
  getTarget(sourceLocationId: string, direction: string): string | undefined {
    const graph = this.connectionGraph.get(sourceLocationId);
    if (!graph) return undefined;
    return graph.get(direction.toLowerCase());
  }

  /**
   * Check if a connection already exists between two locations
   */
  hasConnection(fromId: string, toId: string, direction?: string): boolean {
    if (direction) {
      return this.getTarget(fromId, direction) === toId;
    }
    // Check if any connection exists between these locations
    const graph = this.connectionGraph.get(fromId);
    if (!graph) return false;
    return Array.from(graph.values()).includes(toId);
  }

  /**
   * Add a bidirectional connection between two locations
   */
  addConnection(
    fromId: string,
    toId: string,
    fromDirection: string,
    toDirection: string,
    description?: string
  ): void {
    // Get or create locations
    const fromLoc = this.locations.get(fromId);
    const toLoc = this.locations.get(toId);

    if (!fromLoc || !toLoc) {
      throw new Error(`Cannot connect: one or both locations not registered`);
    }

    // Add connection from → to
    if (!fromLoc.connections.find(c => c.targetId === toId && c.direction === fromDirection)) {
      fromLoc.connections.push({
        targetId: toId,
        direction: fromDirection,
        description,
        isBlocked: false
      });
    }

    // Add reverse connection to → from
    if (!toLoc.connections.find(c => c.targetId === fromId && c.direction === toDirection)) {
      toLoc.connections.push({
        targetId: fromId,
        direction: toDirection,
        description: description ? `${description} (back)` : undefined,
        isBlocked: false
      });
    }

    // Update connection graph
    if (!this.connectionGraph.has(fromId)) {
      this.connectionGraph.set(fromId, new Map());
    }
    this.connectionGraph.get(fromId)!.set(fromDirection.toLowerCase(), toId);

    if (!this.connectionGraph.has(toId)) {
      this.connectionGraph.set(toId, new Map());
    }
    this.connectionGraph.get(toId)!.set(toDirection.toLowerCase(), fromId);
  }

  /**
   * Get all registered locations
   */
  getAllLocations(): Location[] {
    return Array.from(this.locations.values());
  }

  /**
   * Get nearby locations (locations directly connected to a given location)
   */
  getNearbyLocations(locationId: string): Location[] {
    const location = this.locations.get(locationId);
    if (!location) return [];

    return location.connections
      .map(conn => this.locations.get(conn.targetId))
      .filter((loc): loc is Location => loc !== undefined);
  }

  /**
   * Find locations within a certain graph distance
   */
  getLocationsWithin(sourceId: string, maxDistance: number): Map<string, number> {
    const visited = new Map<string, number>();
    const queue: [string, number][] = [[sourceId, 0]];

    while (queue.length > 0) {
      const [locId, distance] = queue.shift()!;

      if (visited.has(locId)) continue;
      if (distance > maxDistance) continue;

      visited.set(locId, distance);

      const nearby = this.getNearbyLocations(locId);
      for (const loc of nearby) {
        if (!visited.has(loc.id)) {
          queue.push([loc.id, distance + 1]);
        }
      }
    }

    visited.delete(sourceId); // Don't include source
    return visited;
  }

  /**
   * Generate a stable ID for a new location
   * Format: loc-{region}-{sequence}
   */
  generateStableLocationId(regionPrefix: string, sequenceNumber: number): string {
    return `loc-${regionPrefix}-${String(sequenceNumber).padStart(4, '0')}`;
  }

  /**
   * Clear the registry (for testing)
   */
  clear(): void {
    this.locations.clear();
    this.locationsByName.clear();
    this.connectionGraph.clear();
  }
}
