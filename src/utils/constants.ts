import { ResourceType, TileType, ToolType } from '../types/game';

export const PLAYER_WALK_FREQ = 1.2;

export const RESOURCE_COLORS: Record<ResourceType, string> = {
  wood: '#15803d',
  stone: '#71717a',
  iron: '#94a3b8',
  copper: '#d97706',
  coal: '#18181b',
  gold: '#fbbf24',
  diamond: '#38bdf8',
  fiber: '#84cc16',
  meat: '#ef4444',
  aluminum: '#e2e8f0',
  silver: '#cbd5e1',
};

export const RESOURCE_NAMES: Record<ResourceType, string> = {
  wood: 'Madera (Wood)',
  stone: 'Piedra (Stone)',
  iron: 'Hierro (Iron)',
  copper: 'Cobre (Copper)',
  coal: 'Carbón (Coal)',
  gold: 'Oro (Gold)',
  diamond: 'Diamante (Diamond)',
  fiber: 'Fibra (Fiber)',
  meat: 'Carne (Meat)',
  aluminum: 'Aluminio (Aluminum)',
  silver: 'Plata (Silver)',
};

export const TOOL_NAMES: Record<ToolType, string> = {
  axe_wood: 'Hacha de Madera (Wood Axe)',
  pickaxe_wood: 'Pico de Madera (Wood Pickaxe)',
  spear_wood: 'Lanza de Madera (Wood Spear)',
  knife_wood: 'Cuchillo de Madera (Wood Knife)',
  super_axe: 'Súper Hacha (Super Axe)',
  super_pickaxe: 'Súper Pico (Super Pickaxe)',
};

export const TILE_COLORS: Record<TileType, { base: string; alt: string; border: string }> = {
  grass: { base: '#426938', alt: '#3c6133', border: '#2f4f26' },
  dirt: { base: '#70543E', alt: '#684d38', border: '#5c4331' },
  water: { base: '#3B82A8', alt: '#367a9e', border: '#2A6382' },
  limestone: { base: '#7f7f7f', alt: '#757575', border: '#606060' },
  snow: { base: '#e2e8f0', alt: '#dbe6f0', border: '#cbd5e1' },
};
