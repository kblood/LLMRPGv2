import { describe, it, expect, beforeEach } from 'vitest';
import { EconomyManager } from '../src/economy/EconomyManager';
import { BaseCharacter, Item, Shop } from '@llmrpg/protocol';
import { v4 as uuidv4 } from 'uuid';

describe('EconomyManager', () => {
  let economyManager: EconomyManager;
  let character: BaseCharacter;
  let shop: Shop;

  beforeEach(() => {
    economyManager = new EconomyManager();
    
    character = {
      id: 'char-1',
      name: 'Test Character',
      wealth: 100,
      inventory: [],
      // ... minimal other required fields
      aspects: [],
      skills: [],
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
    } as unknown as BaseCharacter; // Casting to avoid filling all fields

    shop = {
      id: 'shop-1',
      name: 'Test Shop',
      description: 'A test shop',
      locationId: 'loc-1',
      inventory: [
        {
          id: 'item-1',
          name: 'Health Potion',
          description: 'Heals 2 stress',
          value: 50,
          weight: 0.5,
          tags: ['consumable'],
          quantity: 5,
          rarity: 'common',
          type: 'consumable'
        }
      ],
      currencyType: 'gold',
      markup: 1.0,
      markdown: 0.5,
      isOpen: true
    };
  });

  it('should add wealth to character', () => {
    economyManager.addWealth(character, 50);
    expect(character.wealth).toBe(150);
  });

  it('should remove wealth from character', () => {
    const success = economyManager.removeWealth(character, 50);
    expect(success).toBe(true);
    expect(character.wealth).toBe(50);
  });

  it('should fail to remove wealth if insufficient', () => {
    const success = economyManager.removeWealth(character, 200);
    expect(success).toBe(false);
    expect(character.wealth).toBe(100);
  });

  it('should add item to inventory', () => {
    const item: Item = {
      id: 'item-new',
      name: 'Sword',
      description: 'Sharp',
      value: 100,
      weight: 5,
      tags: [],
      quantity: 1,
      rarity: 'common',
      type: 'weapon'
    };
    economyManager.addItem(character, item);
    expect(character.inventory).toHaveLength(1);
    expect(character.inventory[0].name).toBe('Sword');
  });

  it('should buy item from shop', () => {
    const transaction = economyManager.buyFromShop(character, shop, 'item-1', 1);
    
    expect(transaction).not.toBeNull();
    expect(character.wealth).toBe(50); // 100 - 50
    expect(character.inventory).toHaveLength(1);
    expect(character.inventory[0].name).toBe('Health Potion');
    
    // Shop inventory should decrease
    const shopItem = shop.inventory.find(i => i.id === 'item-1');
    expect(shopItem?.quantity).toBe(4);
  });

  it('should fail buy if insufficient funds', () => {
    character.wealth = 10;
    const transaction = economyManager.buyFromShop(character, shop, 'item-1', 1);
    expect(transaction).toBeNull();
    expect(character.inventory).toHaveLength(0);
  });

  it('should sell item to shop', () => {
    // Give character an item
    const item: Item = {
      id: 'item-sell',
      name: 'Gem',
      description: 'Shiny',
      value: 100,
      weight: 0.1,
      tags: [],
      quantity: 1,
      rarity: 'rare',
      type: 'misc'
    };
    character.inventory.push(item);

    const transaction = economyManager.sellToShop(character, shop, 'item-sell', 1);
    
    expect(transaction).not.toBeNull();
    expect(character.wealth).toBe(150); // 100 + (100 * 0.5)
    expect(character.inventory).toHaveLength(0);
    
    // Shop should have the item
    const shopItem = shop.inventory.find(i => i.name === 'Gem');
    expect(shopItem).toBeDefined();
    expect(shopItem?.quantity).toBe(1);
  });
});
