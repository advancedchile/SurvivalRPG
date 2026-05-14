import { createNoise2D } from 'simplex-noise';
import { Tile, ResourceType, WorldResource, MAP_SIZE } from '../types/game';

const noise2D = createNoise2D();

export const generateTile = (x: number, y: number): Tile => {
  // Calculate distance from center to create a large continent
  const cx = MAP_SIZE / 2;
  const cy = MAP_SIZE / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Normalize distance: 0 at center, fades out near edges
  const maxRadius = MAP_SIZE * 0.45;
  const distFactor = 1.0 - (dist / maxRadius);
  
  // Base continent noise (very large scale)
  const continentNoise = noise2D(x * 0.005, y * 0.005) * 0.6;
  
  // Combine distance factor and continent noise to determine if it's ocean or land
  const baseVal = distFactor + continentNoise;
  
  // Detail noise for local features like small lakes or hills
  const detailNoise = noise2D(x * 0.007, y * 0.007);
  const moisture = noise2D(x * 0.02 + 1000, y * 0.02 + 1000);

  let type: Tile['type'] = 'grass';
  let height = 0;

  // 1. Potential inland water (lakes/rivers) independent of continent
  const waterNoise = noise2D(x * 0.025, y * 0.025);
  
  if (waterNoise < -0.6) {
     type = 'water';
     height = 0;
  } else if (baseVal < -0.4) {
    // Ocean
    type = 'water';
    height = 0;
  } else {
    // Land
    type = 'grass';
    const organicDirtNoise = detailNoise * 0.6 + noise2D(x * 0.08, y * 0.08) * 0.4;
    
    if (organicDirtNoise < -0.25) {
      type = 'limestone';
      height = 5;
    } else if (organicDirtNoise < -0.1) {
      type = 'dirt';
      height = 2; // subtle elevation
    } else {
      if (detailNoise > 0.6) height = 8;
      else if (detailNoise > 0.3) height = 4;
    }
  }

  // Override with dirt if dry
  if (type === 'grass' && moisture * 0.7 + noise2D(x * 0.1, y * 0.1) * 0.3 > 0.3) {
    type = 'dirt';
  }

  // Override with snow if cold
  // Biome determination based on distance and large-scale temperature noise
  const distFromCenter = dist / (MAP_SIZE / 2); // 0 at center, increased near edges
  const temperature = (1.0 - distFromCenter) + noise2D(x * 0.002, y * 0.002) * 0.5;
  
  // Snowy patches can appear if it's already moderately cold
  const snowPatchNoise = noise2D(x * 0.03, y * 0.03);
  
  if (type !== 'water' && (temperature < 0.2 || (snowPatchNoise > 0.6 && temperature < 0.4))) {
     type = 'snow';
     height = 1;
  }

  return { type, height, explored: false, variation: Math.random() }; 
};

