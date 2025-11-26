import { 
  BaseCharacter, 
  Recipe, 
  Item, 
  Ingredient,
  CraftingStation
} from '@llmrpg/protocol';
import { v4 as uuidv4 } from 'uuid';
import { ActionResolver } from '../fate/ActionResolver';
import { FateDice } from '../fate/FateDice';

export class CraftingManager {
  constructor(
    private actionResolver: ActionResolver,
    private fateDice: FateDice
  ) {}

  /**
   * Check if a character has the required ingredients for a recipe.
   */
  hasIngredients(character: BaseCharacter, recipe: Recipe): { has: boolean, missing: string[] } {
    const missing: string[] = [];
    
    for (const ingredient of recipe.ingredients) {
      let foundQuantity = 0;
      
      // Filter inventory for matching items
      const matchingItems = character.inventory.filter(item => {
        if (ingredient.itemId && item.id === ingredient.itemId) return true;
        if (ingredient.itemName && item.name === ingredient.itemName) return true;
        if (ingredient.tag && item.tags.includes(ingredient.tag)) return true;
        return false;
      });

      // Sum quantities
      foundQuantity = matchingItems.reduce((sum, item) => sum + item.quantity, 0);

      if (foundQuantity < ingredient.quantity) {
        const name = ingredient.itemName || ingredient.tag || ingredient.itemId || "Unknown Ingredient";
        missing.push(`${name} (${foundQuantity}/${ingredient.quantity})`);
      }
    }

    return { has: missing.length === 0, missing };
  }

  /**
   * Check if a character meets the skill and tool requirements.
   */
  canCraft(character: BaseCharacter, recipe: Recipe, station?: CraftingStation): { can: boolean, reason?: string } {
    // Check Station
    if (recipe.stationType) {
      if (!station || station.type !== recipe.stationType) {
        return { can: false, reason: `Requires ${recipe.stationType} station.` };
      }
    }

    // Check Skills
    for (const [skillName, minRank] of Object.entries(recipe.skillRequirements)) {
      const charSkill = character.skills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
      const rank = charSkill ? charSkill.rank : 0;
      if (rank < minRank) {
        return { can: false, reason: `Insufficient skill: ${skillName} (Need ${minRank}, have ${rank})` };
      }
    }

    // Check Tools
    for (const toolTag of recipe.toolTags) {
      const hasTool = character.inventory.some(i => i.tags.includes(toolTag));
      if (!hasTool) {
        // Check if station provides tool? (Maybe later)
        return { can: false, reason: `Missing tool with tag: ${toolTag}` };
      }
    }

    return { can: true };
  }

  /**
   * Attempt to craft an item.
   * Returns the result items if successful, or null if failed.
   * Consumes ingredients on success (and potentially on failure depending on rules, but let's say only on success for now).
   */
  craft(character: BaseCharacter, recipe: Recipe, station?: CraftingStation): { success: boolean, items: Item[], message: string } {
    // 1. Validate Ingredients
    const ingredientCheck = this.hasIngredients(character, recipe);
    if (!ingredientCheck.has) {
      return { success: false, items: [], message: `Missing ingredients: ${ingredientCheck.missing.join(', ')}` };
    }

    // 2. Validate Requirements
    const reqCheck = this.canCraft(character, recipe, station);
    if (!reqCheck.can) {
      return { success: false, items: [], message: reqCheck.reason || "Cannot craft." };
    }

    // 3. Perform Skill Check (if difficulty > 0)
    // Find the primary skill (highest requirement or first one)
    let skillName = "Crafting"; // Default
    let skillRank = 0;
    
    if (Object.keys(recipe.skillRequirements).length > 0) {
        skillName = Object.keys(recipe.skillRequirements)[0];
        const charSkill = character.skills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
        skillRank = charSkill ? charSkill.rank : 0;
    } else {
        // Try to find a generic "Craft" or "Crafting" skill
        const charSkill = character.skills.find(s => s.name.toLowerCase().includes('craft'));
        skillRank = charSkill ? charSkill.rank : 0;
    }

    const roll = this.fateDice.roll();
    const total = roll.total + skillRank + (station ? station.quality : 0);
    const shifts = total - recipe.difficulty;

    if (shifts < 0) {
        return { success: false, items: [], message: `Crafting failed. Rolled ${total} vs Difficulty ${recipe.difficulty}.` };
    }

    // 4. Consume Ingredients
    this.consumeIngredients(character, recipe);

    // 5. Generate Results
    const createdItems: Item[] = recipe.results.map(resultTemplate => ({
        ...resultTemplate,
        id: uuidv4(), // New unique ID
        quantity: resultTemplate.quantity // Base quantity
        // Could add quality bonuses based on shifts here
    }));

    // Add to inventory
    character.inventory.push(...createdItems);

    return { 
        success: true, 
        items: createdItems, 
        message: `Successfully crafted ${createdItems.map(i => i.name).join(', ')}!` 
    };
  }

  private consumeIngredients(character: BaseCharacter, recipe: Recipe) {
    for (const ingredient of recipe.ingredients) {
        if (!ingredient.consumed) continue;

        let remainingNeeded = ingredient.quantity;

        // Find matching items and decrease quantity
        // We iterate backwards to safely splice if needed, though we are modifying objects in place mostly
        for (let i = character.inventory.length - 1; i >= 0; i--) {
            if (remainingNeeded <= 0) break;

            const item = character.inventory[i];
            let match = false;
            if (ingredient.itemId && item.id === ingredient.itemId) match = true;
            else if (ingredient.itemName && item.name === ingredient.itemName) match = true;
            else if (ingredient.tag && item.tags.includes(ingredient.tag)) match = true;

            if (match) {
                const take = Math.min(item.quantity, remainingNeeded);
                item.quantity -= take;
                remainingNeeded -= take;

                if (item.quantity <= 0) {
                    character.inventory.splice(i, 1);
                }
            }
        }
    }
  }
}
