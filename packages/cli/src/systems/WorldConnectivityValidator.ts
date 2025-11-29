/**
 * Validates world connectivity and ensures playability
 * Checks that all locations are reachable and escape routes exist
 */

import { Location } from '@llmrpg/protocol';

export interface LocationNode {
  id: string;
  name: string;
  depth: number;                    // Distance from start
  canReachStart: boolean;           // Path back to starting location?
  neighbors: string[];              // Connected location IDs
  isDeadEnd: boolean;               // Only one exit?
  hasContent: boolean;              // NPCs, features, or quests?
  contentCount: number;             // Number of meaningful things here
}

export interface WorldGraph {
  locations: Map<string, LocationNode>;
  startingLocationId: string;
  stats: {
    totalLocations: number;
    connectedLocations: number;    // Reachable from start
    unreachableCount: number;
    deadEndCount: number;
    averageDepth: number;
    maxDepth: number;
    cycles: number;                // Circular paths (shortcuts/loops)
    avgContentPerLocation: number;
  };
}

export interface ConnectivityIssue {
  type: 'unreachable' | 'trapped' | 'sparse' | 'linear' | 'no_content';
  locationId: string;
  locationName: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  suggestion: string;
}

export interface ConnectivityReport {
  isValid: boolean;
  graph: WorldGraph;
  issues: ConnectivityIssue[];
  summary: string;
}

/**
 * Build a graph representation of the world
 */
export function buildWorldGraph(
  locations: Record<string, Location>,
  startingLocationId: string
): WorldGraph {
  const graph = new Map<string, LocationNode>();
  const visited = new Set<string>();
  const queue: [string, number][] = [[startingLocationId, 0]];

  // BFS to calculate depths and connectivity
  while (queue.length > 0) {
    const [locationId, depth] = queue.shift()!;
    if (visited.has(locationId)) continue;

    visited.add(locationId);
    const location = locations[locationId];
    if (!location) continue;

    const neighbors = (location.connections || []).map(c => c.targetId);
    const isDeadEnd = (location.connections || []).filter(c => !c.isBlocked).length <= 1;
    const contentCount = (location.features || []).length + (location.presentNPCs || []).length;

    graph.set(locationId, {
      id: locationId,
      name: location.name,
      depth,
      canReachStart: false, // Will update in reverse pass
      neighbors,
      isDeadEnd,
      hasContent: contentCount > 0,
      contentCount,
    });

    // Add unvisited neighbors to queue
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        queue.push([neighborId, depth + 1]);
      }
    }
  }

  // Reverse pass: check which locations can reach start
  for (const [locationId, node] of graph.entries()) {
    node.canReachStart = canReachLocation(locationId, startingLocationId, locations, graph);
  }

  // Count cycles (simplified: any location with 2+ neighbors that both have other neighbors)
  let cycles = 0;
  for (const node of graph.values()) {
    if (node.neighbors.length >= 2) {
      cycles++;
    }
  }

  const nodes = Array.from(graph.values());
  const depths = nodes.map(n => n.depth);
  const contents = nodes.map(n => n.contentCount);

  return {
    locations: graph,
    startingLocationId,
    stats: {
      totalLocations: graph.size,
      connectedLocations: Array.from(graph.values()).filter(n => n.depth >= 0).length,
      unreachableCount: Object.keys(locations).length - graph.size,
      deadEndCount: Array.from(graph.values()).filter(n => n.isDeadEnd).length,
      averageDepth: depths.length > 0 ? depths.reduce((a, b) => a + b) / depths.length : 0,
      maxDepth: depths.length > 0 ? Math.max(...depths) : 0,
      cycles: Math.floor(cycles / 2), // Rough estimate
      avgContentPerLocation: contents.length > 0 ? contents.reduce((a, b) => a + b) / contents.length : 0,
    },
  };
}

/**
 * DFS to check if location can reach target
 */
function canReachLocation(
  from: string,
  to: string,
  locations: Record<string, Location>,
  graph: Map<string, LocationNode>
): boolean {
  if (from === to) return true;

  const visited = new Set<string>();
  const stack = [from];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (current === to) return true;

    const location = locations[current];
    if (!location) continue;

    for (const conn of location.connections || []) {
      if (!conn.isBlocked && !visited.has(conn.targetId)) {
        stack.push(conn.targetId);
      }
    }
  }

  return false;
}