export const generateResourcesForChunk = (cx: number, cy: number): WorldResource[] => {
  const resources: WorldResource[] = [];
  const startX = cx * 10;
  const startY = cy * 10;
  
  // Predictable procedural seed per chunk
  const seed = (cx * 73856093) ^ (cy * 19349663);
  let random = Math.abs(seed);
  const nextRandom = () => { random = (random * 1664525 + 1013904223) >>> 0; return random / 4294967296; };

  // Forest noise layer to cluster trees
  const forestNoise = noise2D(cx * 0.08 + 5000, cy * 0.08 + 5000); 

  // Check if it's a snow chunk to boost tree generation
  const isSnowChunk = generateTile(startX + 5, startY + 5).type === 'snow';

  let expectedTrees = 0;
  if (forestNoise > 0.3 || isSnowChunk) {
      // Dense forest
      expectedTrees = 6 + Math.floor(nextRandom() * 5);
  } else if (forestNoise > 0.0 || isSnowChunk) {
      // Moderate forest / edges
      expectedTrees = 3 + Math.floor(nextRandom() * 3);
  } else if (nextRandom() > 0.85 || isSnowChunk) {
      // Sparse solitary trees
      expectedTrees = 2;
  }

  for (let i = 0; i < expectedTrees; i++) {
     const x = startX + nextRandom() * 10;
     const y = startY + nextRandom() * 10;
     const tile = generateTile(Math.floor(x), Math.floor(y));
     if (tile.type === 'snow') {
        resources.push({
           id: `chunk-tree-${cx}-${cy}-${i}`,
           type: 'wood',
           pos: { x, y },
           amount: 10 + Math.floor(nextRandom() * 10),
           maxAmount: 20,
           scale: 0.8 + nextRandom() * 0.4,
           variation: nextRandom(),
           treeType: 'snowy'
        });
     } else if (!isSnowChunk && tile.type !== 'water' && tile.type !== 'limestone') {
        resources.push({
           id: `chunk-tree-${cx}-${cy}-${i}`,
           type: 'wood',
           pos: { x, y },
           amount: 10 + Math.floor(nextRandom() * 10),
           maxAmount: 20,
           scale: 0.8 + nextRandom() * 0.4,
           variation: nextRandom(),
           treeType: 'normal'
        });
     }
  }

  // Stick generation (rarely)
  if (nextRandom() > 0.5) {
     const x = startX + nextRandom() * 10;
     const y = startY + nextRandom() * 10;
     const tile = generateTile(Math.floor(x), Math.floor(y));
     if (tile.type !== 'water' && tile.type !== 'limestone') {
        resources.push({
           id: `chunk-stick-${cx}-${cy}-${Math.floor(nextRandom() * 1000000)}-s`,
           type: 'wood',
           pos: { x, y },
           amount: 1,
           maxAmount: 1,
           variation: Math.floor(nextRandom() * 6),
           isStick: true
        });
     }
  }

  // Minecraft-style small veins per chunk
  // Hierarchy: Stone (on limestone) > Coal > Copper > Aluminum > Iron > Silver > Gold > Diamond
  const minerals: { type: ResourceType, probability: number, minSize: number, maxSize: number, minAmount: number, maxAmount: number }[] = [
      { type: 'stone',  probability: 0.28, minSize: 3, maxSize: 8, minAmount: 500, maxAmount: 1250 },
      { type: 'coal',   probability: 0.22, minSize: 3, maxSize: 8, minAmount: 500, maxAmount: 1250 },
      { type: 'copper', probability: 0.16, minSize: 2, maxSize: 6, minAmount: 300, maxAmount: 750 },
      { type: 'aluminum', probability: 0.14, minSize: 2, maxSize: 5, minAmount: 300, maxAmount: 700 },
      { type: 'iron',   probability: 0.12, minSize: 2, maxSize: 6, minAmount: 400, maxAmount: 900 },
      { type: 'silver', probability: 0.09, minSize: 2, maxSize: 4, minAmount: 200, maxAmount: 500 },
      { type: 'gold',   probability: 0.06, minSize: 2, maxSize: 4, minAmount: 150, maxAmount: 400 },
      { type: 'diamond',probability: 0.02, minSize: 1, maxSize: 3, minAmount: 50, maxAmount: 150 },
  ];

  // Use a lower frequency noise to create larger "mineral rich" areas
  const mineralEligibility = noise2D(startX * 0.03, startY * 0.03);
  
  for (const mineral of minerals) {
      // Stone is always eligible if the probability check passes (restriction to limestone happens later)
      const isEligible = mineral.type === 'stone' || mineralEligibility > 0.35;
      
      if (isEligible && nextRandom() < mineral.probability) {
          // Pick a random start position in this chunk
          let vx = startX + Math.floor(nextRandom() * 10);
          let vy = startY + Math.floor(nextRandom() * 10);
          
          const veinSize = mineral.minSize + Math.floor(nextRandom() * (mineral.maxSize - mineral.minSize + 1));
          const visitedPos = new Set<string>();

          for (let i = 0; i < veinSize; i++) {
              const tile = generateTile(vx, vy);
              
              // Stone ONLY on limestone. Others ONLY on non-water, non-limestone land.
              const isAllowed = mineral.type === 'stone' 
                  ? (tile.type === 'limestone') 
                  : (tile.type !== 'water' && tile.type !== 'limestone');

              if (isAllowed && !visitedPos.has(`${vx},${vy}`)) {
                  visitedPos.add(`${vx},${vy}`);
                  const amount = mineral.minAmount + Math.floor(nextRandom() * (mineral.maxAmount - mineral.minAmount + 1)); 
                  
                  resources.push({
                     id: `chunk-${mineral.type}-${cx}-${cy}-${vx}-${vy}`,
                     type: mineral.type,
                     pos: { x: vx + 0.5, y: vy + 0.5 }, // center of the tile
                     amount: amount,
                     maxAmount: amount,
                     scale: 0.8 + nextRandom() * 0.4,
                     variation: nextRandom()
                  });
              }

              // Random walk to an adjacent tile
              const dirs = [[0,1], [1,0], [0,-1], [-1,0], [1,1], [-1,-1], [1,-1], [-1,1]];
              const dir = dirs[Math.floor(nextRandom() * dirs.length)];
              vx += dir[0];
              vy += dir[1];
        }
    }
  }

  return resources;
};
