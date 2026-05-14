const fs = require('fs');
const path = require('path');

const constantsContent = `import { ResourceType, TileType } from '../types/game';

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
};

export const TILE_COLORS: Record<TileType, { base: string; alt: string; border: string }> = {
  grass: { base: '#426938', alt: '#3c6133', border: '#2f4f26' },
  dirt: { base: '#70543E', alt: '#684d38', border: '#5c4331' },
  water: { base: '#3B82A8', alt: '#367a9e', border: '#2A6382' },
  limestone: { base: '#7f7f7f', alt: '#757575', border: '#606060' },
  snow: { base: '#e2e8f0', alt: '#dbe6f0', border: '#cbd5e1' },
};
`;

const constantsFile = path.join(__dirname, 'src', 'utils', 'constants.ts');
fs.writeFileSync(constantsFile, constantsContent);

const appFile = path.join(__dirname, 'src', 'App.tsx');
let content = fs.readFileSync(appFile, 'utf8');

// Remove from App.tsx
const startMarker = 'const PLAYER_WALK_FREQ = 1.2;';
const endMarker = '};'; // End of TILE_COLORS
const startIndex = content.indexOf(startMarker);

let endIndex = content.indexOf('const TILE_COLORS');
endIndex = content.indexOf('};', endIndex) + 2;

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + content.substring(endIndex);
  
  // Add import
  const importStatement = `import { PLAYER_WALK_FREQ, RESOURCE_COLORS, RESOURCE_NAMES, TILE_COLORS } from './utils/constants';\n`;
  content = importStatement + content;
  
  fs.writeFileSync(appFile, content);
  console.log('Constants extracted successfully');
} else {
  console.log('Failed to extract constants');
}