/**
 * Validate that world is playable
 */
export function validateWorldConnectivity(
  locations: Record<string, Location>,
  startingLocationId: string
): ConnectivityReport {
  const graph = buildWorldGraph(locations, startingLocationId);
  const issues: ConnectivityIssue[] = [];

  // Check for unreachable locations
  for (const [locId, location] of Object.entries(locations)) {
    if (!graph.locations.has(locId)) {
      issues.push({
        type: 'unreachable',
        locationId: locId,
        locationName: location.name,
        severity: 'error',
        description: `Location "${location.name}" is not reachable from the starting area`,
        suggestion: 'Add a connection from an explored area to this location',
      });
    }
  }

  // Check for locations that can't reach back to start
  for (const [locId, node] of graph.locations.entries()) {
    if (!node.canReachStart && locId !== startingLocationId) {
      issues.push({
        type: 'trapped',
        locationId: locId,
        locationName: node.name,
        severity: 'error',
        description: `Location "${node.name}" has no path back to the starting area`,
        suggestion: 'Add a return connection or ensure at least one exit leads to a connected area',
      });
    }
  }

  // Check for sparse content
  if (graph.stats.avgContentPerLocation < 1.5) {
    issues.push({
      type: 'sparse',
      locationId: startingLocationId,
      locationName: 'World',
      severity: 'warning',
      description: `Average content per location is low (${graph.stats.avgContentPerLocation.toFixed(1)} items/NPCs per location)`,
      suggestion: 'Consider adding more features, NPCs, or details to make exploration more rewarding',
    });
  }

  // Check for overly linear structure
  if (graph.stats.cycles < 2 && graph.stats.totalLocations > 5) {
    issues.push({
      type: 'linear',
      locationId: startingLocationId,
      locationName: 'World',
      severity: 'info',
      description: 'World structure is very linear with few alternative paths',
      suggestion: 'Consider adding shortcut connections to give players more exploration options',
    });
  }

  // Check world size
  if (graph.stats.totalLocations < 5) {
    issues.push({
      type: 'sparse',
      locationId: startingLocationId,
      locationName: 'World',
      severity: 'warning',
      description: `World is small (${graph.stats.totalLocations} locations total)`,
      suggestion: 'For a richer experience, consider generating 8-10 locations',
    });
  }

  if (graph.stats.totalLocations > 10) {
    issues.push({
      type: 'sparse',
      locationId: startingLocationId,
      locationName: 'World',
      severity: 'warning',
      description: `World is large (${graph.stats.totalLocations} locations total) - may be hard to traverse`,
      suggestion: 'Consider limiting to 8-10 locations for focused gameplay',
    });
  }

  // Check for locations with no content
  const emptyLocations = Array.from(graph.locations.values()).filter(n => !n.hasContent);
  if (emptyLocations.length > 0) {
    for (const node of emptyLocations.slice(0, 3)) {
      // Report only first 3
      issues.push({
        type: 'no_content',
        locationId: node.id,
        locationName: node.name,
        severity: 'info',
        description: `Location "${node.name}" has no features or NPCs`,
        suggestion: 'Add interesting features or NPCs to make this location memorable',
      });
    }
  }

  const isValid =
    issues.filter(i => i.severity === 'error').length === 0 &&
    graph.stats.unreachableCount === 0;

  const summary = isValid
    ? `✅ World is valid: ${graph.stats.totalLocations} locations, all reachable`
    : `❌ World has ${issues.filter(i => i.severity === 'error').length} critical issues`;

  return {
    isValid,
    graph,
    issues,
    summary,
  };
}

/**
 * Get recommended starting locations (hubs with multiple exits)
 */
export function findHubLocations(graph: WorldGraph): string[] {
  return Array.from(graph.locations.values())
    .filter(n => n.neighbors.length >= 3)
    .sort((a, b) => b.neighbors.length - a.neighbors.length)
    .map(n => n.id);
}

/**
 * Get all dead-end locations (good for quests/treasures)
 */
export function getDeadEnds(graph: WorldGraph): string[] {
  return Array.from(graph.locations.values())
    .filter(n => n.isDeadEnd)
    .map(n => n.id);
}
