import { describe, it, expect, beforeEach } from 'vitest';
import { LocationRegistry } from '../src/state/LocationRegistry';
import { Location } from '@llmrpg/protocol';

describe('LocationRegistry', () => {
  let registry: LocationRegistry;

  beforeEach(() => {
    registry = new LocationRegistry();
  });

  describe('Basic Location Management', () => {
    it('should register a location', () => {
      const location: Location = {
        id: 'loc-test-001',
        name: 'Dark Forest',
        description: 'A spooky forest',
        tier: 'locale',
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: true
      };

      registry.registerLocation(location);
      const retrieved = registry.getLocationById('loc-test-001');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Dark Forest');
    });

    it('should retrieve location by ID', () => {
      const location: Location = {
        id: 'loc-village-001',
        name: 'Village Square',
        description: 'A bustling town square',
        tier: 'locale',
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: true
      };

      registry.registerLocation(location);
      const retrieved = registry.getLocationById('loc-village-001');

      expect(retrieved).toEqual(location);
    });

    it('should find locations by name (case-insensitive)', () => {
      const location1: Location = {
        id: 'loc-forest-001',
        name: 'Dark Forest',
        description: 'A spooky forest',
        tier: 'locale',
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: true
      };

      const location2: Location = {
        id: 'loc-forest-002',
        name: 'Dark Forest',
        description: 'Another dark forest',
        tier: 'locale',
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: false
      };

      registry.registerLocation(location1);
      registry.registerLocation(location2);

      const found = registry.getLocationsByName('DARK FOREST');
      expect(found).toHaveLength(2);
      expect(found.map(l => l.id)).toContain('loc-forest-001');
      expect(found.map(l => l.id)).toContain('loc-forest-002');
    });

    it('should return all registered locations', () => {
      const locs = [
        {
          id: 'loc-1',
          name: 'Location 1',
          description: 'First location',
          tier: 'locale' as const,
          aspects: [],
          connections: [],
          presentNPCs: [],
          features: [],
          discovered: true
        },
        {
          id: 'loc-2',
          name: 'Location 2',
          description: 'Second location',
          tier: 'locale' as const,
          aspects: [],
          connections: [],
          presentNPCs: [],
          features: [],
          discovered: true
        }
      ];

      registry.registerLocations(locs);
      const all = registry.getAllLocations();

      expect(all).toHaveLength(2);
      expect(all.map(l => l.id)).toContain('loc-1');
      expect(all.map(l => l.id)).toContain('loc-2');
    });
  });

  describe('Connection Management', () => {
    it('should add bidirectional connections', () => {
      const loc1: Location = {
        id: 'loc-a',
        name: 'Location A',
        description: 'A',
        tier: 'locale',
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: true
      };

      const loc2: Location = {
        id: 'loc-b',
        name: 'Location B',
        description: 'B',
        tier: 'locale',
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: true
      };

      registry.registerLocation(loc1);
      registry.registerLocation(loc2);
      registry.addConnection('loc-a', 'loc-b', 'north', 'south', 'A path');

      // Check A → B connection
      expect(registry.getTarget('loc-a', 'north')).toBe('loc-b');

      // Check B → A reverse connection
      expect(registry.getTarget('loc-b', 'south')).toBe('loc-a');
    });

    it('should detect existing connections', () => {
      const loc1: Location = {
        id: 'loc-x',
        name: 'Location X',
        description: 'X',
        tier: 'locale',
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: true
      };

      const loc2: Location = {
        id: 'loc-y',
        name: 'Location Y',
        description: 'Y',
        tier: 'locale',
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: true
      };

      registry.registerLocation(loc1);
      registry.registerLocation(loc2);
      registry.addConnection('loc-x', 'loc-y', 'east', 'west');

      expect(registry.hasConnection('loc-x', 'loc-y', 'east')).toBe(true);
      expect(registry.hasConnection('loc-x', 'loc-y')).toBe(true);
      expect(registry.hasConnection('loc-x', 'loc-y', 'north')).toBe(false);
    });

    it('should get nearby locations', () => {
      const locs = [
        {
          id: 'loc-center',
          name: 'Center',
          description: 'Center',
          tier: 'locale' as const,
          aspects: [],
          connections: [],
          presentNPCs: [],
          features: [],
          discovered: true
        },
        {
          id: 'loc-north',
          name: 'North',
          description: 'North',
          tier: 'locale' as const,
          aspects: [],
          connections: [],
          presentNPCs: [],
          features: [],
          discovered: true
        },
        {
          id: 'loc-south',
          name: 'South',
          description: 'South',
          tier: 'locale' as const,
          aspects: [],
          connections: [],
          presentNPCs: [],
          features: [],
          discovered: true
        }
      ];

      registry.registerLocations(locs);
      registry.addConnection('loc-center', 'loc-north', 'north', 'south');
      registry.addConnection('loc-center', 'loc-south', 'south', 'north');

      const nearby = registry.getNearbyLocations('loc-center');
      expect(nearby).toHaveLength(2);
      expect(nearby.map(l => l.id)).toContain('loc-north');
      expect(nearby.map(l => l.id)).toContain('loc-south');
    });

    it('should find locations within distance', () => {
      const locs = [
        {
          id: 'loc-0',
          name: 'Center',
          description: 'Center',
          tier: 'locale' as const,
          aspects: [],
          connections: [],
          presentNPCs: [],
          features: [],
          discovered: true
        },
        {
          id: 'loc-1',
          name: 'Distance 1',
          description: 'D1',
          tier: 'locale' as const,
          aspects: [],
          connections: [],
          presentNPCs: [],
          features: [],
          discovered: true
        },
        {
          id: 'loc-2',
          name: 'Distance 2',
          description: 'D2',
          tier: 'locale' as const,
          aspects: [],
          connections: [],
          presentNPCs: [],
          features: [],
          discovered: true
        },
        {
          id: 'loc-3',
          name: 'Distance 3',
          description: 'D3',
          tier: 'locale' as const,
          aspects: [],
          connections: [],
          presentNPCs: [],
          features: [],
          discovered: true
        }
      ];

      registry.registerLocations(locs);
      registry.addConnection('loc-0', 'loc-1', 'north', 'south');
      registry.addConnection('loc-1', 'loc-2', 'north', 'south');
      registry.addConnection('loc-2', 'loc-3', 'north', 'south');

      const within2 = registry.getLocationsWithin('loc-0', 2);
      expect(within2.size).toBe(2);
      expect(within2.has('loc-1')).toBe(true);
      expect(within2.has('loc-2')).toBe(true);
      expect(within2.has('loc-3')).toBe(false);
    });
  });

  describe('ID Generation', () => {
    it('should generate stable location IDs', () => {
      const id1 = registry.generateStableLocationId('forest', 1);
      const id2 = registry.generateStableLocationId('forest', 2);
      const id3 = registry.generateStableLocationId('desert', 1);

      expect(id1).toBe('loc-forest-0001');
      expect(id2).toBe('loc-forest-0002');
      expect(id3).toBe('loc-desert-0001');
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent location lookup', () => {
      const result = registry.getLocationById('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return empty array for non-existent location names', () => {
      const result = registry.getLocationsByName('Phantom Location');
      expect(result).toEqual([]);
    });

    it('should throw when connecting non-registered locations', () => {
      const loc: Location = {
        id: 'loc-exists',
        name: 'Exists',
        description: 'Exists',
        tier: 'locale',
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: true
      };

      registry.registerLocation(loc);

      expect(() => {
        registry.addConnection('loc-exists', 'loc-does-not-exist', 'north', 'south');
      }).toThrow();
    });

    it('should handle clear operation', () => {
      const loc: Location = {
        id: 'loc-clear-test',
        name: 'Clear Test',
        description: 'Test',
        tier: 'locale',
        aspects: [],
        connections: [],
        presentNPCs: [],
        features: [],
        discovered: true
      };

      registry.registerLocation(loc);
      registry.clear();

      expect(registry.getAllLocations()).toHaveLength(0);
      expect(registry.getLocationById('loc-clear-test')).toBeUndefined();
    });
  });
});
