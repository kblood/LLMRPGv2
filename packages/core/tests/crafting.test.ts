import { describe, it, expect, beforeEach } from 'vitest';
import { CraftingManager } from '../src/engine/CraftingManager';
import { ActionResolver } from '../src/fate/ActionResolver';
import { FateDice } from '../src/fate/FateDice';
import { BaseCharacter, Recipe, Item } from '@llmrpg/protocol';

describe('CraftingManager', () => {
  let craftingManager: CraftingManager;
  let character: BaseCharacter;
  let recipe: Recipe;

  beforeEach(() => {
    const actionResolver = new ActionResolver();
    const fateDice = new FateDice(12345); // Seeded
    craftingManager = new CraftingManager(actionResolver, fateDice);

    character = {
      id: 'char-1',
      name: 'Crafter',
      inventory: [
        {
          id: 'ing-1',
          name: 'Iron Bar',
          quantity: 5,
          tags: ['metal'],
          value: 10,
          weight: 1,
          rarity: 'common',
          type: 'misc',
          description: 'A bar of iron'
        },
        {
          id: 'ing-2',
          name: 'Wood Plank',
          quantity: 2,
          tags: ['wood'],
          value: 2,
          weight: 1,
          rarity: 'common',
          type: 'misc',
          description: 'A plank of wood'
        },
        {
          id: 'tool-1',
          name: 'Hammer',
          quantity: 1,
          tags: ['hammer'],
          value: 20,
          weight: 2,
          rarity: 'common',
          type: 'tool',
          description: 'A crafting hammer'
        }
      ],
      skills: [
        { name: 'Crafting', rank: 3 }
      ],
      // ... minimal other fields
      aspects: [],
      stunts: [],
      stressTracks: [],
      consequences: [],
      fatePoints: { current: 3, refresh: 3 },
      personality: { traits: [], values: [], quirks: [], fears: [], desires: [] },
      backstory: { origin: '', formativeEvent: '', summary: '' },
      voice: { speechPattern: '', vocabulary: 'moderate', phrases: [], quirks: [] },
      knowledge: { locations: {}, npcs: {}, quests: {}, factions: {}, secrets: {}, items: {}, topics: {} },
      relationships: [],
      appearance: '',
      currentLocation: 'loc-1',
      isAlive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as BaseCharacter;

    recipe = {
      id: 'rec-1',
      name: 'Iron Sword',
      description: 'A simple iron sword',
      ingredients: [
        { itemName: 'Iron Bar', quantity: 2, consumed: true },
        { tag: 'wood', quantity: 1, consumed: true }
      ],
      results: [
        {
          id: 'res-1', // Template ID
          name: 'Iron Sword',
          description: 'Sharp and heavy',
          value: 50,
          weight: 3,
          tags: ['weapon', 'sword'],
          quantity: 1,
          rarity: 'common',
          type: 'weapon'
        }
      ],
      skillRequirements: { 'Crafting': 1 },
      toolTags: ['hammer'],
      difficulty: 2
    };
  });

  it('should validate ingredients correctly', () => {
    const result = craftingManager.hasIngredients(character, recipe);
    expect(result.has).toBe(true);
  });

  it('should fail validation if ingredients missing', () => {
    character.inventory[0].quantity = 1; // Only 1 Iron Bar (need 2)
    const result = craftingManager.hasIngredients(character, recipe);
    expect(result.has).toBe(false);
    expect(result.missing[0]).toContain('Iron Bar');
  });

  it('should validate requirements correctly', () => {
    const result = craftingManager.canCraft(character, recipe);
    expect(result.can).toBe(true);
  });

  it('should fail requirements if skill too low', () => {
    character.skills[0].rank = 0; // Need 1
    const result = craftingManager.canCraft(character, recipe);
    expect(result.can).toBe(false);
    expect(result.reason).toContain('Insufficient skill');
  });

  it('should fail requirements if tool missing', () => {
    character.inventory = character.inventory.filter(i => i.name !== 'Hammer');
    const result = craftingManager.canCraft(character, recipe);
    expect(result.can).toBe(false);
    expect(result.reason).toContain('Missing tool');
  });

  it('should craft item successfully', () => {
    // Mock dice to ensure success (roll of 0)
    // Since we can't easily mock the internal dice of the manager instance without dependency injection or mocking the module,
    // we rely on the fact that Skill 3 + Roll (-4 to +4) vs Diff 2 is likely to succeed, but not guaranteed.
    // However, we passed FateDice instance in constructor.
    // Let's just run it. With Skill 3 vs Diff 2, we need a roll of -1 or better. (Probability > 80%)
    // To be safe for a unit test, we should probably mock FateDice.roll, but for now let's just check the logic flow
    // assuming it *can* succeed.
    
    // Actually, let's boost skill to 10 to guarantee success for the test
    character.skills[0].rank = 10;

    const result = craftingManager.craft(character, recipe);
    
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Iron Sword');
    
    // Check consumption
    const iron = character.inventory.find(i => i.name === 'Iron Bar');
    const wood = character.inventory.find(i => i.name === 'Wood Plank');
    
    expect(iron?.quantity).toBe(3); // 5 - 2
    expect(wood?.quantity).toBe(1); // 2 - 1
  });
});
