import { 
  Item, 
  Shop, 
  Transaction, 
  Character,
  BaseCharacter
} from '@llmrpg/protocol';
import { v4 as uuidv4 } from 'uuid';

export interface FactionPriceModifier {
  factionReputation: number; // -100 to +100
}

export class EconomyManager {
  
  /**
   * Calculate price modifier based on faction reputation
   * Reputation ranges from -100 (hostile) to +100 (ally)
   * Price modifier: -100 = 1.5x, 0 = 1.0x, +100 = 0.7x
   */
  calculateFactionPriceModifier(factionReputation: number): number {
    let modifier: number;
    if (factionReputation < 0) {
      // From 1.0 at 0 to 1.5 at -100
      modifier = 1.0 - (factionReputation / 200);
    } else {
      // From 1.0 at 0 to 0.7 at 100
      modifier = 1.0 - (factionReputation * 0.003);
    }
    return Math.max(0.7, Math.min(1.5, modifier));
  }

  /**
   * Calculate final price with optional faction modifier
   */
  calculatePrice(baseValue: number, shopMarkup: number, factionReputation?: number): number {
    let price = Math.ceil(baseValue * shopMarkup);
    if (factionReputation !== undefined) {
      const modifier = this.calculateFactionPriceModifier(factionReputation);
      price = Math.ceil(price * modifier);
    }
    return price;
  }
  
  /**
   * Add wealth to a character
   */
  addWealth(character: BaseCharacter, amount: number): void {
    if (amount < 0) throw new Error("Cannot add negative wealth");
    character.wealth += amount;
  }

  /**
   * Remove wealth from a character
   */
  removeWealth(character: BaseCharacter, amount: number): boolean {
    if (amount < 0) throw new Error("Cannot remove negative wealth");
    if (character.wealth < amount) return false;
    character.wealth -= amount;
    return true;
  }

  /**
   * Transfer wealth between characters
   */
  transferWealth(from: BaseCharacter, to: BaseCharacter, amount: number): boolean {
    if (this.removeWealth(from, amount)) {
      this.addWealth(to, amount);
      return true;
    }
    return false;
  }

  /**
   * Add an item to a character's inventory
   */
  addItem(character: BaseCharacter, item: Item): void {
    // Check if item stacks
    const existingItem = character.inventory.find(i => i.name === item.name && i.id !== item.id); // Simple name check for stacking logic if IDs differ? 
    // Actually, usually items with same ID stack if they are stackable. 
    // But here we might have unique instances.
    // Let's just push for now, or handle stacking if we add a 'stackable' flag later.
    // The ItemSchema has 'quantity'.
    
    // If we are adding an item that is "the same" (e.g. "Health Potion"), we should stack it.
    // But how do we know it's the same? Name?
    // Let's assume for now we just add it.
    character.inventory.push(item);
  }

  /**
   * Remove an item from a character's inventory
   */
  removeItem(character: BaseCharacter, itemId: string, quantity: number = 1): boolean {
    const index = character.inventory.findIndex(i => i.id === itemId);
    if (index === -1) return false;

    const item = character.inventory[index];
    if (item.quantity < quantity) return false;

    item.quantity -= quantity;
    if (item.quantity <= 0) {
      character.inventory.splice(index, 1);
    }
    return true;
  }

  /**
   * Execute a purchase transaction from a shop
   * @param buyer The character buying the item
   * @param shop The shop to buy from
   * @param itemId The item ID to purchase
   * @param quantity Number of items to buy (default: 1)
   * @param factionReputation Optional faction reputation for price modification (-100 to +100)
   */
  buyFromShop(
    buyer: BaseCharacter, 
    shop: Shop, 
    itemId: string, 
    quantity: number = 1,
    factionReputation?: number
  ): Transaction | null {
    const shopItem = shop.inventory.find(i => i.id === itemId);
    if (!shopItem) return null;
    if (shopItem.quantity < quantity) return null;

    const unitPrice = this.calculatePrice(shopItem.value, shop.markup, factionReputation);
    const totalCost = unitPrice * quantity;

    if (buyer.wealth < totalCost) return null;

    // Execute transaction
    buyer.wealth -= totalCost;
    
    // Create a copy of the item for the buyer
    const buyerItem: Item = {
      ...shopItem,
      id: uuidv4(), // New ID for the instance
      quantity: quantity
    };
    
    // Add to buyer
    this.addItem(buyer, buyerItem);

    // Remove from shop (decrement quantity)
    shopItem.quantity -= quantity;
    if (shopItem.quantity <= 0) {
      shop.inventory = shop.inventory.filter(i => i.id !== itemId);
    }

    // Record transaction
    const transaction: Transaction = {
      id: uuidv4(),
      buyerId: buyer.id,
      sellerId: shop.id,
      items: [{ itemId: shopItem.id, quantity, pricePerUnit: unitPrice }],
      totalCost,
      currencyType: shop.currencyType,
      timestamp: Date.now(), // Should ideally be turn number
      locationId: shop.locationId
    };

    return transaction;
  }

  /**
   * Sell an item to a shop
   * @param seller The character selling the item
   * @param shop The shop to sell to
   * @param itemId The item ID to sell
   * @param quantity Number of items to sell (default: 1)
   * @param factionReputation Optional faction reputation for price modification (-100 to +100)
   *        Note: For selling, better reputation means HIGHER sell price (inverted from buying)
   */
  sellToShop(
    seller: BaseCharacter, 
    shop: Shop, 
    itemId: string, 
    quantity: number = 1,
    factionReputation?: number
  ): Transaction | null {
    const itemIndex = seller.inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return null;
    
    const item = seller.inventory[itemIndex];
    if (item.quantity < quantity) return null;

    // Calculate sell price with faction modifier (inverted for selling - better rep = better price)
    let unitPrice = Math.floor(item.value * shop.markdown);
    if (factionReputation !== undefined) {
      // Invert the modifier: allies get better sell prices
      const buyModifier = this.calculateFactionPriceModifier(factionReputation);
      // Inverse: if buy modifier is 0.7 (ally), sell modifier is ~1.3
      const sellModifier = 2.0 - buyModifier;
      unitPrice = Math.floor(unitPrice * sellModifier);
    }
    const totalValue = unitPrice * quantity;

    // Execute transaction
    seller.wealth += totalValue;

    // Remove from seller
    item.quantity -= quantity;
    if (item.quantity <= 0) {
      seller.inventory.splice(itemIndex, 1);
    }

    // Add to shop
    // Check if shop already has this item to stack
    const shopItem = shop.inventory.find(i => i.name === item.name); // Simple matching by name for now
    if (shopItem) {
      shopItem.quantity += quantity;
    } else {
      shop.inventory.push({
        ...item,
        id: uuidv4(),
        quantity: quantity
      });
    }

    const transaction: Transaction = {
      id: uuidv4(),
      buyerId: shop.id,
      sellerId: seller.id,
      items: [{ itemId: item.id, quantity, pricePerUnit: unitPrice }],
      totalCost: totalValue,
      currencyType: shop.currencyType,
      timestamp: Date.now(),
      locationId: shop.locationId
    };

    return transaction;
  }
}
