import { PLAYER_WALK_FREQ, RESOURCE_COLORS, RESOURCE_NAMES, TILE_COLORS } from './utils/constants';
import { useAssets } from './hooks/useAssets';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useKeyboard } from './hooks/useKeyboard';
import { usePlayer } from './hooks/usePlayer';
import { useGameLoop } from './hooks/useGameLoop';
import { usePlayerSprites, PlayerAction, PlayerDirection } from './hooks/usePlayerSprites';
import { useAudio } from './hooks/useAudio';
import { useCampfireAudio } from './hooks/useCampfireAudio';
import { useAmbientAudio } from './hooks/useAmbientAudio';
import { drawWaterAnimations } from './renderers/waterRenderer';
import { drawEnemy } from './renderers/enemyRenderer';
import { Point, Player, TILE_SIZE, MAP_SIZE, WorldResource, DroppedItem, ResourceType, INVENTORY_SIZE, STACK_LIMIT, InventoryItem, TileType, Tile, Particle, ToolType, ToolItem, Animal, AnimalType, Cloud, Enemy, EquipmentSlot } from './types/game';
import { MousePointer2, Package, Trash2, Hammer, Zap, Map as MapIcon, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateTile, generateResourcesForChunk } from './services/mapGenerator';
import { GameMap } from './components/GameMap';
import { Inventory } from './components/ui/Inventory';
import { Hotbar } from './components/ui/Hotbar';
import { CraftingMenu } from './components/ui/CraftingMenu';
import { Notifications } from './components/ui/Notifications';
import { Minimap } from './components/ui/Minimap';
import { StartScreen } from './components/StartScreen';

import { getNewInventory } from './utils/inventoryHelpers';

interface Campfire {
  pos: Point;
  animFrame: number;
  particles: { id: string; x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[];
}

const toIso = (x: number, y: number) => {
  return {
    x: (x - y) * (TILE_SIZE / 2),
    y: (x + y) * (TILE_SIZE / 4),
  };
};

const fromIso = (screenX: number, screenY: number, camera: Point, zoom: number, canvas: HTMLCanvasElement) => {
  const wx = (screenX - canvas.width / 2) / zoom + camera.x;
  const wy = (screenY - canvas.height / 2) / zoom + camera.y;
  const isoX = (2 * wy + wx) / TILE_SIZE;
  const isoY = (2 * wy - wx) / TILE_SIZE;
  return { x: isoX, y: isoY };
};



export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const mapTilesRef = useRef<Record<number, Record<number, Tile>>>({});
  const loadedChunksRef = useRef<Set<string>>(new Set());

  const { 
    customAssets, choppedWoodAssets, snowyTreeAssets, stickAssets, 
    axeImage, pickaxeImage, grassTextures, dirtTextures, 
    woodIcon, stoneIcon, coalIcon, copperIcon, ironIcon, goldIcon, diamondIcon, aluminumIcon, silverIcon 
  } = useAssets();

  const { getSprite } = usePlayerSprites();
  const { playStepSound, playBirdSound, playCricketSound, playChopSound, playPickSound } = useAudio();
  const lastChopSoundTimeRef = useRef(0);
  const lastPickSoundTimeRef = useRef(0);

  const keys = useKeyboard();

