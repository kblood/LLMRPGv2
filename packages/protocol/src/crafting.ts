import { z } from 'zod';
import { ItemSchema } from './economy.js';

export const IngredientSchema = z.object({
  itemId: z.string().optional(), // Specific item ID (for unique items)
  itemName: z.string().optional(), // Specific item name (e.g. "Iron Bar")
  tag: z.string().optional(), // Or any item with this tag (e.g., "metal")
  quantity: z.number().int().min(1),
  consumed: z.boolean().default(true),
});

export type Ingredient = z.infer<typeof IngredientSchema>;

export const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  ingredients: z.array(IngredientSchema),
  results: z.array(ItemSchema), // Items created
  
  // Requirements
  skillRequirements: z.record(z.string(), z.number().int()).default({}), // Skill name -> min rank
  toolTags: z.array(z.string()).default([]), // Tags of tools required (e.g., "hammer")
  stationType: z.string().optional(), // e.g., "forge", "alchemy_lab"
  
  difficulty: z.number().int().default(0), // Fate ladder difficulty for the check
  timeRequired: z.string().optional(), // Narrative time
});

export type Recipe = z.infer<typeof RecipeSchema>;

export const CraftingStationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  locationId: z.string(),
  quality: z.number().int().default(0), // Bonus to crafting rolls
});

export type CraftingStation = z.infer<typeof CraftingStationSchema>;
