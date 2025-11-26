import { z } from 'zod';

// Currency definition
export const CurrencySchema = z.object({
  amount: z.number().int().min(0),
  type: z.string().default('gold'), // Can be 'credits', 'gold', 'resources', etc.
});

export type Currency = z.infer<typeof CurrencySchema>;

// Item definition
export const ItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  value: z.number().int().min(0).default(0),
  weight: z.number().min(0).default(0),
  tags: z.array(z.string()).default([]),
  aspectId: z.string().uuid().optional(), // If item grants an aspect
  quantity: z.number().int().min(1).default(1),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).default('common'),
  type: z.enum(['weapon', 'armor', 'consumable', 'tool', 'quest', 'misc']).default('misc'),
});

export type Item = z.infer<typeof ItemSchema>;

// Shop definition
export const ShopSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  locationId: z.string(),
  inventory: z.array(ItemSchema).default([]),
  currencyType: z.string().default('gold'),
  markup: z.number().min(0).default(1.0), // Multiplier for buying from shop
  markdown: z.number().min(0).default(0.5), // Multiplier for selling to shop
  ownerId: z.string().optional(), // NPC owner
  isOpen: z.boolean().default(true),
});

export type Shop = z.infer<typeof ShopSchema>;

// Transaction record
export const TransactionSchema = z.object({
  id: z.string().uuid(),
  buyerId: z.string(),
  sellerId: z.string(), // Can be a shop ID or character ID
  items: z.array(z.object({
    itemId: z.string(),
    quantity: z.number().int().min(1),
    pricePerUnit: z.number().int().min(0),
  })),
  totalCost: z.number().int().min(0),
  currencyType: z.string(),
  timestamp: z.number().int(), // Turn number or timestamp
  locationId: z.string().optional(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