  const [loadingPhase, setLoadingPhase] = useState<string | null>('Buscando tierra firme...');
  const [gameStarted, setGameStarted] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const initialSpawnPosRef = useRef<Point>({ x: MAP_SIZE / 2, y: MAP_SIZE / 2 });
  const [resources, setResources] = useState<WorldResource[]>([]);
  const [mapTiles, setMapTiles] = useState<Tile[][]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [campfire, setCampfire] = useState<Campfire | null>(null);
  const [droppedItems, setDroppedItems] = useState<DroppedItem[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [draggingItem, setDraggingItem] = useState<{ source: 'inventory' | 'hotbar'; index: number; type: ResourceType | ToolType; amount: number } | null>(null);
  const [hoveredHotbarIndex, setHoveredHotbarIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [hoveredInvIndex, setHoveredInvIndex] = useState<number | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isHoveringInventoryWindow, setIsHoveringInventoryWindow] = useState(false);
  const [isHoveringHotbarWindow, setIsHoveringHotbarWindow] = useState(false);
  const [isCraftingOpen, setIsCraftingOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<{ id: number; message: string }[]>([]);
  const [hoveredHudResource, setHoveredHudResource] = useState<string | null>(null);
  const notificationIdRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'i') {
        setIsInventoryOpen(prev => !prev);
        setIsCraftingOpen(false);
      } else if (e.key.toLowerCase() === 'c') {
        setIsCraftingOpen(prev => !prev);
        setIsInventoryOpen(false);
      } else if (e.key === 'Escape') {
        if (isInventoryOpen || isCraftingOpen) {
          setIsInventoryOpen(false);
          setIsCraftingOpen(false);
        } else {
          setIsMenuOpen(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInventoryOpen, isCraftingOpen, isMenuOpen]);

  const resourceIcons: Record<string, HTMLImageElement | null> = {
    wood: woodIcon,
    stone: stoneIcon,
    coal: coalIcon,
    copper: copperIcon,
    iron: ironIcon,
    gold: goldIcon,
    diamond: diamondIcon,
    aluminum: aluminumIcon,
    silver: silverIcon
  };

  const queueNotification = useCallback((message: string, delay: number = 0) => {
      setTimeout(() => {
          setNotifications(prev => {
              if (prev.some(n => n.message === message)) return prev;
              const newId = notificationIdRef.current++;                
              // Schedule removal
              setTimeout(() => setNotifications(curr => curr.filter(n => n.id !== newId)), 10000);
              return [...prev, { id: newId, message }];
          });
      }, delay);
  }, []);

  const removeNotification = useCallback((id: number) => {
     setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);
  const [unlockedRecipeNotifications, setUnlockedRecipeNotifications] = useState<Set<string>>(new Set());

  const { player, setPlayer } = usePlayer();

  useCampfireAudio(player.pos, campfire?.pos, gameStarted);
  useAmbientAudio(gameStarted);

  const recipes = [
    { type: 'axe_wood' as ToolType, name: 'Hacha de Madera', wood: 5, description: 'Efectiva para talar árboles' },
    { type: 'pickaxe_wood' as ToolType, name: 'Pico de Madera', wood: 10, description: 'Ideal para minar piedra' },
    { type: 'spear_wood' as ToolType, name: 'Lanza de Madera', wood: 8, description: 'Útil para defensa' },
    { type: 'knife_wood' as ToolType, name: 'Cuchillo de Madera', wood: 3, description: 'Para cortes rápidos' },
  ];

  const [zoom, setZoom] = useState(1.0);
  const [camera, setCamera] = useState<Point>({ x: 0, y: 0 });
  const lastStepTimeRef = useRef<number>(0);
  const lastHarvestTimeRef = useRef<number>(0);
  const environmentRef = useRef({ timeOfDay: 6000, isRaining: false, lastEnvSoundTime: Date.now(), nextEnvSoundDelay: 5000, cloudOffset: 0 });
  
  const [isMapOpen, setIsMapOpen] = useState(false);

  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Initialize Player Spawn
  useEffect(() => {
    if (!gameStarted) return;
    let spawnX = MAP_SIZE / 2;
    let spawnY = MAP_SIZE / 2;
    let r = 0;
    let found = false;

    initialSpawnPosRef.current = { x: spawnX, y: spawnY };

    const isLargeLandmass = (startX: number, startY: number) => {
       const visited = new Set<string>();
       const queue = [{x: startX, y: startY}];
       visited.add(`${startX},${startY}`);
       let count = 0;
       
       while (queue.length > 0 && count < 150) {
          const p = queue.shift()!;
          count++;
          const neighbors = [
             {x: p.x + 1, y: p.y}, {x: p.x - 1, y: p.y},
             {x: p.x, y: p.y + 1}, {x: p.x, y: p.y - 1}
          ];
          for (const n of neighbors) {
             const key = `${n.x},${n.y}`;
             if (!visited.has(key)) {
                const tile = generateTile(n.x, n.y);
                if (tile.type !== 'water') {
                   visited.add(key);
                   queue.push(n);
                }
             }
          }
       }
       return count >= 150;
    };

    const searchStep = () => {
       if (found || r >= 200) {
          if (!found) {
             setPlayer(prev => ({ ...prev, pos: { x: spawnX, y: spawnY }, targetPos: { x: spawnX, y: spawnY } }));
          }
          setLoadingPhase('Generando nubes y extras...');
          setTimeout(generateExtras, 0);
          return;
       }

       const startR = r;
       // Process up to 5 radius rings per frame to balance speed and responsiveness
       while (r < startR + 5 && r < 200 && !found) {
           for (let dx = -r; dx <= r; dx++) {
              for (let dy = -r; dy <= r; dy++) {
                 if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                 
                 const cx = Math.floor(spawnX + dx);
                 const cy = Math.floor(spawnY + dy);
                 const tile = generateTile(cx, cy);
                 if (tile.type !== 'water') {
                    if (isLargeLandmass(cx, cy)) {
                       spawnX = cx + 0.5;
                       spawnY = cy + 0.5;
                       found = true;
                       initialSpawnPosRef.current = { x: spawnX, y: spawnY };
                       setPlayer(prev => ({ ...prev, pos: { x: spawnX, y: spawnY }, targetPos: { x: spawnX, y: spawnY } }));
                       break;
                    }
                 }
              }
              if (found) break;
           }
           r++;
       }
       
       if (!found) {
          requestAnimationFrame(searchStep);
       } else {
          setLoadingPhase('Generando nubes y extras...');
          setTimeout(generateExtras, 0);
       }
    };

    const generateExtras = () => {
        const commonSpeedX = 0.005; 
        const commonSpeedY = -0.002;
        const initialClouds: Cloud[] = [];
        for (let i = 0; i < 8; i++) {
            let x = spawnX + (Math.random() - 0.5) * 2000;
            let y = spawnY + (Math.random() - 0.5) * 2000;
            for (let attempt = 0; attempt < 5; attempt++) {
              const tooClose = initialClouds.some(c => Math.hypot(c.x - x, c.y - y) < 300);
              if (!tooClose) break;
              x = Math.random() * MAP_SIZE;
              y = Math.random() * MAP_SIZE;
            }

            initialClouds.push({
                id: Math.random().toString(),
                x,
                y,
                size: 20 + Math.random() * 200,
                speedX: commonSpeedX + (Math.random() - 0.5) * 0.001,
                speedY: commonSpeedY + (Math.random() - 0.5) * 0.001,
                opacity: 0.05 + Math.random() * 0.25
            });
        }
        setClouds(initialClouds);
        
        let campX = spawnX + 2;
        let campY = spawnY;
        let campFound = false;
        for (let cr = 1; cr < 15; cr++) {
           for (let dx = -cr; dx <= cr; dx++) {
              for (let dy = -cr; dy <= cr; dy++) {
                 if (Math.abs(dx) !== cr && Math.abs(dy) !== cr) continue;
                 const cx = Math.floor(spawnX + dx);
                 const cy = Math.floor(spawnY + dy);
                 if (generateTile(cx, cy).type !== 'water') {
                    campX = cx + 0.5;
                    campY = cy + 0.5;
                    campFound = true;
                    break;
                 }
              }
              if (campFound) break;
           }
           if (campFound) break;
        }
        setCampfire({ pos: { x: campX, y: campY }, animFrame: 0, particles: [] });

        setLoadingPhase('Generando terreno y recursos...');
        setTimeout(() => setLoadingPhase(null), 1000); // Allow chunks to generate for 1 second
    };

    requestAnimationFrame(searchStep);

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => Math.max(0.5, Math.min(2.0, prev * delta)));
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm') {
        setIsMapOpen(prev => !prev);
      }
      const numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
      const keyIndex = numKeys.indexOf(e.key);
      if (keyIndex !== -1) {
        setPlayer(prev => ({ ...prev, selectedHotbarIndex: keyIndex === 9 ? 9 : keyIndex }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [gameStarted]);

  const lastMouseMoveTime = useRef(0);
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastMouseMoveTime.current > 16) { // ~60fps
      setMousePos({ x: e.clientX, y: e.clientY });
      lastMouseMoveTime.current = now;
    }
  };

  const getResourceAtPos = useCallback((worldX: number, worldY: number, radius: number = 0.8) => {
    // Collect all candidates within the search radius
    const candidates = resources.filter(r => {
      if (r.isDepleted) return false;
      const dx = r.pos.x - worldX;
      const dy = r.pos.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });

    if (candidates.length === 0) return null;

    // Pick the one closest to the pointer to avoid ambiguous selection
    return candidates.sort((a, b) => {
      let distA = Math.sqrt(Math.pow(a.pos.x - worldX, 2) + Math.pow(a.pos.y - worldY, 2));
      let distB = Math.sqrt(Math.pow(b.pos.x - worldX, 2) + Math.pow(b.pos.y - worldY, 2));
      return distA - distB;
    })[0];
  }, [resources]);

  const getEnemyAtPos = useCallback((worldX: number, worldY: number, radius: number = 0.8) => {
    const candidates = enemies.filter(e => {
      const dx = e.pos.x - worldX;
      const dy = e.pos.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < radius;
    });

    if (candidates.length === 0) return null;

    return candidates.sort((a, b) => {
      let distA = Math.sqrt(Math.pow(a.pos.x - worldX, 2) + Math.pow(a.pos.y - worldY, 2));
      let distB = Math.sqrt(Math.pow(b.pos.x - worldX, 2) + Math.pow(b.pos.y - worldY, 2));
      return distA - distB;
    })[0];
  }, [enemies]);

  const hoveredResource = (() => {
    if (!canvasRef.current || (isHoveringInventoryWindow && hoveredInvIndex !== null) || (isHoveringHotbarWindow && hoveredHotbarIndex !== null)) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const worldPos = fromIso(mousePos.x - rect.left, mousePos.y - rect.top, camera, zoom, canvasRef.current);
    return getResourceAtPos(worldPos.x, worldPos.y, 0.8);
  })();

  const hoveredEnemy = (() => {
    if (!canvasRef.current || (isHoveringInventoryWindow && hoveredInvIndex !== null) || (isHoveringHotbarWindow && hoveredHotbarIndex !== null)) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const worldPos = fromIso(mousePos.x - rect.left, mousePos.y - rect.top, camera, zoom, canvasRef.current);
    return getEnemyAtPos(worldPos.x, worldPos.y, 0.8);
  })();

  const activeHoveredResource = (() => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const worldPos = fromIso(mousePos.x - rect.left, mousePos.y - rect.top, camera, zoom, canvasRef.current);
    return getResourceAtPos(worldPos.x, worldPos.y, 0.8);
  })();

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    setIsMouseDown(true);
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const worldPos = fromIso(e.clientX - rect.left, e.clientY - rect.top, camera, zoom, canvasRef.current);
    
    const target = getResourceAtPos(worldPos.x, worldPos.y, 1.0);

    if (target) {
      const axe = player.equipment.tool_axe;
      const pickaxe = player.equipment.tool_pickaxe;
      
      let canHarvest = false;
      if (target.type === 'wood' && axe) canHarvest = true;
      else if (target.type !== 'wood' && pickaxe) canHarvest = true;
      
      if (canHarvest || target.isStick) {
        if (target.isStick) {
          const dist = Math.sqrt(Math.pow(target.pos.x - player.pos.x, 2) + Math.pow(target.pos.y - player.pos.y, 2));
          if (dist < 2.5) {
            setPlayer(prev => {
              const harvestResult = getNewInventory(prev.inventory, target.type, target.amount);
              return { ...prev, inventory: harvestResult.inventory };
            });
            setResources(prev => prev.filter(r => r.id !== target.id));
          }
        } else {
          setPlayer(prev => ({ ...prev, harvestingId: target.id, harvestProgress: 0 }));
        }
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsMouseDown(false);
    setPlayer(prev => ({ ...prev, harvestingId: null, harvestProgress: 0 }));
  };


  const getTile = useCallback((x: number, y: number) => {
    if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return null;
    let map = mapTilesRef.current;
    if (!map[x]) map[x] = {};
    if (!map[x][y]) {
      map[x][y] = generateTile(x, y);
    }
    return map[x][y];
  }, []);

  const getTerrainHeight = useCallback((tx: number, ty: number) => {
    const tile = getTile(Math.floor(tx), Math.floor(ty));
    if (!tile) return 0;
    return -tile.height + (tile.type === 'water' ? 8 : 0);
  }, [getTile]);

  const update = useCallback((delta: number) => {
    if (loadingPhase !== null || isDead) return;

    // Environment update
    const env = environmentRef.current;
    env.timeOfDay = (env.timeOfDay + delta * 0.0235) % 24000;
    env.cloudOffset += delta * 0.002;
    
    // Chunk generation
    const cx = Math.floor(player.pos.x / 10);
    const cy = Math.floor(player.pos.y / 10);
    let resourcesAdded = false;
    const newResources: WorldResource[] = [];
    let chunksLoadedThisFrame = 0;
    
    for(let dx = -2; dx <= 2; dx++){
      for(let dy = -2; dy <= 2; dy++){
         const key = `${cx+dx},${cy+dy}`;
         if(!loadedChunksRef.current.has(key)) {
            loadedChunksRef.current.add(key);
            const generated = generateResourcesForChunk(cx+dx, cy+dy);
            if (generated.length > 0) {
               newResources.push(...generated);
               resourcesAdded = true;
            }
            chunksLoadedThisFrame++;
            if (chunksLoadedThisFrame >= 2) break;
         }
      }
      if (chunksLoadedThisFrame >= 2) break;
    }
    if (resourcesAdded) {
       setResources(r => [...r, ...newResources]);
    }

    // Fog reveal
    const px = Math.floor(player.pos.x);
    const py = Math.floor(player.pos.y);
    const revealRadius = 12;
    for (let dx = -revealRadius; dx <= revealRadius; dx++) {
      for (let dy = -revealRadius; dy <= revealRadius; dy++) {
         if (dx*dx + dy*dy <= revealRadius*revealRadius) {
            const tile = getTile(px+dx, py+dy);
            if (tile && !tile.explored) tile.explored = true;
         }
      }
    }
    
    const now = Date.now();
    if (now - env.lastEnvSoundTime > env.nextEnvSoundDelay) {
       env.lastEnvSoundTime = now;
       env.nextEnvSoundDelay = 15000 + Math.random() * 30000; // 15 to 45 seconds
       
       const isDay = env.timeOfDay > 4000 && env.timeOfDay < 20000;
       const randomFactor = Math.random();
       if (isDay && randomFactor < 0.6) {
          playBirdSound();
       } else if (!isDay && randomFactor < 0.6) {
          playCricketSound();
       }
       
       // Weather transition deleted
       env.isRaining = false;
    }

    let inputX = 0;
    let inputY = 0;

    if (keys.current.has('w')) inputY -= 1;
    if (keys.current.has('s')) inputY += 1;
    if (keys.current.has('a')) inputX -= 1;
    if (keys.current.has('d')) inputX += 1;

    const isInputting = inputX !== 0 || inputY !== 0;

    if (isInputting) {
      lastStepTimeRef.current += delta;
      const stepInterval = 280; // ms per step
      if (lastStepTimeRef.current > stepInterval) {
        lastStepTimeRef.current = 0;
        const currentTileType = getTile(Math.floor(player.pos.x), Math.floor(player.pos.y))?.type;
        playStepSound(currentTileType);
        setParticles(p => {
          // Calculate isometric screen angle for rotation
          const iso1 = { x: (player.pos.x - player.pos.y) * TILE_SIZE / 2, y: (player.pos.x + player.pos.y) * TILE_SIZE / 4 };
          const iso2 = { x: (player.pos.x + inputX - (player.pos.y + inputY)) * TILE_SIZE / 2, y: (player.pos.x + inputX + player.pos.y + inputY) * TILE_SIZE / 4 };
          const screenAngle = Math.atan2(iso2.y - iso1.y, iso2.x - iso1.x);
          
          // Offset left/right foot
          const isLeftFoot = Math.sin(player.animFrame * PLAYER_WALK_FREQ) > 0;
          const perpAngle = screenAngle + Math.PI / 2;
          const offsetDist = 0.1; // in world coords rough approx, let's keep it abstract, we can offset drawing or pos
          const screenOffset = isLeftFoot ? -3 : 3;
          // Apply offset in screen space by storing it inside Particle or modifying pos
          // We can just add offset directly to screen position during rendering if we wanted, but let's shift World Pos slightly.
          // In world pos, right is along (1, 1), up is (-1, 1). So perpendicular to direction.
          const normLength = Math.sqrt(inputX*inputX + inputY*inputY);
          const nx = -inputY / normLength; // perpendicular
          const ny = inputX / normLength;
          let pX = player.pos.x + (isLeftFoot ? nx : -nx) * offsetDist;
          let pY = player.pos.y + (isLeftFoot ? ny : -ny) * offsetDist;

          return [
            ...p,
            {
              id: Math.random().toString(),
              type: 'footprint',
              pos: { x: pX, y: pY },
              vel: { x: 0, y: 0 },
              life: 4000,
              maxLife: 4000,
              rotation: screenAngle
            }
          ];
        });
      }
    } else {
       lastStepTimeRef.current = 0; // reset when stopped
    }

    // 1. Harvesting Logic (Outside setPlayer to avoid race conditions and double triggers)
    if (!isInputting && player.harvestingId && isMouseDown) {
      const targetResource = resources.find(r => r.id === player.harvestingId && !r.isDepleted);
      if (targetResource) {
        let dist = Math.sqrt(Math.pow(targetResource.pos.x - player.pos.x, 2) + Math.pow(targetResource.pos.y - player.pos.y, 2));
        if (dist < 2.5) {
          const axe = player.equipment.tool_axe;
          const pickaxe = player.equipment.tool_pickaxe;
          
          let toolToUse = null;
          if (targetResource.type === 'wood') toolToUse = axe;
          else toolToUse = pickaxe;

          let multiplier = 1;
          if (toolToUse) {
            if (toolToUse.type === 'super_axe' && targetResource.type === 'wood') multiplier = 10;
            else if (toolToUse.type === 'super_pickaxe' && targetResource.type !== 'wood') multiplier = 10;
            else if (toolToUse.type === 'axe_wood' && targetResource.type === 'wood') multiplier = 3.5;
            else if (toolToUse.type === 'pickaxe_wood' && targetResource.type !== 'wood') multiplier = 1.8;
          }

          let addedProgress = delta * (targetResource.type === 'wood' ? 0.025 : 0.015) * multiplier;
          let totalProgress = player.harvestProgress + addedProgress;

          if (targetResource.type === 'wood') {
              if (Date.now() - lastChopSoundTimeRef.current > 500) {
                  playChopSound();
                  lastChopSoundTimeRef.current = Date.now();
              }
          } else if (!targetResource.isStick) {
              if (Date.now() - lastPickSoundTimeRef.current > 500) {
                  playPickSound();
                  lastPickSoundTimeRef.current = Date.now();
              }
          }

          if (toolToUse?.type === 'super_pickaxe' && targetResource.type !== 'wood') {
              const now = Date.now();
              if (now - lastHarvestTimeRef.current >= 500) {
                  lastHarvestTimeRef.current = now;
                  totalProgress = 100;
              } else {
                  totalProgress = 0;
              }
          }

          if (totalProgress >= 100) {
            // UNIT COLLECTED
            const resourceId = targetResource.id;
            const resourceType = targetResource.type;
            const amountToHarvest = toolToUse?.type === 'super_pickaxe' ? 100 : 1;
            
            const harvestResult = getNewInventory(player.inventory, resourceType, amountToHarvest);
            if (harvestResult.full) {
              if (harvestResult.full) {
                 queueNotification('¡Inventario lleno!');
              }
              setPlayer(prev => ({ ...prev, harvestProgress: 0, harvestingId: null }));
              return;
            }
            
            // Deduct from world
            setResources(prevRes => 
              prevRes.map(r => {
                if (r.id === resourceId) {
                  const nextAmount = Math.max(0, r.amount - amountToHarvest);
                  if (nextAmount <= 0) {
                    return { ...r, amount: 0, isDepleted: true };
                  }
                  return { ...r, amount: nextAmount };
                }
                return r;
              }).filter((r): r is WorldResource => r !== null)
            );
            
            // Leaf burst if wood
            if (resourceType === 'wood') {
              setParticles(prev => [
                ...prev,
                ...Array.from({ length: 4 }).map(() => ({ // Reduced count: 12 -> 4
                  id: Math.random().toString(),
                  type: 'leaf' as const,
                  pos: { x: targetResource.pos.x + (Math.random() - 0.5) * 0.6, y: targetResource.pos.y - 0.4 },
                  vel: { x: (Math.random() - 0.5) * 0.02, y: 0.01 + Math.random() * 0.02 }, // Fall slower and down
                  life: 2000 + Math.random() * 1500,
                  maxLife: 3500,
                  rotation: Math.random() * Math.PI
                }))
              ]);
            }
            
            // Add to player inventory and reset progress
            setPlayer(prev => {
              const harvestResult = getNewInventory(prev.inventory, resourceType, amountToHarvest);
              const nextInv = harvestResult.inventory;
              
              if (harvestResult.full) {
                 queueNotification('¡Inventario lleno!');
              }
              

              
              if (resourceType === 'wood' && !unlockedRecipeNotifications.has('wood_unlocked')) {
                 setUnlockedRecipeNotifications(prev => {
                     const next = new Set(prev);
                     next.add('wood_unlocked');
                     recipes.forEach(r => next.add(r.type));
                     return next;
                 });
                 
                 // Show initial message
                 queueNotification('¡Has desbloqueado nuevas recetas de crafteo!');
                 
                 const woodRecipes = recipes.filter(r => r.wood > 0);
                 
                 woodRecipes.forEach((recipe, index) => {
                     queueNotification(`¡Nuevo objeto ${recipe.name} disponible para craftear!`, 1000 * (index + 1));
                 });
              }
              
              // Notifications will be handled by the block above upon unlocking the wood category.
              // We don't need the individual loop anymore for the wood recipes if they are handled upon initial unlock.

              return {
                ...prev,
                inventory: nextInv,
                harvestProgress: 0
              };
            });
          } else {
            setPlayer(prev => ({ ...prev, harvestProgress: totalProgress }));
          }
        } else {
          setPlayer(prev => ({ ...prev, harvestingId: null, harvestProgress: 0 }));
        }
      } else {
        setPlayer(prev => ({ ...prev, harvestingId: null, harvestProgress: 0 }));
      }
    } else if (player.harvestProgress > 0) {
      setPlayer(prev => ({ ...prev, harvestProgress: 0 }));
    }

    // 2. Movement and Animation
    setPlayer(prev => {
      let nextPos = { ...prev.pos };
      let nextVel = { ...prev.vel };
      let nextDir = prev.dir;
      let nextIsMoving = false;
      let nextAnimFrame = prev.animFrame + delta * 0.01;
      let nextHarvestingId = prev.harvestingId;
      let nextIdleTime = prev.idleTime;

      if (isInputting) {
        const dx = inputX + inputY;
        const dy = inputY - inputX;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
          const currentTile = getTile(Math.floor(prev.pos.x), Math.floor(prev.pos.y));
          const onSnow = currentTile?.type === 'snow';
          const targetSpeed = prev.speed;
          const targetVelX = (dx / length) * targetSpeed;
          const targetVelY = (dy / length) * targetSpeed;
          
          if (onSnow) {
            // Gradual acceleration
            // Check if velocity is opposite to target velocity
            const isOppositeX = (targetVelX * prev.vel.x < 0);
            const isOppositeY = (targetVelY * prev.vel.y < 0);
            
            // Increase penalty if opposite direction
            const penalty = (isOppositeX || isOppositeY) ? 0.025 : 0.05; 
            
            nextVel.x += (targetVelX - prev.vel.x) * penalty; 
            nextVel.y += (targetVelY - prev.vel.y) * penalty;
          } else {
            nextVel.x = targetVelX;
            nextVel.y = targetVelY;
          }
          
          nextIsMoving = true;
          // Set direction for animation
          if (Math.abs(dx) > Math.abs(dy)) nextDir = dx > 0 ? 'e' : 'w';
          else nextDir = dy > 0 ? 's' : 'n';
        }
      } else {
        // Friction
        const currentTile = getTile(Math.floor(prev.pos.x), Math.floor(prev.pos.y));
        const friction = (currentTile?.type === 'snow') ? 0.99 : 0.7; // Closer to 1 for more sliding
        nextVel.x *= friction;
        nextVel.y *= friction;
        if (Math.abs(nextVel.x) < 0.001) nextVel.x = 0;
        if (Math.abs(nextVel.y) < 0.001) nextVel.y = 0;
      }
      
      const potentialX = Math.max(0, Math.min(MAP_SIZE - 0.5, prev.pos.x + nextVel.x));
      const potentialY = Math.max(0, Math.min(MAP_SIZE - 0.5, prev.pos.y + nextVel.y));
          
      // Collision Check
      const hitTest = (px: number, py: number) => {
        const padding = 0.25; // Distancia desde el centro del jugador
        return getTile(Math.floor(px - padding), Math.floor(py - padding))?.type === 'water' ||
               getTile(Math.floor(px + padding), Math.floor(py - padding))?.type === 'water' ||
               getTile(Math.floor(px - padding), Math.floor(py + padding))?.type === 'water' ||
               getTile(Math.floor(px + padding), Math.floor(py + padding))?.type === 'water';
      };
      
      if (!hitTest(potentialX, potentialY)) {
        nextPos.x = potentialX;
        nextPos.y = potentialY;
      } else {
        // Try sliding along X
        if (!hitTest(potentialX, prev.pos.y)) {
            nextPos.x = potentialX;
        } else {
            // Try sliding along Y
            if (!hitTest(prev.pos.x, potentialY)) {
                nextPos.y = potentialY;
            }
        }
      }

      if (isInputting) {
        nextIsMoving = true;
        nextHarvestingId = null;
        nextIdleTime = 0;
      } else {
        nextIsMoving = false;
        if (nextHarvestingId && isMouseDown) {
          nextIdleTime = 0;
        } else {
          nextIdleTime += delta;
        }
      }

      // Camera follow moves with player
      const isoPos = toIso(nextPos.x, nextPos.y);
      setCamera({ x: isoPos.x, y: isoPos.y });

      return {
        ...prev,
        pos: nextPos,
        dir: nextDir,
        isMoving: nextIsMoving,
        animFrame: nextAnimFrame,
        harvestingId: nextHarvestingId,
        idleTime: nextIdleTime,
        vel: nextVel,
      };
    });

    // 3. Particles Update
    setParticles(prev => {
      const next = prev.map(p => ({
        ...p,
        pos: { x: p.pos.x + p.vel.x, y: p.pos.y + p.vel.y },
        vel: p.vel,
        rotation: p.rotation + (p.type === 'leaf' ? 0.1 : 0),
        life: p.life - delta
      })).filter(p => p.life > 0);

      // Spawn particles from resources
      resources.forEach(r => {
        if (!r.isDepleted) {
          if (r.type === 'wood' && Math.random() < 0.002) { 
            next.push({
              id: Math.random().toString(),
              type: 'leaf',
              pos: { x: r.pos.x + (Math.random() - 0.5), y: r.pos.y - 0.5 },
              vel: { x: (Math.random() - 0.5) * 0.01, y: 0.005 + Math.random() * 0.01 },
              life: 3000,
              maxLife: 3000,
              rotation: Math.random() * Math.PI
            });
          } else if (r.type === 'gold' && Math.random() < 0.01) {
            const vy = -0.015 - Math.random() * 0.015;
            const scatter = (Math.random() - 0.5) * 0.005;
            next.push({
              id: Math.random().toString(),
              type: 'gold_sparkle',
              pos: { x: r.pos.x + (Math.random() - 0.5) * 0.6, y: r.pos.y + (Math.random() - 0.5) * 0.6 },
              vel: { x: vy + scatter, y: vy - scatter }, // Float upwards in iso
              life: 1500,
              maxLife: 1500,
              rotation: Math.random() * Math.PI * 2
            });
          } else if (r.type === 'diamond' && Math.random() < 0.01) {
             const vy = -0.015 - Math.random() * 0.015;
             const scatter = (Math.random() - 0.5) * 0.005;
             next.push({
              id: Math.random().toString(),
              type: 'diamond_sparkle',
              pos: { x: r.pos.x + (Math.random() - 0.5) * 0.6, y: r.pos.y + (Math.random() - 0.5) * 0.6 },
              vel: { x: vy + scatter, y: vy - scatter }, // Float upwards in iso
              life: 1500,
              maxLife: 1500,
              rotation: Math.random() * Math.PI * 2
            });
          }
        }
      });

      // Spawn Fish
      for (let i = 0; i < 2; i++) { // Check a few random spots for fish to avoid double loop performance hit
          const rx = Math.floor(player.pos.x + (Math.random() - 0.5) * 40);
          const ry = Math.floor(player.pos.y + (Math.random() - 0.5) * 40);
          if (getTile(rx, ry)?.type === 'water' && Math.random() < 0.015) {
            next.push({
              id: Math.random().toString(),
              type: 'fish',
              pos: { x: rx + 0.4 + Math.random() * 0.2, y: ry + 0.4 + Math.random() * 0.2 },
              vel: { x: (Math.random() - 0.5) * 0.002, y: (Math.random() - 0.5) * 0.002 },
              life: 800,
              maxLife: 800,
              rotation: 0
            });
          }
      }

      // Spawn Animal Trails

      return next;
    });

    // 4. Animals Update
    setAnimals(prev => {
      let next = prev.filter(a => {
         const dist = Math.sqrt(Math.pow(a.pos.x - player.pos.x, 2) + Math.pow(a.pos.y - player.pos.y, 2));
         return dist < 60; // Despawn distance
      });

      next = next.map(a => {
         let { pos, vel, targetPos, state, timer, z, vz, facingLeft, type } = a;
         
         timer -= delta;
         
         // Physics (gravity for jumps)
         if ((z > 0 || vz !== 0) && type !== 'firefly' && type !== 'butterfly') {
            z += vz;
            vz -= 0.005; // gravity
            if (z <= 0) {
               z = 0;
               vz = 0;
               vel = { x: 0, y: 0 }; // land
            }
         }
         
         // State Machine (Wander AI)
         if (timer <= 0) {
            if (state === 'idle') {
               if (Math.random() < 0.6) {
                  state = 'moving';
                  timer = 500 + Math.random() * 2000;
                  let angle = Math.random() * Math.PI * 2;
                  let speed = 0.01;
                  if (type === 'firefly') {
                      speed = 0.005;
                      timer = 1500 + Math.random() * 3000;
                      let nearestTree = null;
                      let minDist = 15;
                      for (let r of resources) {
                          if (r.type === 'wood' && !r.isDepleted) {
                              const dist = Math.sqrt((r.pos.x - pos.x)**2 + (r.pos.y - pos.y)**2);
                              if (dist < minDist) { minDist = dist; nearestTree = r; }
                          }
                      }
                      if (nearestTree && minDist > 1) {
                          angle = Math.atan2(nearestTree.pos.y - pos.y, nearestTree.pos.x - pos.x) + (Math.random() - 0.5) * 1.5;
                      }
                  }
                  else if (type === 'butterfly') speed = 0.01;
                  
                  vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
               } else {
                  state = 'idle';
                  timer = 1000 + Math.random() * 2000;
                  vel = { x: 0, y: 0 };
               }
            } else {
               state = 'idle';
               timer = 500 + Math.random() * 2000;
               if (type !== 'firefly' && type !== 'butterfly') {
                  vel = { x: 0, y: 0 };
               }
            }
         }
         
         // Continuous movement update
         if (type === 'firefly' || type === 'butterfly') {
            if (state === 'moving') {
               vel.x += (Math.random() - 0.5) * (type === 'firefly' ? 0.001 : 0.005);
               vel.y += (Math.random() - 0.5) * (type === 'firefly' ? 0.001 : 0.005);
               const speedSq = vel.x*vel.x + vel.y*vel.y;
               const maxSpeedSq = type === 'firefly' ? 0.00003 : 0.0004;
               if (speedSq > maxSpeedSq) { vel.x *= 0.9; vel.y *= 0.9; }
               
               if (type === 'butterfly') {
                   z = Math.min(1.5 + Math.sin(Date.now() * 0.005 + pos.x) * 1.0, z + 0.1);
               } else {
                   z = 2.5 + Math.sin(Date.now() * 0.0005 + pos.x) * 1.5;
               }
            } else {
               vel.x *= 0.8;
               vel.y *= 0.8;
               if (type === 'butterfly') {
                   z = Math.max(0, z - 0.05); // Slowly land
               } else {
                   z = 2.5 + Math.sin(Date.now() * 0.0005 + pos.x) * 1.5;
               }
            }
            if (vel.x < -0.001) facingLeft = true;
            else if (vel.x > 0.001) facingLeft = false;
            
            pos.x += vel.x;
            pos.y += vel.y;
         } else {
             pos.x += vel.x;
             pos.y += vel.y;
            if (vel.x < -0.001) facingLeft = true;
            else if (vel.x > 0.001) facingLeft = false;
         }
         
         // Boundary & water checks
         const t = getTile(Math.floor(pos.x), Math.floor(pos.y));
         if (!t) {
            vel.x *= -1; vel.y *= -1;
            pos.x += vel.x * 2; pos.y += vel.y * 2;
         } else if (t.type === 'water' && type !== 'firefly' && type !== 'butterfly') {
            vel.x *= -1; vel.y *= -1;
            pos.x += vel.x * 2; pos.y += vel.y * 2;
         }
         
         return { ...a, pos, vel, targetPos, state, timer, z, vz, facingLeft };
      });

      // Spawn
      if (next.length < 30 && Math.random() < 0.05) {
         const rx = player.pos.x + (Math.random() - 0.5) * 70;
         const ry = player.pos.y + (Math.random() - 0.5) * 70;
         if (Math.abs(rx - player.pos.x) > 20 || Math.abs(ry - player.pos.y) > 20) {
            const tile = getTile(Math.floor(rx), Math.floor(ry));
            if (tile) {
               let allowedTypes: AnimalType[] = [];
               if (tile.type === 'water') allowedTypes = [];
               else if (tile.type === 'grass') allowedTypes = ['butterfly', 'firefly'];
               else if (tile.type === 'dirt') allowedTypes = ['firefly', 'butterfly'];
               
               if (allowedTypes.length > 0) {
                  const type = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
                  next.push({
                     id: Math.random().toString(),
                     type,
                     pos: { x: rx, y: ry },
                     vel: { x: 0, y: 0 },
                     targetPos: null,
                     state: 'idle',
                     timer: 1000 + Math.random() * 2000,
                     z: 0,
                     vz: 0,
                     scale: type === 'butterfly' ? 0.4 + Math.random() * 0.3 : (type === 'firefly' ? 0.2 + Math.random() * 0.2 : 0.8 + Math.random() * 0.4),
                     facingLeft: Math.random() > 0.5,
                     color: type === 'firefly' ? ['#aaff00', '#00ffaa', '#ffff00', '#ffaa00'][Math.floor(Math.random()*4)] : ['#ffffff', '#cccccc', '#ffccaa'][Math.floor(Math.random()*3)]
                  });
               }
            }
         }
      }

      return next;
    });

    // 4.5 Enemies Update
    setEnemies(prev => {
      let next = prev.filter(e => {
         const dist = Math.sqrt((e.pos.x - player.pos.x)**2 + (e.pos.y - player.pos.y)**2);
         return dist < 60; // Despawn distance
      });

      next = next.map(e => {
         let { pos, vel, state, timer, facingLeft, pounceCooldown, z } = e;
         timer -= delta;
         pounceCooldown = (pounceCooldown || 0) - delta;

         const distToPlayer = Math.sqrt((pos.x - player.pos.x)**2 + (pos.y - player.pos.y)**2);
         const dx = player.pos.x - pos.x;
         const dy = player.pos.y - pos.y;

         // State Machine
         if (distToPlayer < 5 && (state.startsWith('wander') || state === 'returning')) {
             state = 'alert';
             timer = 2000; // Wait 2 seconds before chasing
             vel = { x: 0, y: 0 };
             facingLeft = dx < 0;
         } else if (state === 'alert') {
             facingLeft = dx < 0;
             if (timer <= 0) {
                 if (distToPlayer < 5) {
                     state = 'chasing';
                 } else {
                     state = 'returning';
                 }
             }
         } else if (state === 'chasing') {
             if (distToPlayer > 7) { // Lost interest
                 state = 'returning';
                 vel = { x: 0, y: 0 };
             } else if (distToPlayer <= 4 && pounceCooldown <= 0) {
                 state = 'pounce_windup';
                 timer = 500; // Medio segundo de advertencia
                 vel = { x: 0, y: 0 };
                 facingLeft = dx < 0;
             } else if (distToPlayer <= 1.0) {
                 // Mantener 1 casilla de distancia, no caminar encima del jugador
                 vel = { x: 0, y: 0 };
                 facingLeft = dx < 0;
             } else {
                const speed = e.rarity === 'fuerte' ? 0.015 : 0.01; 
                const angle = Math.atan2(dy, dx);
                vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
                facingLeft = dx < 0;
             }
         } else if (state === 'pounce_windup') {
             facingLeft = dx < 0;
             if (timer <= 0) {
                 state = 'pounce_jump';
                 timer = 300; // Duración del salto (milisegundos)
                 
                 // El salto debe ser de máximo 1 casilla, y nunca sobrepasar el límite de 1 casilla de distancia
                 const maxJumpDist = 1.0;
                 const distanceToMargin = Math.max(0, distToPlayer - 1.0);
                 const jumpDist = Math.min(maxJumpDist, distanceToMargin);
                 
                 // 300ms a 60fps son ~18 frames. Velocidad = distancia / frames
                 const jumpSpeed = jumpDist / 18; 
                 
                 const angle = Math.atan2(dy, dx);
                 vel = { x: Math.cos(angle) * jumpSpeed, y: Math.sin(angle) * jumpSpeed };
             }
         } else if (state === 'pounce_jump') {
             if (timer <= 0) {
                 state = 'chasing';
                 pounceCooldown = 2000 + Math.random() * 3000; // 2 a 5 segundos de cooldown
                 z = 0;
             } else {
                 // Arco parabólico
                const progress = 1 - (timer / 300);
                z = Math.sin(progress * Math.PI) * 0.8; // Altura máxima del salto
                
                // Deal damage if hitting player during jump
                if (distToPlayer < 1.0 && !isDead) {
                    setPlayer(prev => {
                        const damage = (e.attack || 2) * (delta / 800); 
                        const nextHp = Math.max(0, prev.hp - damage);
                        if (nextHp <= 0) setIsDead(true);
                        return { ...prev, hp: nextHp };
                    });
                }
             }
         } else if (state === 'returning') {
             const hdx = e.homePos.x - pos.x;
             const hdy = e.homePos.y - pos.y;
             const distToHome = Math.sqrt(hdx*hdx + hdy*hdy);
             if (distToHome < 0.5) {
                 state = 'wander_idle';
                 timer = 1000;
                 vel = { x: 0, y: 0 };
             } else {
                 const speed = 0.005;
                 const angle = Math.atan2(hdy, hdx);
                 vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
                 facingLeft = hdx < 0;
             }
         } else if (timer <= 0) {
             // Wandering logic
             if (state === 'wander_idle') {
                 if (Math.random() < 0.5) {
                     state = 'wander_moving';
                     timer = 1000 + Math.random() * 2000;
                     const angle = Math.random() * Math.PI * 2;
                     const speed = e.rarity === 'fuerte' ? 0.003 : 0.002;
                     vel = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
                 } else {
                     state = 'wander_idle';
                     timer = 1000 + Math.random() * 2000;
                     vel = { x: 0, y: 0 };
                 }
             } else {
                 state = 'wander_idle';
                 timer = 1000 + Math.random() * 2000;
                 vel = { x: 0, y: 0 };
             }
         }

         if (state === 'wander_moving' || state === 'chasing') {
            if (vel.x < -0.001) facingLeft = true;
            else if (vel.x > 0.001) facingLeft = false;
         }

         pos.x += vel.x;
         pos.y += vel.y;

         // Boundary & water/snow checks
         const t = getTile(Math.floor(pos.x), Math.floor(pos.y));
         if (!t || t.type === 'water' || t.type === 'snow') {
             vel.x *= -1; vel.y *= -1;
             pos.x += vel.x * 2; pos.y += vel.y * 2;
             if (state === 'chasing' || state === 'returning' || state === 'pounce_jump') {
                 state = 'wander_idle';
                 timer = 1000;
                 vel = { x: 0, y: 0 };
                 z = 0;
             }
         }

         return { ...e, pos, vel, state, timer, facingLeft, pounceCooldown, z };
      });

      // Spawn Enemies
      if (next.length < 8 && Math.random() < 0.02) {
         const rx = player.pos.x + (Math.random() - 0.5) * 60;
         const ry = player.pos.y + (Math.random() - 0.5) * 60;
         if (Math.abs(rx - player.pos.x) > 15 || Math.abs(ry - player.pos.y) > 15) {
             const tile = getTile(Math.floor(rx), Math.floor(ry));
             if (tile && tile.type !== 'water' && tile.type !== 'snow') {
                  const isStrong = Math.random() < 0.3; // 30% chance of strong spider
                  const names = isStrong ? ['Araña Gigante', 'Acechadora Purpura', 'Sombra Venenosa', 'Reina del Bosque'] : ['Viuda Negra', 'Tarántula', 'Araña Lobo', 'Reclusa Parda'];
                  const randomName = names[Math.floor(Math.random() * names.length)];
                  
                  const level = isStrong ? (Math.floor(Math.random() * 5) + 4) : (Math.floor(Math.random() * 3) + 1);
                  const baseHp = isStrong ? 15 : 10; // Slightly more base HP for strong ones
                  const maxHp = level * baseHp;
                  const attack = level * (isStrong ? 3 : 2);
                  const scale = isStrong ? 0.55 + Math.random() * 0.1 : 0.4 + Math.random() * 0.15;

                  next.push({
                      id: Math.random().toString(),
                      type: 'spider',
                      rarity: isStrong ? 'fuerte' : 'normal',
                      pos: { x: rx, y: ry },
                      vel: { x: 0, y: 0 },
                      state: 'wander_idle',
                      timer: 1000,
                      facingLeft: false,
                      scale: scale,
                      z: 0,
                      homePos: { x: rx, y: ry },
                      pounceCooldown: 2000 + Math.random() * 3000,
                      name: randomName,
                      level: level,
                      hp: maxHp,
                      maxHp: maxHp,
                      attack: attack
                  });
             }
         }
      }

      return next;
    });

    setClouds(prev => prev.map(c => ({
        ...c,
        x: (c.x + c.speedX * delta + MAP_SIZE) % MAP_SIZE,
        y: (c.y + c.speedY * delta + MAP_SIZE) % MAP_SIZE
    })));


    // 6. Campfire Animation
    if (campfire) {
      setCampfire(prev => {
        if (!prev) return null;
        let particles = [...prev.particles.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - delta })).filter(p => p.life > 0)];
        
        // Add new particles (fewer, slower)
        if (Math.random() < 0.1) {
            particles.push({
                id: Math.random().toString(),
                x: prev.pos.x + (Math.random() - 0.5) * 0.5,
                y: prev.pos.y + (Math.random() - 0.5) * 0.5,
                vx: -(0.010 + Math.random() * 0.005), // Northwest (negative vx, slower)
                vy: -0.01 - Math.random() * 0.005, // Slower rise
                life: 600 + Math.random() * 200,
                color: Math.random() > 0.5 ? '#ff4500' : '#ffa500',
                size: 0.2 + Math.random() * 0.2 // Larger size
            });
        }
        
        return { ...prev, animFrame: prev.animFrame + delta * 0.005, particles };
      });
    }

  }, [isMouseDown, resources, player, mapTiles, animals, playStepSound, playBirdSound, campfire, loadingPhase]);

  useGameLoop(update);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false; // Keep it pixelated

    // Clear background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Center of screen
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    // Offset by camera
    ctx.translate(-camera.x, -camera.y);

    // Calculate visible area based on screen bounds and zoom
    const screenW = canvas.width / zoom;
    const screenH = canvas.height / zoom;
    const camIsoX = camera.x;
    const camIsoY = camera.y;

    const toGrid = (isoX: number, isoY: number) => {
        return {
           x: (isoX / (TILE_SIZE / 2) + isoY / (TILE_SIZE / 4)) / 2,
           y: (isoY / (TILE_SIZE / 4) - isoX / (TILE_SIZE / 2)) / 2
        };
    };

    const p1 = toGrid(camIsoX - screenW / 2, camIsoY - screenH / 2);
    const p2 = toGrid(camIsoX + screenW / 2, camIsoY - screenH / 2);
    const p3 = toGrid(camIsoX - screenW / 2, camIsoY + screenH / 2);
    const p4 = toGrid(camIsoX + screenW / 2, camIsoY + screenH / 2);

    const minX = Math.max(0, Math.floor(Math.min(p1.x, p2.x, p3.x, p4.x)) - 4);
    const maxX = Math.min(MAP_SIZE - 1, Math.ceil(Math.max(p1.x, p2.x, p3.x, p4.x)) + 4);
    const minY = Math.max(0, Math.floor(Math.min(p1.y, p2.y, p3.y, p4.y)) - 4);
    const maxY = Math.min(MAP_SIZE - 1, Math.ceil(Math.max(p1.y, p2.y, p3.y, p4.y)) + 4);

    const minSum = minX + minY;
    const maxSum = maxX + maxY;

    // Draw Grid / Floor
    for (let sum = minSum; sum <= maxSum; sum++) {
      for (let x = minX; x <= maxX; x++) {
        const y = sum - x;
        if (x >= MAP_SIZE || y >= MAP_SIZE || x < 0 || y < 0 || y < minY || y > maxY) continue;
        
        const tile = getTile(x, y);
        if (!tile || !tile.explored) continue;

        const isWater = tile.type === 'water';
        const zOff = -tile.height + (isWater ? 8 : 0);
        
        const isoBase = toIso(x, y);
        const iso = { x: isoBase.x, y: isoBase.y + zOff };

        const colors = TILE_COLORS[tile.type];

        // Draw the top face
        ctx.beginPath();
        
        ctx.moveTo(iso.x, iso.y);
        ctx.lineTo(iso.x + TILE_SIZE / 2, iso.y + TILE_SIZE / 4);
        ctx.lineTo(iso.x, iso.y + TILE_SIZE / 2);
        ctx.lineTo(iso.x - TILE_SIZE / 2, iso.y + TILE_SIZE / 4);
        ctx.closePath();
        
        // Organic color variation based on noise
        let r, g, b;
        if (tile.type === 'grass') { r = 66; g = 105; b = 56; }
        else if (tile.type === 'dirt') { r = 112; g = 84; b = 62; }
        else if (tile.type === 'limestone') { r = 120; g = 120; b = 120; }
        else if (tile.type === 'snow') { 
          const variation = tile.variation || 0;
          r = 230 + variation * 10;
          g = 235 + variation * 10;
          b = 245 + variation * 10;
        }
        else { r = 59; g = 130; b = 168; }

        let nBase = 0;
        if (tile.type !== 'water') {
           const noise = Math.abs(Math.sin((x || 0) * 12.9898 + (y || 0) * 78.233) * 43758.5453) % 1;
           nBase = (noise - 0.5) * (tile.type === 'snow' ? 5 : 10);
        }

        ctx.fillStyle = `rgb(${r + nBase}, ${g + nBase}, ${b + nBase})`;

        ctx.fill();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1/zoom;
        ctx.stroke();

        // Add subtle details
        if (tile.type === 'grass' || tile.type === 'dirt' || tile.type === 'limestone' || tile.type === 'snow') {
          const detailSeed = (x || 0) * 123.456 + (y || 0) * 789.012;
          const detailNoise = Math.abs(Math.sin(detailSeed) * 54321.1234) % 1;
          
          if (detailNoise > 0.8) {
            const posX = iso.x + (Math.sin(detailSeed * 10) * TILE_SIZE / 3);
            const posY = iso.y + TILE_SIZE / 4 + (Math.cos(detailSeed * 10) * TILE_SIZE / 6);

            ctx.fillStyle = tile.type === 'grass' 
                ? `rgb(${Math.max(0, r - 30)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 30)})` 
                : tile.type === 'dirt' 
                  ? `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)})`
                  : tile.type === 'limestone'
                  ? `rgb(${Math.max(0, r - 10)}, ${Math.max(0, g - 10)}, ${Math.max(0, b - 10)})`
                  : `rgb(${Math.max(0, r + 5)}, ${Math.max(0, g + 5)}, ${Math.max(0, b + 10)})`; // Brighter for snow
            
            ctx.beginPath();
            if (tile.type === 'grass') {
                 // Draw a small "blade"
                 ctx.arc(posX, posY, 1.5, 0, Math.PI * 2);
            } else if (tile.type === 'dirt') {
                 // Draw a small "rock"
                 ctx.arc(posX, posY, 2, 0, Math.PI * 2);
            } else if (tile.type === 'limestone') {
                 // Limestone texture (varied small rectangles oriented to the isometric grid)
                 for(let k=0; k<8; k++) {
                     const sizeSeed = detailSeed + k * 10;
                     const randomW = (Math.sin(sizeSeed) + 1) * 2 + 1; // Width random 1 to 5
                     const randomH = (Math.cos(sizeSeed) + 1) * 1 + 0.5; // Height random 0.5 to 2.5
                     const offsetX = (Math.sin(sizeSeed * 2) * TILE_SIZE / 3);
                     const offsetY = (Math.cos(sizeSeed * 3) * TILE_SIZE / 4);
                     
                     const w = randomW;
                     const h = randomH;
                     const cx = posX + offsetX - TILE_SIZE / 6;
                     const cy = posY + offsetY - TILE_SIZE / 6;
                     
                     ctx.moveTo(cx - w / 2, cy - w / 4);
                     ctx.lineTo(cx + w / 2, cy + w / 4);
                     ctx.lineTo(cx + w / 2, cy + w / 4 + h);
                     ctx.lineTo(cx - w / 2, cy - w / 4 + h);
                     ctx.closePath();
                 }
            } else {
                // Snow flake
                ctx.arc(posX, posY, 1.5, 0, Math.PI * 2);
            }
            ctx.fill();
          }
        }

        // Draw sides to give depth (pillar style for height varying maps)
        const wallH = 40; // Extend deep enough to cover height map variations
        
        // Left Wall
        ctx.fillStyle = isWater ? '#2a6382' : (tile.type === 'dirt' ? '#5c4331' : (tile.type === 'limestone' ? '#606060' : (tile.type === 'snow' ? '#cbd5e1' : '#2f4f26'))); // Darker for shade
        ctx.beginPath();
        ctx.moveTo(iso.x - TILE_SIZE / 2, iso.y + TILE_SIZE / 4);
        ctx.lineTo(iso.x, iso.y + TILE_SIZE / 2);
        ctx.lineTo(iso.x, iso.y + TILE_SIZE / 2 + wallH);
        ctx.lineTo(iso.x - TILE_SIZE / 2, iso.y + TILE_SIZE / 4 + wallH);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1/zoom;
        ctx.stroke();
        
        // Right Wall
        ctx.fillStyle = isWater ? '#327296' : (tile.type === 'dirt' ? '#684d38' : (tile.type === 'limestone' ? '#757575' : (tile.type === 'snow' ? '#dbe6f0' : '#3c6133'))); // Slightly lighter
        ctx.beginPath();
        ctx.moveTo(iso.x, iso.y + TILE_SIZE / 2);
        ctx.lineTo(iso.x + TILE_SIZE / 2, iso.y + TILE_SIZE / 4);
        ctx.lineTo(iso.x + TILE_SIZE / 2, iso.y + TILE_SIZE / 4 + wallH);
        ctx.lineTo(iso.x, iso.y + TILE_SIZE / 2 + wallH);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1/zoom;
        ctx.stroke();

        // Texture Details
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(iso.x, iso.y);
        ctx.lineTo(iso.x + TILE_SIZE / 2, iso.y + TILE_SIZE / 4);
        ctx.lineTo(iso.x, iso.y + TILE_SIZE / 2);
        ctx.lineTo(iso.x - TILE_SIZE / 2, iso.y + TILE_SIZE / 4);
        ctx.closePath();
        ctx.clip(); 

        if (tile.type === 'grass') {
            const seed = (x * 12.3 + y * 4.5);
            
            // Draw tufts (fewer and softer)
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1/zoom;
            for (let i = 0; i < 3; i++) {
              const bx = (seed * 50 + i * 15) % 20 - 10;
              const by = (seed * 80 + i * 12) % 10 - 5;
              ctx.beginPath();
              ctx.moveTo(iso.x + bx, iso.y + by + TILE_SIZE/4);
              ctx.lineTo(iso.x + bx + 1.5, iso.y + by + TILE_SIZE/4 - 3);
              ctx.lineTo(iso.x + bx + 3, iso.y + by + TILE_SIZE/4 - 1);
              ctx.stroke();
            }
          } else if (tile.type === 'dirt') {
            const seed = (x * 7.7 + y * 3.3);
            
            // Pebbles and rough spots (fewer and softer)
            for (let i = 0; i < 4; i++) {
              const px = ((seed + i) * 17) % 24 - 12;
              const py = ((seed + i) * 23) % 12 - 6;
              const size = ((seed + i) % 2) + 1;
              ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.05)';
              ctx.fillRect(iso.x + px, iso.y + py + TILE_SIZE/4, size, size/2);
            }
          } else if (tile.type === 'water') {
            drawWaterAnimations(ctx, iso, x, y, zoom, TILE_SIZE);
          }
          ctx.restore();
      }
    }

    // Filter objects by visible bounds
    const isVisible = (p: Point) => {
       if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) return false;
       const t = getTile(Math.floor(p.x), Math.floor(p.y));
       return t?.explored;
    };

    // Sort objects for depth rendering
    const mineralsGround = ['coal', 'stone', 'iron', 'copper', 'gold', 'diamond'];

    const drawable = [
      ...resources.filter(r => isVisible(r.pos)).map(r => ({ ...r, renderType: 'resource' as const })),
      ...droppedItems.filter(d => isVisible(d.pos)).map(d => ({ ...d, renderType: 'dropped' as const })),
      ...particles.filter(p => isVisible(p.pos)).map(p => ({ ...p, renderType: 'particle' as const })),
      ...animals.filter(a => isVisible(a.pos)).map(a => ({ ...a, renderType: 'animal' as const })),
      ...enemies.filter(e => isVisible(e.pos)).map(e => ({ ...e, renderType: 'enemy' as const })),
      { renderType: 'player' as const, x: player.pos.x, y: player.pos.y },
      ...(campfire && isVisible(campfire.pos) ? [{ ...campfire, renderType: 'campfire' as const }] : [])
    ].sort((a, b) => {
      const isGroundA = a.renderType === 'resource' && mineralsGround.includes((a as any).type);
      const isGroundB = b.renderType === 'resource' && mineralsGround.includes((b as any).type);
      
      if (isGroundA && !isGroundB) return -1;
      if (!isGroundA && isGroundB) return 1;

      const posA = 'pos' in a ? (a as any).pos : { x: (a as any).x, y: (a as any).y };
      const posB = 'pos' in b ? (b as any).pos : { x: (b as any).x, y: (b as any).y };
      return (posA.x + posA.y) - (posB.x + posB.y);
    });

    drawable.forEach(obj => {
      const pos = 'pos' in obj ? (obj as any).pos : { x: (obj as any).x, y: (obj as any).y };
      const isoBase = toIso(pos.x, pos.y);
      const heightOff = getTerrainHeight(pos.x, pos.y);
      const iso = { x: isoBase.x, y: isoBase.y + heightOff };

      if (obj.renderType === 'campfire') {
        const cf = obj as any;
        const base = { x: iso.x, y: iso.y };

        // 0. Shadow at the base
        const gradient = ctx.createRadialGradient(base.x, base.y, 0, base.x, base.y, 15);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, 15, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // 1. Logs (triangle shapes)
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(base.x - 5, base.y + 2);
        ctx.lineTo(base.x + 5, base.y + 2);
        ctx.lineTo(base.x, base.y - 8);
        ctx.closePath();
        ctx.fill();

        // 2. Rocks (textures from stone deposits)
        const stoneAssets = customAssets['stone'];
        const rockPositions = [[-9, 3], [9, 3], [0, 6], [-6, -4], [6, -4], [-4, 7], [4, 7], [-11, 0], [11, 0], [0, 9]];
        rockPositions.forEach(([rx, ry], index) => {
            if (stoneAssets && stoneAssets.length > 0) {
               const img = stoneAssets[(index + 12345) % stoneAssets.length];
               ctx.drawImage(img, base.x + rx - 3, base.y + ry - 3, 6, 6);
            }
        });

        // 3. Fire (multiple varied flame shapes, slower animation)
        const time = cf.animFrame * 2; // Slower speed
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FF8C00';
        
        // Draw varied flames
        for (let i = 0; i < 5; i++) {
            const phase = i * 1.25;
            const flickerX = Math.sin(time * 0.8 + phase) * 2;
            const flickerY = Math.sin(time * 1.5 + phase) * 1.5;
            const height = 10 + Math.cos(time * 0.5 + phase) * 4;
            
            // Color variation: red, orange, yellow
            const colorSpeed = time * 0.5 + phase;
            const r = 255;
            const g = Math.floor(100 + Math.sin(colorSpeed) * 100);
            const b = 0;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
            
            ctx.beginPath();
            ctx.moveTo(base.x, base.y - 3);
            ctx.lineTo(base.x - 4 - flickerX, base.y - 3 - height/2);
            ctx.lineTo(base.x, base.y - 12 - height + flickerY);
            ctx.lineTo(base.x + 4 + flickerX, base.y - 3 - height/2);
            ctx.closePath();
            ctx.fill();
        }
        ctx.shadowBlur = 0; // Reset

        // Particles
        cf.particles.forEach((p: any) => {
            const partIso = toIso(p.x, p.y);
            const partHeight = getTerrainHeight(p.x, p.y);
            const alpha = Math.max(0, p.life / 800);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = 5;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(partIso.x, partIso.y + partHeight, p.size * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
        });
      } else if (obj.renderType === 'resource') {
        const res = obj as any;
        const color = RESOURCE_COLORS[res.type as ResourceType];
        const isTarget = player.harvestingId === res.id;
        const isHovered = activeHoveredResource?.id === res.id;
        const scale = res.scale || 1;
        
        let assetArray: HTMLImageElement[] = [];                
        if (res.isStick) {
           assetArray = stickAssets;
        } else if (res.type === 'wood' && res.treeType === 'snowy') {
           assetArray = snowyTreeAssets;
        } else {
           assetArray = customAssets[res.type as ResourceType];
        }
        const seedHash = Math.floor(Math.abs((isoBase.x || 1) * 7.3 + (isoBase.y || 1) * 11.2));
        const resImage = assetArray && assetArray.length > 0 ? assetArray[seedHash % assetArray.length] : null;

        if (['coal', 'stone', 'iron', 'copper', 'gold', 'diamond', 'aluminum', 'silver'].includes(res.type as string)) {
            const visualMaxPebbles = 5; 
            const ratio = res.maxAmount > 0 ? res.amount / res.maxAmount : 0;
            const currentPebbles = !res.isDepleted && res.amount > 0 ? Math.ceil(ratio * visualMaxPebbles) : 0;
            const patchRadius = 0.4;
            
            let pseudoRandom = seedHash + res.variation * 1000;
            const nextPR = () => { pseudoRandom = (pseudoRandom * 1664525 + 1013904223) >>> 0; return pseudoRandom / 4294967296; };
            
            if (currentPebbles > 0) {
                // Gold, Diamond and Silver Glow Effect
                if (res.type === 'gold' || res.type === 'diamond' || res.type === 'silver') {
                    ctx.save();
                    const cy = isoBase.y + getTerrainHeight(res.pos.x, res.pos.y);
                    ctx.translate(isoBase.x, cy);
                    ctx.scale(1, 0.5); // Isometric squash
                    const glowRadius = TILE_SIZE * 0.4;
                    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
                    if (res.type === 'gold') {
                        grd.addColorStop(0, 'rgba(255, 220, 100, 0.25)');
                        grd.addColorStop(0.3, 'rgba(255, 200, 50, 0.08)');
                        grd.addColorStop(1, 'rgba(255, 180, 0, 0)');
                    } else if (res.type === 'diamond') {
                        grd.addColorStop(0, 'rgba(180, 240, 255, 0.25)');
                        grd.addColorStop(0.3, 'rgba(150, 220, 255, 0.08)');
                        grd.addColorStop(1, 'rgba(100, 200, 255, 0)');
                    } else if (res.type === 'silver') {
                        grd.addColorStop(0, 'rgba(230, 240, 255, 0.20)');
                        grd.addColorStop(0.3, 'rgba(200, 210, 240, 0.05)');
                        grd.addColorStop(1, 'rgba(150, 160, 200, 0)');
                    }
                    ctx.fillStyle = grd;
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.beginPath();
                    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Hover Target Highlight (Segmented Tile Outline)
                if (isHovered || isTarget) {
                    ctx.save();
                    ctx.setLineDash([4 / zoom, 4 / zoom]);
                    ctx.strokeStyle = 'rgba(255, 206, 0, 1)'; // #ffce00 with full opacity
                    ctx.lineWidth = 1 / zoom;
                    ctx.beginPath();
                    ctx.moveTo(isoBase.x, isoBase.y + getTerrainHeight(res.pos.x, res.pos.y) - TILE_SIZE / 4);
                    ctx.lineTo(isoBase.x + TILE_SIZE / 2, isoBase.y + getTerrainHeight(res.pos.x, res.pos.y));
                    ctx.lineTo(isoBase.x, isoBase.y + getTerrainHeight(res.pos.x, res.pos.y) + TILE_SIZE / 4);
                    ctx.lineTo(isoBase.x - TILE_SIZE / 2, isoBase.y + getTerrainHeight(res.pos.x, res.pos.y));
                    ctx.closePath();
                    ctx.stroke();
                    ctx.restore();
                }

                for (let i = 0; i < currentPebbles; i++) {
                    const rDist = Math.pow(nextPR(), 0.8) * patchRadius;
                    const angle = nextPR() * Math.PI * 2;
                    
                    const lx = Math.cos(angle) * rDist;
                    const ly = Math.sin(angle) * rDist;

                    const wx = res.pos.x + lx;
                    const wy = res.pos.y + ly;
                    
                    const pIsoBase = toIso(wx, wy);
                    const pHeight = getTerrainHeight(wx, wy);
                    const px = pIsoBase.x;
                    const py = pIsoBase.y + pHeight;

                    // Make pebbles bigger since there are fewer
                    const pScale = scale * (0.8 + nextPR() * 0.4); 
                    
                    const imgIndex = Math.floor(nextPR() * (assetArray?.length || 1));
                    const pImage = assetArray && assetArray.length > 0 ? assetArray[imgIndex] : null;

                    if (pImage) {
                        const aspect = pImage.width / pImage.height;
                        const ph = 8 * pScale;
                        const pw = ph * aspect;
                        ctx.drawImage(pImage, px - pw/2, py - ph*0.8, pw, ph);
                    } else {
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        const rx = 4 * pScale;
                        const ry = 2.5 * pScale;
                        const sides = 4 + Math.floor(nextPR() * 3);
                        const startAngle = nextPR() * Math.PI;
                        for (let s = 0; s < sides; s++) {
                            const tAngle = startAngle + (s / sides) * Math.PI * 2;
                            const rMod = 0.7 + nextPR() * 0.5;
                            const bx = px + Math.cos(tAngle) * rx * rMod;
                            const by = py + Math.sin(tAngle) * ry * rMod;
                            if (s === 0) ctx.moveTo(bx, by);
                            else ctx.lineTo(bx, by);
                        }
                        ctx.closePath();
                        ctx.fill();
                        
                        // Small highlight
                        ctx.fillStyle = 'rgba(255,255,255,0.15)';
                        ctx.beginPath();
                        ctx.ellipse(px - rx*0.2, py - ry*0.2, rx*0.3, ry*0.15, -0.3, 0, Math.PI*2);
                        ctx.fill();
                    }
                }
            }
        } else {
            ctx.beginPath();
            let shadowW = 8;
            let shadowH = 4;
            let shadowOffsetY = 0;
            
            // Pre-calculate target dimensions for better sizing
            let targetHeight = res.isStick ? 20 * scale : 120 * scale;
            if (!res.isStick && res.type === 'stone') targetHeight = 60 * scale;
            if (!res.isStick && (res.type === 'fiber' || res.type === 'meat')) targetHeight = 50 * scale;
            const imgAspect = resImage ? resImage.width / resImage.height : 1;
            const targetWidth = targetHeight * imgAspect;

            if (res.isStick && !res.isDepleted) {
                shadowW = 0;
                shadowH = 0;
                shadowOffsetY = 0;
            } else if (res.type === 'wood' && !res.isDepleted) {
                shadowW = 32 * scale;
                shadowH = 16 * scale;
                shadowOffsetY = 4 * scale; 
            } else if (resImage && !res.isDepleted) {
                shadowW = 20 * scale;
                shadowH = 10 * scale;
            }
            ctx.ellipse(iso.x, iso.y + shadowOffsetY, shadowW, shadowH, (res.isStick ? -Math.PI / 4 : 0), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fill();

            // Hover Target Highlight (Segmented Tile Outline)
            if (isHovered || isTarget) {
                ctx.save();
                ctx.setLineDash([4 / zoom, 4 / zoom]);
                ctx.strokeStyle = 'rgba(255, 206, 0, 1)';
                ctx.lineWidth = 1 / zoom;
                ctx.beginPath();
                
                const boxW = res.isStick ? targetWidth : TILE_SIZE / 2;
                const boxH = res.isStick ? targetHeight / 2 : TILE_SIZE / 4;
                
                ctx.moveTo(iso.x, iso.y - boxH);
                ctx.lineTo(iso.x + boxW, iso.y);
                ctx.lineTo(iso.x, iso.y + boxH);
                ctx.lineTo(iso.x - boxW, iso.y);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1/zoom;

            if (resImage && !res.isDepleted) {
            // Draw custom image for any resource
            ctx.drawImage(
              resImage, 
              iso.x - targetWidth / 2, 
              iso.y - targetHeight, 
              targetWidth, 
              targetHeight
            );
        } else if (res.type === 'wood') {
          if (res.isDepleted && choppedWoodAssets.length > 0) {
             const choppedImg = choppedWoodAssets[seedHash % choppedWoodAssets.length];
             const imgAspect = choppedImg.width / choppedImg.height;
             const targetHeight = 15 * scale; 
             const targetWidth = targetHeight * imgAspect;
             
             ctx.drawImage(
               choppedImg, 
               iso.x - targetWidth / 2, 
               iso.y - targetHeight + 4 * scale,
               targetWidth, 
               targetHeight
             );
          } else {
            const isShaking = res.id === player.harvestingId;
            const shakeOffset = isShaking ? Math.sin(Date.now() * 0.1) * 2 : 0;
            ctx.save();
            ctx.translate(shakeOffset, 0);

            // Depleted state or fallback
            const treeScale = scale * 0.7; // Make trees smaller in general
            const varVal = res.variation || 0.5;
            const trunkH = 8 * treeScale;

            if (res.treeType === 'snowy' && snowyTreeAssets.length > 0) {
               const treeImg = snowyTreeAssets[seedHash % snowyTreeAssets.length];
               const imgAspect = treeImg.width / treeImg.height;
               const targetHeight = 35 * scale;
               const targetWidth = targetHeight * imgAspect;
               ctx.drawImage(treeImg, iso.x - targetWidth / 2, iso.y - targetHeight + 7 * scale, targetWidth, targetHeight);
            } else {
                // Trunk
                ctx.fillStyle = res.treeType === 'snowy' ? '#A0A0A0' : '#4a2c2a';
                ctx.fillRect(iso.x - 3 * treeScale, iso.y - trunkH, 6 * treeScale, trunkH);
                
                if (!res.isDepleted) {
                  const baseColor = `hsl(${100 + varVal * 40}, ${30 + varVal * 20}%, ${20 + varVal * 15}%)`;
              const midColor = `hsl(${100 + varVal * 40}, ${35 + varVal * 20}%, ${25 + varVal * 15}%)`;
              const topColor = `hsl(${100 + varVal * 40}, ${40 + varVal * 20}%, ${30 + varVal * 15}%)`;

              ctx.fillStyle = baseColor;
              // Bottom layer
              ctx.beginPath();
              ctx.arc(iso.x, iso.y - trunkH - 4 * treeScale, 12 * treeScale, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              
              // Middle layer
              ctx.fillStyle = midColor;
              ctx.beginPath();
              ctx.arc(iso.x - 4 * treeScale, iso.y - trunkH - 12 * treeScale, 10 * treeScale, 0, Math.PI * 2);
              ctx.arc(iso.x + 4 * treeScale, iso.y - trunkH - 12 * treeScale, 10 * treeScale, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              
              // Top layer
              ctx.fillStyle = topColor;
              ctx.beginPath();
              ctx.arc(iso.x, iso.y - trunkH - 20 * treeScale, 9 * treeScale, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            }
            ctx.restore();
          }
        } else {
          // Rocks/Ores - Scattered Pebbles
          const seed = parseInt(res.id.slice(0, 5) || "0", 36) || 0;
          const pebbleCount = 6 + (seed % 6);
          ctx.fillStyle = color;
          
          for (let i = 0; i < pebbleCount; i++) {
            const angle = (seed * i * 1.5) % (Math.PI * 2);
            const dist = ((seed * (i + 1) * 2.3) % 1) * 8;
            const px = Math.cos(angle) * dist;
            const py = Math.sin(angle) * dist;
            const pSize = 1.5 + ((seed * i) % 3);
            
            ctx.beginPath();
            ctx.ellipse(iso.x + px, iso.y + py, pSize, pSize/2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
      } // CLOSE else from `if (res.type === 'coal')` branch
    } else if (obj.renderType === 'particle') {
        const p = obj as Particle;
        ctx.save();
        ctx.translate(iso.x, iso.y);
        ctx.rotate(p.rotation);
        if (p.type === 'leaf') {
          ctx.fillStyle = '#4a7a32';
          ctx.beginPath();
          ctx.ellipse(0, 0, 4, 1.8, 0, 0, Math.PI * 2); // Slightly bigger
          ctx.fill();
        } else if (p.type === 'fish') {
          const jump = Math.sin((p.life / p.maxLife) * Math.PI) * 6; // Vertical jump
          ctx.translate(0, -jump);
          ctx.fillStyle = '#a0c0f0';
          ctx.beginPath();
          ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-4, 0);
          ctx.lineTo(-6, -2);
          ctx.lineTo(-6, 2);
          ctx.fill();
        } else if (p.type === 'gold_sparkle') {
          const alpha = p.life / p.maxLife;
          ctx.fillStyle = `rgba(255, 220, 50, ${alpha})`;
          ctx.beginPath();
          ctx.arc(0, 0, 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'diamond_sparkle') {
          const alpha = p.life / p.maxLife;
          ctx.fillStyle = `rgba(180, 240, 255, ${alpha})`;
          ctx.beginPath();
          ctx.arc(0, 0, 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'ripple') {
          const progress = 1 - (p.life / p.maxLife);
          ctx.strokeStyle = `rgba(200, 230, 255, ${0.4 * (1 - progress)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(0, 0, 2 + progress * 6, 1 + progress * 3, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.type === 'footprint') {
          ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          // Capsule shape for shoe footprint
          ctx.roundRect(-4, -1.5, 8, 3, 1.5);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
        ctx.restore();
      } else if (obj.renderType === 'dropped') {
        const item = obj as DroppedItem;
        ctx.fillStyle = RESOURCE_COLORS[item.type];
        ctx.fillRect(iso.x - 4, iso.y - 4, 8, 8);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(iso.x - 4, iso.y - 4, 8, 8);
      } else if (obj.renderType === 'animal') {
        const animal = obj as Animal;
        const scale = animal.scale || 1.0;
        
        ctx.save();
        ctx.translate(iso.x, iso.y);
        
        // Shadow (especially for butterflies)
        if (animal.type === 'firefly' || animal.type === 'butterfly' || animal.z > 0) {
           ctx.fillStyle = 'rgba(0,0,0,0.15)';
           ctx.beginPath();
           const shW = animal.type === 'firefly' ? 2 : 6;
           const shH = animal.type === 'firefly' ? 1 : 3;
           ctx.ellipse(0, 0, shW * scale, shH * scale, 0, 0, Math.PI * 2);
           ctx.fill();
        }
        
        ctx.translate(0, -animal.z * 10);
        if (animal.facingLeft) ctx.scale(-1, 1);
        
        const bob = animal.state === 'moving' && animal.z === 0 ? Math.sin(Date.now() * 0.02) * 2 : 0;
        ctx.translate(0, -bob);
        
        if (animal.type === 'firefly') {
           const time = Date.now();
           const flicker = 0.5 + 0.5 * Math.sin(time * 0.002 + animal.pos.y * 10); // Smooth 0 to 1
           
           ctx.globalCompositeOperation = 'lighter';
           
           // Core
           ctx.fillStyle = animal.color || '#aaff00';
           ctx.globalAlpha = 0.5 + flicker * 0.5; // never entirely dim
           ctx.beginPath();
           ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
           ctx.fill();
           
           // Glow
           const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
           grd.addColorStop(0, animal.color || '#aaff00');
           grd.addColorStop(1, 'rgba(0,0,0,0)');
           ctx.fillStyle = grd;
           ctx.globalAlpha = flicker * 0.9;
           ctx.beginPath();
           ctx.arc(0, 0, 8, 0, Math.PI * 2);
           ctx.fill();

           ctx.globalAlpha = 1;
           ctx.globalCompositeOperation = 'source-over';
        } else if (animal.type === 'butterfly') {
           const isFlying = animal.z > 0 || animal.state === 'moving';
           const wingPhase = isFlying ? Math.sin(Date.now() * 0.03) : Math.sin(Date.now() * 0.002);
           const wPhaseAbs = Math.max(0.1, Math.abs(wingPhase));
           
           // Right Wing
           ctx.fillStyle = '#ff9900';
           ctx.beginPath();
           ctx.ellipse(2.5 * scale, -2 * scale * wPhaseAbs, 3 * scale, 4 * scale * wPhaseAbs, 0, 0, Math.PI * 2);
           ctx.fill();
           
           // Left Wing
           ctx.fillStyle = '#ff6600';
           ctx.beginPath();
           ctx.ellipse(-2.5 * scale, -2 * scale * wPhaseAbs, 3 * scale, 4 * scale * wPhaseAbs, 0, 0, Math.PI * 2);
           ctx.fill();
           
           // Butterfly body (tiny)
           ctx.fillStyle = '#333';
           ctx.beginPath();
           ctx.ellipse(0, 0, 1 * scale, 3 * scale, 0, 0, Math.PI * 2);
           ctx.fill();
        }
        ctx.restore();
      } else if (obj.renderType === 'enemy') {
        drawEnemy(ctx, obj as any, iso.x, iso.y, zoom);
      } else {
        // Player
        const bob = player.isMoving ? Math.abs(Math.cos(player.animFrame * PLAYER_WALK_FREQ)) * 2 : Math.sin(player.animFrame) * 1.5;
        const isHarvesting = !!player.harvestingId;
        const targetResourceRender = player.harvestingId ? resources.find(r => r.id === player.harvestingId) : null;
        const selectedToolRender = player.hotbar[player.selectedHotbarIndex];
        const isAxeSelected = selectedToolRender && (selectedToolRender.type === 'axe_wood' || selectedToolRender.type === 'super_axe');
        const isSuperAxe = selectedToolRender && selectedToolRender.type === 'super_axe';
        const isPickaxeSelected = selectedToolRender && (selectedToolRender.type === 'pickaxe_wood' || selectedToolRender.type === 'super_pickaxe');
        const isSuperPickaxe = selectedToolRender && selectedToolRender.type === 'super_pickaxe';
        const isChoppingWood = isHarvesting && targetResourceRender?.type === 'wood' && isAxeSelected;
        const isMining = isHarvesting && targetResourceRender?.type !== 'wood' && isPickaxeSelected;

        const isBlinking = Math.sin(player.animFrame * 0.2) > 0.95;
        const isYawning = player.idleTime > 60000 && (player.idleTime % 20000) > 17500;
        const yawnArmRaise = isYawning ? 6 : 0;

        // Shadow
        ctx.beginPath();
        ctx.ellipse(iso.x, iso.y + 7, 8, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Enhancing player look
        const isWaving = !player.isMoving && !isHarvesting && (player.idleTime % 15000 > 5000 && player.idleTime % 15000 < 6500) && player.dir.includes('s');
        const wavePhase = isWaving ? Math.sin(player.idleTime * 0.015) * 5 : 0;
        const armWave = player.isMoving ? Math.sin(player.animFrame * PLAYER_WALK_FREQ) * 3 : (isHarvesting ? Math.sin(player.animFrame * 5) * 5 : 0);
          
        // Backpack (draw behind if facing North, front if South... wait, Isometric: Backpack is behind body)
        // Let's decide drawing order based on direction.
        const isFacingBack = player.dir.includes('n');
        const isFacingRight = player.dir.includes('e');
        const isFacingLeft = player.dir.includes('w');

        // Backpack logic first ( behind body when facing front/side )
        if (!isFacingBack) {
          ctx.fillStyle = '#6b4c2a';
          ctx.strokeStyle = '#3e2c18';
          ctx.lineWidth = 1.5 / zoom;
          ctx.beginPath();
          if (isFacingLeft) {
             ctx.roundRect(iso.x + 1.5, iso.y - 12 - bob, 6.5, 12, 3);
          } else if (isFacingRight) {
             ctx.roundRect(iso.x - 8, iso.y - 12 - bob, 6.5, 12, 3);
          }
          if (isFacingLeft || isFacingRight) {
             ctx.fill();
             ctx.stroke();
             // Side pocket
             ctx.fillStyle = '#8b5a2b';
             ctx.beginPath();
             ctx.roundRect(iso.x + (isFacingLeft ? 3.5 : -7.5), iso.y - 8 - bob, 3, 4, 1);
             ctx.fill();
             ctx.stroke();
          }
        }

        const drawArm = (isRightSide: boolean) => {
           const armIsWaving = isWaving && ((isRightSide && !isFacingLeft) || (!isRightSide && isFacingLeft));
           const swingPhase = player.isMoving ? player.animFrame * PLAYER_WALK_FREQ + (isRightSide ? 0 : Math.PI) : 0;
           let swing = player.isMoving ? Math.sin(swingPhase) * 3.5 : (isHarvesting && !isChoppingWood ? Math.sin(player.animFrame * 5 + (isRightSide ? Math.PI : 0)) * 3 : 0);
             
           // Shoulder
           let shoulderX = iso.x + (isRightSide ? 4.5 : -4.5);
           let shoulderY = iso.y - 11 - bob;
             
           // Base Hand Position
           let handX = shoulderX;
           let handY = shoulderY + 7; 
             
           let axeAngle = 0;
           let drawAxe = false;
           let pickaxeAngle = 0;
           let drawPickaxe = false;

           if (isYawning) {
              handY -= yawnArmRaise;
              handX += isRightSide ? 2.5 : -2.5;
           } else if (armIsWaving) {
              handX += isRightSide ? 4.5 : -4.5;
              handY -= 4 - wavePhase; 
           } else if (isChoppingWood && isRightSide) {
              drawAxe = true;
              const chopSpeed = isSuperAxe ? 1.2 : 2.0; 
              const cTime = (player.animFrame * chopSpeed) % (Math.PI * 2);
              // Realistic chop: fast hit, slow raise
              // Using a skewed sine wave to create a snap effect
              const skewedPhase = cTime + Math.sin(cTime) * 0.8;
              
              handX += Math.cos(skewedPhase) * 7 * (isFacingLeft ? -1 : 1);
              handY += Math.sin(skewedPhase) * 7 - 2;
              axeAngle = (skewedPhase * 1.3) + (isFacingLeft ? Math.PI : 0); 
           } else if (isMining && isRightSide) {
              drawPickaxe = true;
              const mineSpeed = isSuperPickaxe ? 1.5 : 2.5;
              const cTime = (player.animFrame * mineSpeed) % (Math.PI * 2);
              const skewedPhase = cTime + Math.sin(cTime) * 0.8;
              
              handX += Math.cos(skewedPhase) * 6 * (isFacingLeft ? -1 : 1);
              handY += Math.sin(skewedPhase) * 6 - 2;
              pickaxeAngle = (skewedPhase * 1.5) + (isFacingLeft ? Math.PI : 0); 
           } else {
              if (isFacingLeft || isFacingRight) {
                 const viewDir = isFacingRight ? 1 : -1;
                 handX += swing * viewDir;
                 handY -= Math.abs(swing) * 0.3; 
              } else if (!isFacingBack) {
                 handX += swing * (isRightSide ? 0.3 : -0.3); 
                 handY += swing * 0.8; 
              } else {
                 handX += swing * (isRightSide ? 0.3 : -0.3);
                 handY += swing * 0.8;
              }
           }

           // Sleeve
           ctx.strokeStyle = '#ddccbb';
           ctx.lineWidth = 2.5; 
           ctx.lineCap = 'round';
           ctx.beginPath();
           ctx.moveTo(shoulderX, shoulderY);
           ctx.lineTo(handX, handY);
           ctx.stroke();

           // Draw Axe or Pickaxe
           if (drawAxe && isRightSide) {
              ctx.save();
              ctx.translate(handX, handY);
              ctx.rotate(axeAngle);
              
              if (isSuperAxe && axeImage) {
                 // Draw the super axe image
                 ctx.translate(0, -6); // adjust pivot
                 ctx.rotate(-Math.PI / 4); // adjust angle if needed for the sprite
                 ctx.drawImage(axeImage, -8, -8, 16, 24);
              } else {
                  // Handle
                  ctx.fillStyle = '#654321';
                  ctx.fillRect(-1.5, -8, 3, 16);
                  
                  // Axe Head
                  ctx.fillStyle = isSuperAxe ? '#ffcc00' : '#888888';
                  if (isSuperAxe) {
                      ctx.beginPath();
                      ctx.moveTo(1.5, -6);
                      ctx.lineTo(9, -9);
                      ctx.lineTo(9, -1);
                      ctx.lineTo(1.5, -4);
                      ctx.fill();
                      
                      ctx.fillStyle = '#ff3300';
                      ctx.beginPath();
                      ctx.arc(3.5, -5, 1.5, 0, Math.PI*2);
                      ctx.fill();
                  } else {
                      ctx.beginPath();
                      ctx.moveTo(1.5, -5);
                      ctx.lineTo(7, -7);
                      ctx.lineTo(7, -1);
                      ctx.lineTo(1.5, -3);
                      ctx.fill();
                  }
              }
              ctx.restore();
           } else if (drawPickaxe && isRightSide) {
              ctx.save();
              ctx.translate(handX, handY);
              ctx.rotate(pickaxeAngle);
              
              if (isSuperPickaxe && pickaxeImage) {
                 ctx.translate(0, -6); 
                 ctx.rotate(-Math.PI / 4); 
                 ctx.drawImage(pickaxeImage, -8, -8, 16, 24);
              } else {
                  // Handle
                  ctx.fillStyle = '#654321';
                  ctx.fillRect(-1.5, -8, 3, 16);
                  
                  // Head (curve)
                  ctx.fillStyle = '#94a3b8'; // iron color
                  ctx.beginPath();
                  ctx.moveTo(-6, -6);
                  ctx.quadraticCurveTo(0, -10, 6, -6);
                  ctx.lineTo(0, -4);
                  ctx.fill();
              }
              ctx.restore();
           }

           // Hand
           ctx.fillStyle = '#eed2b6';
           ctx.beginPath();
           const angle = Math.atan2(handY - shoulderY, handX - shoulderX);
           const hx = handX + Math.cos(angle) * 1.5;
           const hy = handY + Math.sin(angle) * 1.5;
           ctx.arc(hx, hy, 1.3, 0, Math.PI * 2); 
           ctx.fill();
        };

        // Draw arms behind the body
        if (isFacingBack) {
           drawArm(false);
           drawArm(true);
        } else if (isFacingRight) {
           drawArm(false); // left arm behind
        } else if (isFacingLeft) {
           drawArm(true); // right arm behind
        }
          
        // Body (Shirt & Overalls)
        ctx.fillStyle = '#eed2b6'; // Skin/shirt neck
        ctx.beginPath();
        ctx.roundRect(iso.x - 4.5, iso.y - 13 - bob, 9, 7, 2.5);
        ctx.fill();
          
        // T-Shirt 
        ctx.fillStyle = '#ddccbb'; // Light colored shirt
        ctx.beginPath();
        ctx.roundRect(iso.x - 5, iso.y - 12 - bob, 10, 6, 2);
        ctx.fill();

        // Overalls
        ctx.fillStyle = '#2b5a84'; // Denim blue
        ctx.beginPath();
        ctx.roundRect(iso.x - 4.5, iso.y - 8 - bob, 9, 10, 2.5);
        ctx.fill();
        ctx.strokeStyle = '#1a3752';
        ctx.lineWidth = 1/zoom;
        ctx.stroke();
          
        if (!isFacingBack) {
           // Overall buttons & pocket
           ctx.fillStyle = '#ffaa00'; // Gold buttons
           ctx.beginPath();
           ctx.arc(iso.x - 2.5, iso.y - 6 - bob, 1, 0, Math.PI*2);
           ctx.arc(iso.x + 2.5, iso.y - 6 - bob, 1, 0, Math.PI*2);
           ctx.fill();
             
           // Front pocket
           ctx.fillStyle = '#224a6d';
           ctx.fillRect(iso.x - 2, iso.y - 4 - bob, 4, 3.5);
        }

        // Draw arms in front of the body
        if (!isFacingBack && !isFacingRight && !isFacingLeft) {
           drawArm(false);
           drawArm(true);
        } else if (isFacingRight) {
           drawArm(true); // right arm in front
        } else if (isFacingLeft) {
           drawArm(false); // left arm in front
        }

        if (isFacingBack) {
          // Draw Backpack over body
          ctx.fillStyle = '#8b5a2b';
          ctx.strokeStyle = '#4a2f1d';
          ctx.lineWidth = 1.5/zoom;
          ctx.beginPath();
          ctx.roundRect(iso.x - 5, iso.y - 13 - bob, 10, 11, 2.5);
          ctx.fill();
          ctx.stroke();
          // Main flap
          ctx.fillStyle = '#6b4c2a';
          ctx.beginPath();
          ctx.roundRect(iso.x - 4, iso.y - 13 - bob, 8, 5, 2);
          ctx.fill();
          ctx.stroke();
          // Bedroll top
          ctx.fillStyle = '#4a7a32';
          ctx.beginPath();
          ctx.roundRect(iso.x - 6, iso.y - 16 - bob, 12, 4.5, 2);
          ctx.fill();
          ctx.stroke();
        } else if (!isFacingRight && !isFacingLeft) {
           // Facing S - Add Straps
           ctx.fillStyle = '#8b5a2b';
           ctx.fillRect(iso.x - 3, iso.y - 12 - bob, 1.5, 7);
           ctx.fillRect(iso.x + 1.5, iso.y - 12 - bob, 1.5, 7);
        }

        // Head Base
        ctx.fillStyle = '#eed2b6'; // Skin
        ctx.beginPath();
        // A bit wider and rounder head
        ctx.roundRect(iso.x - 5.5, iso.y - 24 - bob, 11, 10.5, 4.5);
        ctx.fill();
        ctx.strokeStyle = '#c6a88b';
        ctx.lineWidth = 0.5 / zoom;
        ctx.stroke();
          
        if (!isFacingBack) {
           // Ears
           ctx.fillStyle = '#eed2b6';
           ctx.beginPath();
           if (isFacingRight) {
              ctx.ellipse(iso.x - 5.5, iso.y - 18 - bob, 1.5, 2, 0, 0, Math.PI*2);
           } else if (isFacingLeft) {
              ctx.ellipse(iso.x + 5.5, iso.y - 18 - bob, 1.5, 2, 0, 0, Math.PI*2);
           } else {
              ctx.ellipse(iso.x - 6, iso.y - 18 - bob, 1.5, 2.5, 0, 0, Math.PI*2);
              ctx.ellipse(iso.x + 6, iso.y - 18 - bob, 1.5, 2.5, 0, 0, Math.PI*2);
           }
           ctx.fill();
           ctx.stroke();
        }

        // Fresh Haircut (instead of cap)
        ctx.fillStyle = '#5a3f2b'; // Dark brown hair
        ctx.beginPath();
        // Main hair block
        ctx.roundRect(iso.x - 6, iso.y - 25.5 - bob, 12, 4.5, 3);
        ctx.fill();
        
        if (!isFacingBack) {
           // Front bangs
           ctx.beginPath();
           ctx.arc(iso.x - 3, iso.y - 21.5 - bob, 2.5, 0, Math.PI);
           ctx.arc(iso.x + 1, iso.y - 21.5 - bob, 2, 0, Math.PI);
           ctx.arc(iso.x + 4, iso.y - 22.5 - bob, 1.5, 0, Math.PI);
           ctx.fill();
        } else {
           // Back of head hair
           ctx.beginPath();
           ctx.roundRect(iso.x - 6, iso.y - 23 - bob, 12, 5, 2);
           ctx.fill();
        }

        if (!isFacingBack) {
          // Eyes
          let eyeX = 0;
          if (isFacingRight) eyeX = 2;
          if (isFacingLeft) eyeX = -2;

          if (isYawning) { // Keep yawn animation simple for eyes
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.2 / zoom;
            ctx.beginPath();
            ctx.moveTo(iso.x + eyeX - 3.5, iso.y - 18 - bob);
            ctx.lineTo(iso.x + eyeX - 1, iso.y - 17.5 - bob);
            ctx.moveTo(iso.x + eyeX + 1, iso.y - 17.5 - bob);
            ctx.lineTo(iso.x + eyeX + 3.5, iso.y - 18 - bob);
            ctx.stroke();
          } else {
            // Whites of eyes (round)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(iso.x + eyeX - 1.8, iso.y - 18.5 - bob, 1.8, 0, Math.PI * 2);
            ctx.arc(iso.x + eyeX + 1.8, iso.y - 18.5 - bob, 1.8, 0, Math.PI * 2);
            ctx.fill();

            // Pupils (small)
            ctx.fillStyle = '#111111';
            let pupilOffset = player.isMoving ? (Math.sin(player.animFrame * PLAYER_WALK_FREQ) > 0 ? 0.4 : 0) : 0;
            if (isFacingRight) pupilOffset += 0.8;
            if (isFacingLeft) pupilOffset -= 0.8;

            ctx.beginPath();
            ctx.arc(iso.x + eyeX - 1.8 + pupilOffset * 0.5, iso.y - 18.2 - bob, 0.7, 0, Math.PI * 2);
            ctx.arc(iso.x + eyeX + 1.8 + pupilOffset * 0.5, iso.y - 18.2 - bob, 0.7, 0, Math.PI * 2);
            ctx.fill();

            // Blinking
            if (isBlinking) {
               ctx.fillStyle = '#eed2b6'; // Skin color
               ctx.beginPath();
               // Draw completely over eye to blink
               ctx.arc(iso.x + eyeX - 1.8, iso.y - 18.5 - bob, 1.9, 0, Math.PI * 2);
               ctx.arc(iso.x + eyeX + 1.8, iso.y - 18.5 - bob, 1.9, 0, Math.PI * 2);
               ctx.fill();
            }
          }

          // Eyebrows
          ctx.strokeStyle = '#4a2f1d'; // Darker brown
          ctx.lineWidth = 1;
          ctx.lineCap = 'round';
          ctx.beginPath();
          // Relaxed eyebrows
          let browY = isYawning ? -21.5 : -22;
          ctx.moveTo(iso.x + eyeX - 3.2, iso.y + browY - bob);
          ctx.lineTo(iso.x + eyeX - 0.8, iso.y + browY - bob);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(iso.x + eyeX + 0.8, iso.y + browY - bob);
          ctx.lineTo(iso.x + eyeX + 3.2, iso.y + browY - bob);
          ctx.stroke();
          
          // Mouth removed as requested
          // Nose removed as requested
        }

        // Legs
        const drawLeg = (sideOfs: number, phaseOffset: number) => {
          const phase = player.isMoving ? player.animFrame * PLAYER_WALK_FREQ + phaseOffset : 0;
          const swing = player.isMoving ? Math.sin(phase) : 0;
          const lift = player.isMoving ? Math.max(0, Math.cos(phase)) * 4.5 : 0;
            
          const hipX = iso.x + sideOfs;
          const hipY = iso.y + 1; // Start higher up under overalls
            
          let footX = hipX;
          let footY = hipY + 8; // Default leg length
            
          if (isFacingLeft || isFacingRight) {
             const dir = isFacingRight ? 1 : -1;
             footX += swing * 4.5 * dir; 
             footY -= lift; 
          } else if (!isFacingBack) {
             footY += swing * 2.5 - lift;
          } else {
             footY += swing * 1.5 - lift;
          }
            
          let kneeX = (hipX + footX) / 2;
          let kneeY = (hipY + footY) / 2;
            
          if (lift > 0) {
             if (isFacingLeft || isFacingRight) {
                const dir = isFacingRight ? 1 : -1;
                kneeX += (lift * 0.4) * dir;
                kneeY -= lift * 0.1;
             } else if (!isFacingBack) {
                kneeX += (sideOfs > 0 ? 1 : -1) * (lift * 0.3);
                kneeY -= lift * 0.2;
             } else {
                kneeX += (sideOfs > 0 ? 1 : -1) * (lift * 0.3);
             }
          }
            
          ctx.strokeStyle = '#1a3752';
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
            
          ctx.beginPath();
          ctx.moveTo(hipX + 1.5, hipY);
          ctx.lineTo(kneeX + 1.5, kneeY);
          ctx.lineTo(footX + 1.5, footY);
          ctx.stroke();
            
          // Draw Shoe
          ctx.fillStyle = '#3e2c18';
          ctx.beginPath();
          if (isFacingLeft) {
              ctx.roundRect(footX, footY - 1, 4.5, 3.5, 1.5);
          } else if (isFacingRight) {
              ctx.roundRect(footX - 1.5, footY - 1, 4.5, 3.5, 1.5);
          } else {
              ctx.roundRect(footX - 0.5, footY - 1, 4.5, 3.5, 1.5);
          }
          ctx.fill();
        };

        drawLeg(-3.5, 0); // Left leg
        drawLeg(0.5, Math.PI); // Right leg

        // Progress bar for harvest
        if (isHarvesting) {
          const barW = 24;
          const barH = 2.5;
          const barX = iso.x - barW/2;
          const barY = iso.y - 28;
          
          // Background (Rounded Simulation)
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath();
          ctx.roundRect(barX, barY, barW, barH, 1.25);
          ctx.fill();
          
          // Fill (Rounded Simulation)
          if (player.harvestProgress > 0) {
            ctx.fillStyle = '#ffce00';
            ctx.beginPath();
            ctx.roundRect(barX, barY, (player.harvestProgress / 100) * barW, barH, 1.25);
            ctx.fill();
          }
        }

        // Player overhead health bar
        if (player.hp < player.maxHp) {
          const hw = 12;
          const hh = 1.5;
          const hx = iso.x - hw/2;
          const hy = iso.y - 30;
          
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(hx, hy, hw, hh);
          
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(hx, hy, (player.hp / player.maxHp) * hw, hh);
        }
      }
    });

    // Weather & Cloud Shadows
    const env = environmentRef.current;

    const drawCloudsInternal = (ctx: CanvasRenderingContext2D, clouds: Cloud[], isSky: boolean) => {
        const cloudSize = 80;

        clouds.forEach(cloud => {
           const cx = cloud.x;
           const cy = cloud.y;
           const scale = cloud.size / 80;
           const seed = parseFloat(cloud.id);
           
    // Cloud Volumetric Effect: Simplified single layer
    const alpha = isSky ? 0.15 : 0.03;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    
    ctx.beginPath();
    
    // Isometric cloud block builder
    const drawBlock = (x: number, y: number, s: number) => {
        ctx.moveTo(x, y - s/2);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s/2);
        ctx.lineTo(x - s, y);
    }

    const shapeVariation = Math.sin(seed) * 0.5;
    drawBlock(cx, cy, cloudSize * scale * (1 + shapeVariation * 0.5));
    drawBlock(cx + cloudSize*(0.4 + Math.sin(seed)*0.3) * scale, cy - cloudSize*0.2 * scale, cloudSize*(0.5 + Math.cos(seed)*0.4) * scale);
    drawBlock(cx - cloudSize*(0.3 + Math.cos(seed)*0.3) * scale, cy + cloudSize*0.1 * scale, cloudSize*(0.4 + Math.sin(seed)*0.3) * scale);
    drawBlock(cx + cloudSize*(0.2) * scale, cy + cloudSize*(0.2) * scale, cloudSize*0.3 * scale);
    
    ctx.closePath();
    ctx.fill();
        });
    };
    
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; 
    ctx.save();
    // Parallax effect removed to keep clouds in world coordinates
    drawCloudsInternal(ctx, clouds, false);
    ctx.restore();
    ctx.restore();

    // Draw Sky Clouds if zoomed out (último nivel de zoom out)
    if (zoom <= 0.6) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.save();
        // Parallax effect removed to keep clouds in world coordinates
        drawCloudsInternal(ctx, clouds, true);
        ctx.restore();
    }

    // Day/Night Filter (Screen Space)
    let darkenAlpha = 0;
    if (env.timeOfDay < 4000) darkenAlpha = 0.6;
    else if (env.timeOfDay < 8000) darkenAlpha = 0.6 - ((env.timeOfDay - 4000) / 4000) * 0.6;
    else if (env.timeOfDay > 18000) darkenAlpha = ((env.timeOfDay - 18000) / 4000) * 0.6;
    if (env.timeOfDay >= 22000) darkenAlpha = 0.6;

    if (darkenAlpha > 0) {
      // Create a gradient for the night sky effect
      const sunsetAlpha = (env.timeOfDay > 18000 && env.timeOfDay < 20000) ? Math.sin(((env.timeOfDay - 18000) / 2000) * Math.PI) * 0.4 : 0;
      const dawnAlpha = (env.timeOfDay > 4000 && env.timeOfDay < 6000) ? Math.sin(((env.timeOfDay - 4000) / 2000) * Math.PI) * 0.3 : 0;
      
      // Just dark overlay
      ctx.fillStyle = `rgba(10, 15, 30, ${Math.min(0.6, darkenAlpha)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Orange/Pink tint for sunset/dawn
      if (sunsetAlpha > 0 || dawnAlpha > 0) {
        ctx.fillStyle = `rgba(255, 120, 50, ${sunsetAlpha || dawnAlpha})`;
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    
    // Rain (Screen Space)
    if (env.isRaining) {
      const t = Date.now();
      
      // 1. Splash effects on ground
      ctx.strokeStyle = 'rgba(150, 200, 255, 0.35)'; // More visible
      ctx.lineWidth = 0.8;
      
      ctx.beginPath();
      for(let i = 0; i < 60; i++) {
        const splashX = (i * 873) % canvas.width;
        const splashY = (i * 534) % canvas.height;
        const phase = (t + i * 213) % 1000; // loop time
        
        if (phase < 150) {
           const size = (phase / 150) * 3;
           // Draw little expanding ripples
           ctx.moveTo(splashX + size, splashY);
           ctx.ellipse(splashX, splashY, size, size * 0.3, 0, 0, Math.PI * 2);
        }
      }
      ctx.stroke();

      // 2. Falling Rain
      ctx.strokeStyle = 'rgba(180, 210, 255, 0.45)'; // More visible rain color
      ctx.lineWidth = 1; // Thicker
      
      const rainTime = t * 1.5;      
      const dropLen = 12;
      const slant = 3; // Moves left by 3 for every 12 down
      
      ctx.beginPath();
      for(let i = 0; i < 200; i++) {
        const speedScale = 0.8 + (i % 3) * 0.2;
        const progress = rainTime * speedScale;
        
        const startX = (i * 123);
        const startY = (i * 321);

        const progressX = progress * (slant / dropLen);
        const rx = ((startX - progressX) % (canvas.width + 100) + (canvas.width + 100)) % (canvas.width + 100) - 50;
        const ry = ((startY + progress) % canvas.height + canvas.height) % canvas.height;
        
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - slant, ry + dropLen);
      }
      ctx.stroke();
    }

  }, [player, camera, zoom, windowSize, resources, droppedItems, particles, mapTiles, customAssets]);

  const dropToMap = (item: { type: ResourceType; amount: number }, index: number) => {
    setDroppedItems(prev => [
      ...prev,
      { id: Math.random().toString(), type: item.type, amount: item.amount, pos: { x: player.pos.x, y: player.pos.y } }
    ]);
    setPlayer(prev => {
      const nextInv = [...prev.inventory];
      nextInv[index] = null;
      return { ...prev, inventory: nextInv };
    });
  };

  const craft = (recipe: typeof recipes[0]) => {
    const woodCount = player.inventory.reduce((acc, item) => item?.type === 'wood' ? acc + item.amount : acc, 0);
    if (woodCount < recipe.wood) return;

    // Deduct wood
    let remainingToDeduct = recipe.wood;
    const nextInv = player.inventory.map(item => {
      if (item?.type === 'wood') {
        const toTake = Math.min(item.amount, remainingToDeduct);
        remainingToDeduct -= toTake;
        if (item.amount - toTake === 0) return null;
        return { ...item, amount: item.amount - toTake };
      }
      return item;
    });

    // Add tool to first empty hotbar slot
    const nextHotbar = [...player.hotbar];
    const freeIndex = nextHotbar.indexOf(null);
    if (freeIndex !== -1) {
      nextHotbar[freeIndex] = { id: Math.random().toString(), type: recipe.type };
    }

    setPlayer(prev => ({ ...prev, inventory: nextInv, hotbar: nextHotbar }));
  };

  const equipItem = (invIndex: number, slot: EquipmentSlot) => {
    setPlayer(prev => {
      const nextInv = [...prev.inventory];
      const nextEquip = { ...prev.equipment };
      const item = nextInv[invIndex];
      
      if (!item) return prev;

      // Basic validation
      if (slot.startsWith('tool_')) {
          const toolType = slot.replace('tool_', '');
          if (!item.type.includes(toolType) && !item.type.includes('super')) return prev;
      }

      const prevEquipped = nextEquip[slot];
      nextEquip[slot] = item;
      nextInv[invIndex] = prevEquipped;
      
      return { ...prev, inventory: nextInv, equipment: nextEquip };
    });
  };

  const unequipItem = (slot: EquipmentSlot, targetInvIndex?: number) => {
    setPlayer(prev => {
      const nextInv = [...prev.inventory];
      const nextEquip = { ...prev.equipment };
      const item = nextEquip[slot];
      
      if (!item) return prev;

      const targetIdx = targetInvIndex !== undefined ? targetInvIndex : nextInv.indexOf(null);
      if (targetIdx !== -1) {
          const prevInvItem = nextInv[targetIdx];
          nextInv[targetIdx] = item;
          nextEquip[slot] = prevInvItem;
          return { ...prev, inventory: nextInv, equipment: nextEquip };
      }
      return prev;
    });
  };

  const moveItem = (sourceIndex: number | string, targetIndex: number | string, sourcePool: 'inventory' | 'hotbar' | 'equipment', targetPool: 'inventory' | 'hotbar' | 'equipment') => {
    if (!draggingItem) return;
    
    if (sourcePool === 'inventory' && targetPool === 'inventory') {
        setPlayer(prev => {
            const nextInv = [...prev.inventory];
            const temp = nextInv[targetIndex as number];
            nextInv[targetIndex as number] = nextInv[sourceIndex as number];
            nextInv[sourceIndex as number] = temp;
            return { ...prev, inventory: nextInv };
        });
    } else if (sourcePool === 'inventory' && targetPool === 'equipment') {
        equipItem(sourceIndex as number, targetIndex as EquipmentSlot);
    } else if (sourcePool === 'equipment' && targetPool === 'inventory') {
        unequipItem(sourceIndex as EquipmentSlot, targetIndex as number);
    } else if (sourcePool === 'inventory' && targetPool === 'hotbar') {
        setPlayer(prev => {
            const nextInv = [...prev.inventory];
            const nextHotbar = [...prev.hotbar];
            const invItem = nextInv[sourceIndex as number];
            if (invItem) {
                const hItem = nextHotbar[targetIndex as number];
                nextHotbar[targetIndex as number] = { id: invItem.id || Math.random().toString(), type: invItem.type as ToolType };
                nextInv[sourceIndex as number] = hItem ? { id: hItem.id, type: hItem.type, amount: 1 } : null;
            }
            return { ...prev, inventory: nextInv, hotbar: nextHotbar };
        });
    } else if (sourcePool === 'hotbar' && targetPool === 'inventory') {
        setPlayer(prev => {
            const nextInv = [...prev.inventory];
            const nextHotbar = [...prev.hotbar];
            const hItem = nextHotbar[sourceIndex as number];
            if (hItem) {
                const invItem = nextInv[targetIndex as number];
                nextInv[targetIndex as number] = { id: hItem.id, type: hItem.type, amount: 1 };
                nextHotbar[sourceIndex as number] = invItem ? { id: invItem.id || Math.random().toString(), type: invItem.type as ToolType } : null;
            }
            return { ...prev, inventory: nextInv, hotbar: nextHotbar };
        });
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-[#1a1a1a] text-[#e0e0e0] font-mono select-none"
      onMouseMove={handleCanvasMouseMove}
      onClick={() => {
        if (draggingItem) {
          if (!isHoveringInventoryWindow && !isHoveringHotbarWindow && hoveredInvIndex === null && hoveredHotbarIndex === null) {
            if (draggingItem.source === 'inventory') {
              dropToMap(draggingItem, draggingItem.index);
            } else if (draggingItem.source === 'hotbar') {
               setPlayer(prev => {
                   const nextHotbar = [...prev.hotbar];
                   nextHotbar[draggingItem.index] = null;
                   return { ...prev, hotbar: nextHotbar };
               });
            }
          }
          setDraggingItem(null);
        }
      }}
      onMouseUp={() => {
        handleCanvasMouseUp();
      }}
    >
      <canvas
        ref={canvasRef}
        width={windowSize.width}
        height={windowSize.height}
        onMouseDown={handleCanvasMouseDown}
        onMouseUp={handleCanvasMouseUp}
        className="block cursor-crosshair"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Resource Hover Tooltip */}
      {hoveredResource && !draggingItem && (
        <div 
          className="fixed pointer-events-none z-50 bg-black/90 border border-[#ffce00] px-2 py-1 flex flex-col shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
          style={{ left: mousePos.x + 20, top: mousePos.y - 20 }}
        >
          <div className="flex items-center gap-2">
            {resourceIcons[hoveredResource.type] ? (
              <img 
                src={(resourceIcons[hoveredResource.type] as HTMLImageElement).src} 
                className={`w-4 h-4 object-contain ${
                  ['gold', 'diamond', 'silver'].includes(hoveredResource.type) ? 'scale-[2.1]' : 
                  hoveredResource.type === 'aluminum' ? 'scale-[0.8]' : ''
                }`} 
                alt={hoveredResource.type} 
              />
            ) : (
              <div className="w-2 h-2" style={{ backgroundColor: RESOURCE_COLORS[hoveredResource.type] }} />
            )}
            <span className="text-[10px] font-bold text-[#ffce00] uppercase tracking-tighter">
              {hoveredResource.isStick ? 'Ramita' : hoveredResource.type}
            </span>
          </div>
          <span className="text-[9px] text-[#888] font-mono">QTY: {hoveredResource.amount} / {hoveredResource.maxAmount}</span>
        </div>
      )}

      {/* Enemy Hover Tooltip */}
      {hoveredEnemy && !draggingItem && (
        <div 
          className="fixed pointer-events-none z-50 bg-black/90 border border-red-500 px-2 py-1 flex flex-col shadow-[4px_4px_0_rgba(0,0,0,0.5)]"
          style={{ left: mousePos.x + 20, top: mousePos.y - 20 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">
              {hoveredEnemy.name} (Lvl {hoveredEnemy.level})
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-700 rounded-sm overflow-hidden mb-1">
             <div className="h-full bg-red-500" style={{ width: `${(hoveredEnemy.hp / hoveredEnemy.maxHp) * 100}%` }} />
          </div>
          <span className="text-[9px] text-[#888] font-mono">ATK: {hoveredEnemy.attack} | HP: {Math.ceil(hoveredEnemy.hp)}/{hoveredEnemy.maxHp}</span>
        </div>
      )}

      {/* Dragged Item Follower */}
      {draggingItem && (
        <div 
          className="fixed pointer-events-none z-[100] drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
          style={{ left: mousePos.x, top: mousePos.y, transform: 'translate(-50%, -50%) scale(1.1)' }}
        >
          {Object.keys(RESOURCE_COLORS).includes(draggingItem.type) ? (
              <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-lg blur-[4px] opacity-40 absolute inset-0 m-auto" style={{ backgroundColor: RESOURCE_COLORS[draggingItem.type as ResourceType] }} />
                  {resourceIcons[draggingItem.type] ? (
                    <img 
                      src={(resourceIcons[draggingItem.type] as HTMLImageElement).src} 
                      className={`w-8 h-8 object-contain relative z-10 ${
                        ['gold', 'diamond', 'silver'].includes(draggingItem.type) ? 'scale-[2.3]' : 
                        draggingItem.type === 'aluminum' ? 'scale-[0.9]' : ''
                      }`} 
                      alt={draggingItem.type} 
                    />
                  ) : (
                    <div className="w-6 h-6 rounded shadow-2xl relative z-10" style={{ backgroundColor: RESOURCE_COLORS[draggingItem.type as ResourceType] }} />
                  )}
                  <span className="absolute bottom-1.5 right-1.5 z-20 text-[10px] font-black text-white/100 leading-none bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded shadow-xl">
                      {draggingItem.amount}
                  </span>
              </div>
          ) : (
            <div className="flex items-center justify-center p-2 rounded-xl">
                 {draggingItem.type === 'super_axe' ? (
                     axeImage ? <img src="/assets/tools/super_axe.png" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" alt="Super Axe" /> : <Zap size={24} className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                 ) : draggingItem.type === 'super_pickaxe' ? (
                     pickaxeImage ? <img src="/assets/tools/super_pickaxe.png" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" alt="Super Pick" /> : <Zap size={24} className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                 ) : draggingItem.type.includes('axe') ? <Zap size={24} className="text-blue-400" /> : <Hammer size={24} className="text-stone-400" />}
            </div>
          )}
        </div>
      )}

      {/* HUD Layer */}
      <div className="absolute inset-0 pointer-events-none p-4">
        {/* Resource HUD (Top Left) */}
        <div className="absolute top-4 left-4 flex items-start gap-4 pointer-events-auto">
          {/* Player Status Capsule */}
          <div className="flex items-center gap-3 bg-black/80 backdrop-blur-xl px-5 py-2 rounded-[30px] border border-white/5 shadow-2xl">
            {/* Avatar Circle */}
            <div className="w-8 h-8 bg-[#d1d5db] rounded-full border border-white/10 shadow-inner flex-shrink-0" />
            
            <div className="flex flex-col gap-0.5 min-w-[130px]">
              <div className="flex items-baseline justify-between mb-[1px]">
                 <span className="text-[11px] font-black text-white tracking-wide leading-none uppercase drop-shadow-sm">{player.name}</span>
                 <span className="text-[8px] font-black text-white/60 uppercase tracking-tighter">lvl {player.level}</span>
              </div>
              
              {/* HP Bar */}
              <div className="relative w-full h-[3px] bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={false}
                  animate={{ width: `${(player.hp / player.maxHp) * 100}%` }}
                  className="h-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.4)]" 
                />
              </div>

              {/* XP Bar */}
              <div className="relative w-full h-[3px] bg-white/10 rounded-full overflow-hidden mt-[1px]">
                <motion.div 
                  initial={false}
                  animate={{ width: `${(player.xp / player.maxXp) * 100}%` }}
                  className="h-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.3)]" 
                />
              </div>

              <div className="flex justify-between mt-[1px]">
                 <span className="text-[7.5px] font-black text-red-500 tabular-nums tracking-tighter uppercase">HP: {Math.ceil(player.hp)}/{player.maxHp}</span>
                 <span className="text-[7.5px] font-black text-white/50 tabular-nums tracking-tighter uppercase">XP: {player.xp}/{player.maxXp}</span>
              </div>
            </div>
          </div>

          {/* Resources Capsule */}
          <div className="bg-black/80 backdrop-blur-xl px-5 py-2 rounded-[30px] border border-white/5 shadow-2xl flex items-center gap-4">
            {['wood', 'stone', 'coal', 'copper', 'aluminum', 'iron', 'silver', 'gold', 'diamond'].map((type) => {
              const count = player.inventory.reduce((acc, item) => item?.type === type ? acc + item.amount : acc, 0);
              return (
                <div 
                  key={type} 
                  className="relative flex items-center gap-1.5 cursor-help"
                  onMouseEnter={() => setHoveredHudResource(type)}
                  onMouseLeave={() => setHoveredHudResource(null)}
                >
                  <span className="text-[11px] font-black text-white/90 tabular-nums">{count}</span>
                  {resourceIcons[type] ? (
                    <img 
                      src={(resourceIcons[type] as HTMLImageElement).src} 
                      className="w-[18px] h-[18px] object-contain" 
                      alt={type} 
                    />
                  ) : (
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RESOURCE_COLORS[type as ResourceType] }} />
                  )}

                  {/* Tooltip */}
                  {hoveredHudResource === type && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-3 z-[60] bg-white text-black px-2 py-1 whitespace-nowrap rounded font-black text-[8px] uppercase tracking-tighter shadow-2xl pointer-events-none"
                    >
                       {RESOURCE_NAMES[type as ResourceType] || type.replace('_', ' ').toUpperCase()}
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
          
          <Notifications notifications={notifications} removeNotification={removeNotification} />
        </div>

        <Minimap isMapOpen={isMapOpen} setIsMapOpen={setIsMapOpen} player={player} resources={resources} getTile={getTile} />

      </div>

      <Hotbar 
        player={player} 
        setPlayer={setPlayer} 
        isInventoryOpen={isInventoryOpen} 
        setIsInventoryOpen={setIsInventoryOpen} 
        isCraftingOpen={isCraftingOpen} 
        setIsCraftingOpen={setIsCraftingOpen} 
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        setIsHoveringHotbarWindow={setIsHoveringHotbarWindow} 
        hoveredHotbarIndex={hoveredHotbarIndex} 
        setHoveredHotbarIndex={setHoveredHotbarIndex} 
        draggingItem={draggingItem} 
        setDraggingItem={setDraggingItem} 
        moveItem={moveItem} 
        axeImage={axeImage} 
        pickaxeImage={pickaxeImage} 
      />

      <AnimatePresence>
        <Inventory 
          isInventoryOpen={isInventoryOpen} 
          setIsInventoryOpen={setIsInventoryOpen} 
          setIsHoveringInventoryWindow={setIsHoveringInventoryWindow} 
          player={player} 
          hoveredInvIndex={hoveredInvIndex} 
          setHoveredInvIndex={setHoveredInvIndex} 
          draggingItem={draggingItem} 
          setDraggingItem={setDraggingItem} 
          moveItem={moveItem}
          equipItem={equipItem}
          unequipItem={unequipItem}
          axeImage={axeImage}
          pickaxeImage={pickaxeImage} 
          resourceIcons={resourceIcons}
        />
        <CraftingMenu 
          isCraftingOpen={isCraftingOpen} 
          setIsCraftingOpen={setIsCraftingOpen} 
          unlockedRecipeNotifications={unlockedRecipeNotifications} 
          recipes={recipes} 
          player={player} 
          craft={craft} 
        />

        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-auto"
            onClick={() => setIsMenuOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#1a1a1a] border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col gap-4 min-w-[300px]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-black text-center mb-4 uppercase tracking-[0.3em] text-white/40">Menú</h2>
              
              <button 
                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                onClick={() => alert('Configuración no disponible aún')}
              >
                Configuración
              </button>
              
              <button 
                className="w-full py-4 bg-red-500/20 hover:bg-red-500/40 border border-red-500/40 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-red-400 transition-all"
                onClick={() => {
                  setGameStarted(false);
                  setIsMenuOpen(false);
                }}
              >
                Salir
              </button>

              <button 
                className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/20 hover:text-white/40 transition-all"
                onClick={() => setIsMenuOpen(false)}
              >
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay UI */}
      {loadingPhase && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0a0a0a]/90 pointer-events-none">
          <svg className="animate-spin mb-4" width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#ffce00" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="text-white/70 text-xs font-mono tracking-widest uppercase">
            {loadingPhase}
          </span>
        </div>
      )}

      {/* Start Screen */}
      {!gameStarted && (
        <StartScreen onPlay={() => setGameStarted(true)} />
      )}

      {/* Death Overlay */}
      <AnimatePresence>
        {isDead && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl pointer-events-auto"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              className="text-center"
            >
              <h1 className="text-6xl font-black text-red-600 mb-2 uppercase tracking-[0.4em] drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                Has muerto
              </h1>
              <p className="text-white/30 text-xs font-bold uppercase tracking-[0.5em] mb-12">La naturaleza ha reclamado tu alma</p>
              
              <div className="flex flex-col gap-4 max-w-xs mx-auto">
                <button 
                  className="w-full py-4 bg-white text-black font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white/90 transition-all shadow-2xl"
                  onClick={() => {
                    setPlayer(prev => ({ 
                        ...prev, 
                        hp: prev.maxHp, 
                        pos: { ...initialSpawnPosRef.current }, 
                        targetPos: { ...initialSpawnPosRef.current } 
                    }));
                    setIsDead(false);
                  }}
                >
                  Reaparecer
                </button>
                
                <button 
                  className="w-full py-4 bg-white/5 border border-white/10 text-white/60 font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-white/10 transition-all"
                  onClick={() => {
                    setGameStarted(false);
                    setIsDead(false);
                    setPlayer(prev => ({ ...prev, hp: prev.maxHp }));
                  }}
                >
                  Salir del juego
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
